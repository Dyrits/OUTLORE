import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import type { MissionDetail } from "@outlore/contracts";
import { Effect } from "effect";
import { withClaude, withoutNote } from "../fixtures/claude.ts";
import { settle, startMission } from "../fixtures/service.ts";
import { idleWith } from "../fixtures/standIns.ts";

describe("network hosts asked about by a sandboxed Claude Code thread", () => {
  const ask = (text: string) => startMission({ effort: "low", model: "haiku", text });
  const lastReply = (detail: MissionDetail) => withoutNote(detail.messages.at(-1)?.text);
  const inputLines = (directory: string): Array<{ type?: string; response?: unknown }> =>
    readFileSync(join(directory, "input.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));

  it.live("allows a blocked host inside the sandbox, answering only that ask", () => {
    const { directory, layer } = withClaude();
    process.env.STAND_IN_INPUT = join(directory, "input.jsonl");
    return Effect.gen(function* () {
      const started = yield* ask("ask-net example.com");
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(lastReply(detail)).toContain("answered allow");
      const answer = inputLines(directory).find((line) => line.type === "control_response");
      expect(answer?.response).toMatchObject({
        request_id: "ask-1",
        response: { behavior: "allow", updatedInput: { host: "example.com" } },
        subtype: "success",
      });
    }).pipe(Effect.provide(layer));
  });

  it.live("leaves a sandbox escape unanswered: the network allowance covers hosts only", () => {
    const { directory, layer } = withClaude();
    process.env.STAND_IN_INPUT = join(directory, "input.jsonl");
    return Effect.gen(function* () {
      const started = yield* ask("ask-bash-escape");
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(lastReply(detail)).toContain("unanswered");
      expect(inputLines(directory).some((line) => line.type === "control_response")).toBe(false);
    }).pipe(Effect.provide(layer));
  });

  it.live("answers no host ask when the sandbox could not start", () => {
    const { directory, layer } = withClaude({ sandboxProblem: "Sandbox unavailable: install bubblewrap." });
    process.env.STAND_IN_INPUT = join(directory, "input.jsonl");
    return Effect.gen(function* () {
      const started = yield* ask("ask-net example.com");
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(lastReply(detail)).toContain("unanswered");
      expect(inputLines(directory).some((line) => line.type === "control_response")).toBe(false);
    }).pipe(Effect.provide(layer));
  });

  it.live("answers no ask whose host is not one plain host name", () => {
    const { directory, layer } = withClaude();
    process.env.STAND_IN_INPUT = join(directory, "input.jsonl");
    return Effect.gen(function* () {
      const started = yield* ask("ask-net bad/host");
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(lastReply(detail)).toContain("unanswered");
    }).pipe(Effect.provide(layer));
  });
});
