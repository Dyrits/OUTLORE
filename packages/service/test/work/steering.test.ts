import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import type { MessageDelivery, MissionDetail, Request, ThreadId } from "@outlore/contracts";
import { Effect, Layer } from "effect";
import { afterEach } from "vitest";
import { fakeHarnessLayer, Harness, Service, serviceLayer } from "../../src/index.ts";
import { call, read, settle } from "../fixtures/service.ts";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

const live = (harness: Layer.Layer<Harness> = fakeHarnessLayer("10 millis")) => {
  const directory = mkdtempSync(join(tmpdir(), "outlore-steering-"));
  directories.push(directory);
  return serviceLayer({
    filename: join(directory, "outlore.sqlite"),
    harness,
    homeFolder: directory,
    scratchRoot: join(directory, "missions"),
  });
};

const withoutMidTurnSteer = () =>
  Layer.effect(
    Harness,
    Effect.map(Harness, (harness) => ({ ...harness, steer: () => Effect.succeed(false) })),
  ).pipe(Layer.provide(fakeHarnessLayer("10 millis")));

const failureOf = <R extends Request>(request: R) =>
  Effect.gen(function* () {
    const service = yield* Service;
    return yield* Effect.flip(service.handle(request));
  });

let requestCount = 0;
const start = (text: string) =>
  call({
    _tag: "StartMission",
    effort: "default",
    model: "default",
    requestId: `start-${++requestCount}`,
    text,
    workspacePath: null,
  });
const send = (threadId: ThreadId, text: string, delivery: MessageDelivery | null = null) =>
  call({ _tag: "SendMessage", delivery, requestId: `send-${++requestCount}`, text, threadId });
const interrupt = (threadId: ThreadId) => call({ _tag: "InterruptThread", threadId });

/** A fake-harness line that calls one of the thread tools. */
const tool = (name: string, args: object) => `call ${name} ${JSON.stringify(args)}`;

const repliesOf = (detail: MissionDetail) =>
  detail.messages
    .filter((message) => message.sender === "agent" && message.replyToMessageId == null)
    .map((message) => message.text);
const isRunning = (detail: MissionDetail) => detail.thread.state === "Underway";
const isIdleWith = (count: number) => (detail: MissionDetail) =>
  detail.thread.state === "Resting" && repliesOf(detail).length === count;
const childOf = (detail: MissionDetail) => detail.threads.find((thread) => thread.parentId === detail.thread.id);

describe("steering a running thread", () => {
  it.live("delivers the edited message and skips the removed one when the next turn starts", () =>
    Effect.gen(function* () {
      const started = yield* start("wait 1200");
      yield* settle(started.missionId, isRunning);
      const kept = yield* send(started.threadId, "Original");
      const removed = yield* send(started.threadId, "Discard this");
      const blank = yield* failureOf({ _tag: "EditQueuedMessage", messageId: kept.messageId, text: " " });
      expect(blank.message).toBe("The message is empty.");
      yield* call({ _tag: "EditQueuedMessage", messageId: kept.messageId, text: "Edited" });
      yield* call({ _tag: "RemoveQueuedMessage", messageId: removed.messageId });
      const queued = yield* read(started.missionId);
      expect(queued.messages.find((item) => item.id === kept.messageId)).toMatchObject({
        isQueued: true,
        text: "Edited",
      });
      expect(queued.messages.some((item) => item.id === removed.messageId)).toBe(false);

      const finished = yield* settle(started.missionId, isIdleWith(2));
      expect(repliesOf(finished)).toEqual(["Echo: waited 1200", "Echo: Edited"]);
      const lateEdit = yield* failureOf({ _tag: "EditQueuedMessage", messageId: kept.messageId, text: "Too late" });
      const lateRemove = yield* failureOf({ _tag: "RemoveQueuedMessage", messageId: kept.messageId });
      expect(lateEdit.message).toBe("This message is no longer queued.");
      expect(lateRemove.message).toBe("This message is no longer queued.");
      expect((yield* read(started.missionId)).messages.find((item) => item.id === kept.messageId)?.text).toBe("Edited");
    }).pipe(Effect.provide(live())),
  );

  it.live("joins the owner's message to the running turn when it is sent as Steer", () =>
    Effect.gen(function* () {
      const started = yield* start("wait 400");
      yield* settle(started.missionId, isRunning);
      yield* send(started.threadId, "Also this", "Steer");
      const detail = yield* settle(started.missionId, isIdleWith(1));
      expect(repliesOf(detail)).toEqual(["Echo: waited 400 + Also this"]);
      yield* Effect.sleep("100 millis");
      expect(repliesOf(yield* read(started.missionId))).toHaveLength(1);
    }).pipe(Effect.provide(live())),
  );

  it.live("keeps the owner's queued message for the next turn and marks it Queued until then", () =>
    Effect.gen(function* () {
      const started = yield* start("wait 300");
      yield* settle(started.missionId, isRunning);
      yield* send(started.threadId, "Later", "Queue");
      const running = yield* read(started.missionId);
      expect(running.messages.find((message) => message.text === "Later")?.isQueued).toBe(true);

      const detail = yield* settle(started.missionId, isIdleWith(2));
      expect(repliesOf(detail)).toEqual(["Echo: waited 300", "Echo: Later"]);
      expect(detail.messages.find((message) => message.text === "Later")?.isQueued).toBe(false);
    }).pipe(Effect.provide(live())),
  );

  it.live("queues the owner's message by default, and a Steer on it joins the running turn", () =>
    Effect.gen(function* () {
      const started = yield* start("wait 400");
      yield* settle(started.missionId, isRunning);
      const sent = yield* send(started.threadId, "Sooner");
      const queued = yield* read(started.missionId);
      expect(queued.messages.find((message) => message.id === sent.messageId)).toMatchObject({
        isDelivered: false,
        isQueued: true,
      });
      yield* call({ _tag: "SteerQueuedMessage", messageId: sent.messageId });
      const detail = yield* settle(started.missionId, isIdleWith(1));
      expect(repliesOf(detail)).toEqual(["Echo: waited 400 + Sooner"]);
      expect(detail.messages.find((message) => message.id === sent.messageId)).toMatchObject({
        isDelivered: true,
        isQueued: false,
      });
      const refused = yield* failureOf({ _tag: "SteerQueuedMessage", messageId: sent.messageId });
      expect(refused).toBeDefined();
    }).pipe(Effect.provide(live())),
  );

  it.live("returns a steered message to the queue when unsteered before delivery and refuses once delivered", () =>
    Effect.gen(function* () {
      const started = yield* start("wait 1200");
      yield* settle(started.missionId, isRunning);
      const sent = yield* send(started.threadId, "First draft");
      yield* call({ _tag: "SteerQueuedMessage", messageId: sent.messageId });
      const steered = yield* read(started.missionId);
      expect(steered.messages.find((item) => item.id === sent.messageId)).toMatchObject({
        isDelivered: false,
        isQueued: false,
      });

      const editWhileSteered = yield* failureOf({
        _tag: "EditQueuedMessage",
        messageId: sent.messageId,
        text: "Blocked while steered",
      });
      expect(editWhileSteered.message).toBe("This message is no longer queued.");

      yield* call({ _tag: "UnsteerQueuedMessage", messageId: sent.messageId });
      const requeued = yield* read(started.missionId);
      expect(requeued.messages.find((item) => item.id === sent.messageId)).toMatchObject({
        isDelivered: false,
        isQueued: true,
      });

      // Returning to the queue restores editing and refuses a second unsteer.
      yield* call({ _tag: "EditQueuedMessage", messageId: sent.messageId, text: "Second draft" });
      const alreadyQueued = yield* failureOf({ _tag: "UnsteerQueuedMessage", messageId: sent.messageId });
      expect(alreadyQueued.message).toBe("This message was already taken in by the running turn.");

      const finished = yield* settle(started.missionId, isIdleWith(2));
      expect(repliesOf(finished)).toEqual(["Echo: waited 1200", "Echo: Second draft"]);

      const alreadyDelivered = yield* failureOf({ _tag: "UnsteerQueuedMessage", messageId: sent.messageId });
      expect(alreadyDelivered.message).toBe("This message was already taken in by the running turn.");
    }).pipe(Effect.provide(live(withoutMidTurnSteer()))),
  );

  it.live("queues the owner's message when the owner's default is Queue", () =>
    Effect.gen(function* () {
      const started = yield* start("wait 300");
      yield* settle(started.missionId, isRunning);
      yield* send(started.threadId, "Later");
      const detail = yield* settle(started.missionId, isIdleWith(2));
      expect(repliesOf(detail)).toEqual(["Echo: waited 300", "Echo: Later"]);
    }).pipe(Effect.provide(live())),
  );

  it.live("steers a message sent as Steer, though messages queue by default", () =>
    Effect.gen(function* () {
      const started = yield* start("wait 400");
      yield* settle(started.missionId, isRunning);
      yield* send(started.threadId, "Now", "Steer");
      const detail = yield* settle(started.missionId, isIdleWith(1));
      expect(repliesOf(detail)).toEqual(["Echo: waited 400 + Now"]);
    }).pipe(Effect.provide(live())),
  );

  it.live("joins a result from a thread beneath to its parent's running turn", () =>
    Effect.gen(function* () {
      const started = yield* start(
        `${tool("open_thread", { request: tool("report_result", { journal: "nothing to record", result: "42" }), title: "Answer" })}\nwait 800`,
      );
      const detail = yield* settle(started.missionId, isIdleWith(1));
      const [reply] = repliesOf(detail);
      expect(reply).toContain('Result from thread "Answer"');
      expect(reply).toContain("42");
      yield* Effect.sleep("100 millis");
      expect(repliesOf(yield* read(started.missionId))).toHaveLength(1);
    }).pipe(Effect.provide(live())),
  );
});

describe("interrupting a thread", () => {
  it.live("ends the running turn at once and leaves the thread Idle", () =>
    Effect.gen(function* () {
      const started = yield* start("wait 5000");
      yield* settle(started.missionId, isRunning);
      yield* interrupt(started.threadId);
      const detail = yield* settle(started.missionId, (current) => current.thread.state === "Resting");
      expect(repliesOf(detail)).toEqual([]);
    }).pipe(Effect.provide(live())),
  );

  it.live("starts the next turn with the messages the interrupted turn had not taken in", () =>
    Effect.gen(function* () {
      const started = yield* start("wait 5000");
      yield* settle(started.missionId, isRunning);
      yield* send(started.threadId, "After", "Queue");
      yield* interrupt(started.threadId);
      const detail = yield* settle(started.missionId, isIdleWith(1));
      expect(repliesOf(detail)).toEqual(["Echo: After"]);
    }).pipe(Effect.provide(live())),
  );

  it.live("leaves an interrupted thread Waiting while a thread beneath it runs", () =>
    Effect.gen(function* () {
      const started = yield* start(`${tool("open_thread", { request: "wait 3000" })}\nwait 5000`);
      yield* settle(started.missionId, (detail) => childOf(detail)?.state === "Underway");
      yield* interrupt(started.threadId);
      const detail = yield* settle(started.missionId, (current) => current.thread.state === "Waiting");
      expect(childOf(detail)?.state).toBe("Underway");
    }).pipe(Effect.provide(live())),
  );

  it.live("refuses to interrupt a thread that is not running", () =>
    Effect.gen(function* () {
      const started = yield* start("Hello");
      yield* settle(started.missionId, isIdleWith(1));
      const failure = yield* failureOf({ _tag: "InterruptThread", threadId: started.threadId });
      expect(failure).toMatchObject({ kind: "InvalidInput", message: "This thread is not running." });
    }).pipe(Effect.provide(live())),
  );

  it.live("lets a thread interrupt a running thread directly beneath it", () =>
    Effect.gen(function* () {
      const started = yield* start(tool("open_thread", { request: "wait 5000" }));
      const opened = yield* settle(
        started.missionId,
        (detail) => childOf(detail)?.state === "Underway" && detail.thread.state !== "Underway",
      );
      const childId = childOf(opened)?.id as ThreadId;
      yield* send(started.threadId, tool("interrupt_thread", { thread: childId }));
      const detail = yield* settle(
        started.missionId,
        (current) => childOf(current)?.state === "Resting" && isIdleWith(2)(current),
      );
      expect(repliesOf(detail).at(-1)).toBe("Echo: Interrupted.");
    }).pipe(Effect.provide(live())),
  );

  it.live("refuses a thread's interrupt of a thread not directly beneath it", () =>
    Effect.gen(function* () {
      const started = yield* start(tool("open_thread", { request: "wait 5000" }));
      const opened = yield* settle(
        started.missionId,
        (detail) => childOf(detail)?.state === "Underway" && detail.thread.state !== "Underway",
      );
      const childId = childOf(opened)?.id as ThreadId;
      yield* send(childId, tool("interrupt_thread", { thread: started.threadId }), "Queue");
      yield* interrupt(childId);
      const detail = yield* settle(started.missionId, (current) => repliesOf(current).length === 1, childId);
      expect(repliesOf(detail)[0]).toBe(
        "Echo: Not interrupted: you can only interrupt a thread directly beneath you, by its id.",
      );
    }).pipe(Effect.provide(live())),
  );

  it.live("refuses a thread's interrupt of a thread beneath it that is not running", () =>
    Effect.gen(function* () {
      const started = yield* start(tool("open_thread", { request: "Hello" }));
      const opened = yield* settle(
        started.missionId,
        (detail) => childOf(detail)?.state === "Resting" && detail.thread.state === "Resting",
      );
      const childId = childOf(opened)?.id as ThreadId;
      yield* send(started.threadId, tool("interrupt_thread", { thread: childId }));
      const detail = yield* settle(started.missionId, isIdleWith(2));
      expect(repliesOf(detail).at(-1)).toBe("Echo: Not interrupted: that thread is not running.");
    }).pipe(Effect.provide(live())),
  );
});
