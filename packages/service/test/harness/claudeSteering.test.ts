import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import type { MissionDetail } from "@outlore/contracts";
import { Effect } from "effect";
import { withClaude, withoutNote } from "../fixtures/claude.ts";
import { call, read, sendTo, settle, startMission } from "../fixtures/service.ts";
import { idleWith } from "../fixtures/standIns.ts";

describe("steering and interrupting Claude Code", () => {
  const inputLines = (directory: string): Array<Record<string, unknown>> => {
    try {
      return readFileSync(join(directory, "input.jsonl"), "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
    } catch {
      return [];
    }
  };
  const startSlow = (text: string) => startMission({ effort: "low", model: "haiku", text });
  const isRunning = (detail: MissionDetail) => detail.thread.state === "Running";
  /**
   * Waits until the stand-in has been given the turn's message. A thread reads Running while Claude Code still starts,
   * and an interrupt or a steered message sent then finds no turn to act on.
   */
  const untilTurnWritten = (directory: string) =>
    Effect.gen(function* () {
      for (let attempt = 0; attempt < 500 && !inputLines(directory).some((line) => line.type === "user"); attempt++) {
        yield* Effect.sleep("10 millis");
      }
    });

  it.live("gives Claude Code the text then one base64 image block per image, as the turn's message", () => {
    const { directory, layer } = withClaude();
    process.env.STAND_IN_INPUT = join(directory, "input.jsonl");
    const bytes = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20, 1)]);
    return Effect.gen(function* () {
      const card = yield* call({ _tag: "AddAttachment", data: bytes.toString("base64"), name: "shot.png" });
      const started = yield* startMission({ attachmentIds: [card.id], effort: "low", model: "haiku", text: "See" });
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(withoutNote(detail.messages.at(-1)?.text)).toMatch(/to: See$/);
      const message = inputLines(directory)[0]?.message as { content: Array<Record<string, unknown>> };
      expect(message.content[0]).toMatchObject({ type: "text" });
      expect(message.content[1]).toEqual({
        source: { data: bytes.toString("base64"), media_type: "image/png", type: "base64" },
        type: "image",
      });
    }).pipe(Effect.provide(layer));
  });

  it.live("writes a steered message with its identifier into the running turn and marks it delivered", () => {
    const { directory, layer, starts } = withClaude();
    process.env.STAND_IN_INPUT = join(directory, "input.jsonl");
    return Effect.gen(function* () {
      const started = yield* startSlow("slow 600");
      yield* settle(started.missionId, isRunning);
      yield* untilTurnWritten(directory);
      const sent = yield* sendTo(started.threadId, "Also this", "Steer");
      const detail = yield* settle(started.missionId, idleWith(1));

      expect(withoutNote(detail.messages.at(-1)?.text)).toMatch(/^Reply 1 .* to: slow 600 \+ Also this$/);
      expect(starts()).toHaveLength(1);
      expect(starts()[0]?.args).toContain("--replay-user-messages");
      expect(inputLines(directory).at(-1)).toEqual({
        message: { content: "Also this", role: "user" },
        type: "user",
        uuid: sent.messageId,
      });
      expect(detail.messages.find((message) => message.id === sent.messageId)?.isQueued).toBe(false);
    }).pipe(Effect.provide(layer));
  });

  it.live(
    "closes the process when a steered message was not taken in by the turn's end, then sends it next turn",
    () => {
      const { directory, layer, starts } = withClaude();
      process.env.STAND_IN_INPUT = join(directory, "input.jsonl");
      return Effect.gen(function* () {
        const started = yield* startSlow("slow 400");
        yield* settle(started.missionId, isRunning);
        yield* untilTurnWritten(directory);
        yield* sendTo(started.threadId, "unseen", "Steer");
        const detail = yield* settle(started.missionId, idleWith(2));
        yield* Effect.sleep("400 millis");

        const replies = (yield* read(started.missionId)).messages.filter((message) => message.sender === "agent");
        expect(replies.map((message) => withoutNote(message.text).replace(/ \(pid \d+\)/, ""))).toEqual([
          "Reply 1 to: slow 400",
          "Reply 1 to: unseen",
        ]);
        expect(starts()).toHaveLength(2);
        expect(starts()[1]?.args.join(" ")).toContain("--resume");
        expect(detail.thread.failure).toBeNull();
      }).pipe(Effect.provide(layer));
    },
  );

  it.live("interrupts the turn with a control request and keeps the process for the next turn", () => {
    const { directory, layer, starts } = withClaude();
    process.env.STAND_IN_INPUT = join(directory, "input.jsonl");
    return Effect.gen(function* () {
      const started = yield* startSlow("slow 5000");
      yield* settle(started.missionId, isRunning);
      yield* untilTurnWritten(directory);
      yield* call({ _tag: "InterruptThread", threadId: started.threadId });
      const interrupted = yield* settle(started.missionId, (detail) => detail.thread.state === "Idle");
      expect(interrupted.thread.failure).toBeNull();
      expect(interrupted.messages.filter((message) => message.sender === "agent")).toEqual([]);
      expect(inputLines(directory).find((line) => line.type === "control_request")).toMatchObject({
        request: { subtype: "interrupt" },
      });

      yield* sendTo(started.threadId, "Again");
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(withoutNote(detail.messages.at(-1)?.text)).toMatch(/^Reply 2 .* to: Again$/);
      expect(starts()).toHaveLength(1);
    }).pipe(Effect.provide(layer));
  });
});

describe("Claude Code woken by a background command", () => {
  it.live("runs what it does on waking as a turn: replies recorded, a line says why, the thread idle after", () => {
    const { layer, starts } = withClaude();
    return Effect.gen(function* () {
      const started = yield* startMission({ effort: "low", model: "haiku", text: "background 300" });
      const detail = yield* settle(started.missionId, idleWith(2));
      const replies = detail.messages.filter((message) => message.sender === "agent");
      expect(replies.map((message) => message.text.replace(/ \(pid \d+\)/, ""))).toEqual([
        expect.stringMatching(/^Reply 1 to: /),
        "Woken 2 after the background command",
      ]);
      expect(detail.handovers.map((line) => line.text)).toEqual(['Background command "Sleep" completed (exit code 0)']);
      expect(detail.thread.failure).toBeNull();
      // Its own turn left no message of its own, and the same process ran both.
      expect(starts()).toHaveLength(1);
    }).pipe(Effect.provide(layer));
  });

  it.live("lets a message sent while the thread is idle run its turn after the woken one", () => {
    const { layer, starts } = withClaude();
    return Effect.gen(function* () {
      const started = yield* startMission({ effort: "low", model: "haiku", text: "background 100" });
      yield* settle(started.missionId, idleWith(2));
      yield* sendTo(started.threadId, "After");
      const detail = yield* settle(started.missionId, idleWith(3));
      expect(withoutNote(detail.messages.at(-1)?.text)).toMatch(/^Reply 3 .* to: After$/);
      expect(starts()).toHaveLength(1);
    }).pipe(Effect.provide(layer));
  });
});
