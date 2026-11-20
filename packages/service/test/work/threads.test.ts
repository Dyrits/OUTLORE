import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import type { MissionDetail, ModelChoice, Request, ThreadId, ThreadSummary } from "@outlore/contracts";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { fakeHarnessLayer, Service, serviceLayer } from "../../src/index.ts";
import { call, read, settle } from "../fixtures/service.ts";

const directories: string[] = [];
const databaseFile = () => {
  const directory = mkdtempSync(join(tmpdir(), "outlore-threads-"));
  directories.push(directory);
  return join(directory, "outlore.sqlite");
};
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

const live = () => {
  const filename = databaseFile();
  return serviceLayer({
    filename,
    harness: fakeHarnessLayer("10 millis"),
    homeFolder: join(filename, ".."),
    scratchRoot: join(filename, "..", "missions"),
  });
};

const failureOf = <R extends Request>(request: R) =>
  Effect.gen(function* () {
    const service = yield* Service;
    return yield* Effect.flip(service.handle(request));
  });

let requestCount = 0;
const start = (text: string, model: ModelChoice = "default") =>
  call({
    _tag: "StartMission",
    effort: "default",
    model,
    requestId: `start-${++requestCount}`,
    text,
    workspacePath: null,
  });
const send = (threadId: ThreadId, text: string) =>
  call({ _tag: "SendMessage", delivery: null, requestId: `send-${++requestCount}`, text, threadId });
const open = (parentThreadId: ThreadId, text: string, model: ModelChoice = "default") =>
  call({
    _tag: "OpenThread",
    effort: "default",
    model,
    parentThreadId,
    requestId: `open-${++requestCount}`,
    shouldStartAnyway: false,
    text,
  });

/** A fake-harness line that calls one of the thread tools. */
const tool = (name: string, args: object) => `call ${name} ${JSON.stringify(args)}`;

const childrenOf = (detail: MissionDetail, parentId: string) =>
  detail.threads.filter((thread) => thread.parentId === parentId);
const stateOf = (detail: MissionDetail, threadId: string) =>
  detail.threads.find((thread) => thread.id === threadId)?.state;
const lastText = (detail: MissionDetail) => detail.messages.at(-1)?.text ?? "";
const only = (threads: ReadonlyArray<ThreadSummary>) => {
  const [thread] = threads;
  if (thread === undefined) throw new Error("no thread");
  return thread;
};

describe("opening threads", () => {
  it.live("opens a thread beneath the caller with the opener's model, effort, and workspace", () =>
    Effect.gen(function* () {
      const started = yield* start(
        tool("open_thread", { request: "Count the files", title: "Count the files" }),
        "sonnet",
      );
      const opened = yield* settle(started.missionId, (detail) => childrenOf(detail, started.threadId).length === 1);
      const child = only(childrenOf(opened, started.threadId));
      expect(child).toMatchObject({ depth: 1, isOpenedByAgent: true, title: "Count the files" });

      const detail = yield* read(started.missionId, child.id);
      expect(detail.thread).toMatchObject({ effort: "default", model: "sonnet", parentId: started.threadId });
      // The parent's conversation places the opening at the child's first message.
      expect(child.openedAt).toBe(detail.messages[0]?.sentAt);
      expect(detail.messages[0]).toMatchObject({
        fromThreadId: started.threadId,
        isResult: false,
        sender: "thread",
        text: "Count the files",
      });
      const top = yield* settle(started.missionId, (current) => lastText(current).includes(child.id));
      expect(lastText(top)).toContain("Opened thread");
    }).pipe(Effect.provide(live())),
  );

  it.live("titles the thread with the opener's short title, or else calls it Errand", () =>
    Effect.gen(function* () {
      const started = yield* start(
        `${tool("open_thread", { request: "Count every Markdown file under documentation/, recursively", title: "Count docs" })}\n${tool("open_thread", { request: "Count tests\nin packages/" })}`,
      );
      const opened = yield* settle(started.missionId, (detail) => childrenOf(detail, started.threadId).length === 2);
      expect(childrenOf(opened, started.threadId).map((thread) => thread.title)).toEqual(["Count docs", "Errand"]);
    }).pipe(Effect.provide(live())),
  );

  it.live("lets the opener choose another model and effort", () =>
    Effect.gen(function* () {
      const started = yield* start(tool("open_thread", { effort: "low", model: "haiku", request: "Summarize" }));
      const opened = yield* settle(started.missionId, (detail) => childrenOf(detail, started.threadId).length === 1);
      const detail = yield* read(started.missionId, only(childrenOf(opened, started.threadId)).id);
      expect(detail.thread).toMatchObject({ effort: "low", model: "haiku" });
    }).pipe(Effect.provide(live())),
  );

  it.live("lets the owner open a thread beneath any thread, starting with the owner's message", () =>
    Effect.gen(function* () {
      const started = yield* start("Plan the trip");
      const opened = yield* open(started.threadId, "Find hotels", "opus");
      const detail = yield* settle(started.missionId, (current) => current.thread.state === "Resting", opened.threadId);
      expect(detail.thread).toMatchObject({
        depth: 1,
        model: "opus",
        parentId: started.threadId,
        title: "Errand",
      });
      expect(detail.messages.map((message) => [message.sender, message.text])).toEqual([
        ["user", "Find hotels"],
        ["agent", "Echo: Find hotels"],
      ]);
      expect(detail.threads.find((thread) => thread.id === opened.threadId)?.isOpenedByAgent).toBe(false);
    }).pipe(Effect.provide(live())),
  );
});

describe("results and thread messages", () => {
  it.live("sends a reported result to the parent, makes the reporter Done, and wakes the parent", () =>
    Effect.gen(function* () {
      const started = yield* start(
        tool("open_thread", {
          request: tool("report_result", { journal: "nothing to record", result: "There are 42 files." }),
        }),
      );
      const done = yield* settle(started.missionId, (detail) => {
        const child = childrenOf(detail, started.threadId)[0];
        return child !== undefined && child.state === "Fulfilled" && detail.thread.state === "Resting";
      });
      const result = done.messages.find((message) => message.isResult);
      expect(result).toMatchObject({ sender: "thread", text: "There are 42 files." });
      // The parent's next turn received the result.
      expect(lastText(done)).toContain("There are 42 files.");
    }).pipe(Effect.provide(live())),
  );

  it.live("leaves the opener Waiting while a thread beneath it runs, then Idle", () =>
    Effect.gen(function* () {
      const started = yield* start(tool("open_thread", { request: "wait 400" }));
      yield* settle(started.missionId, (detail) => detail.thread.state === "Waiting");
      const after = yield* settle(started.missionId, (detail) =>
        childrenOf(detail, started.threadId).every((child) => child.state === "Resting"),
      );
      yield* settle(started.missionId, (detail) => detail.thread.state === "Resting");
      expect(childrenOf(after, started.threadId)).toHaveLength(1);
    }).pipe(Effect.provide(live())),
  );

  it.live("delivers a message to the parent and to a thread directly beneath, and refuses others", () =>
    Effect.gen(function* () {
      const started = yield* start(
        `${tool("open_thread", { request: "First", title: "First" })}\n${tool("open_thread", { request: "Second" })}`,
      );
      const opened = yield* settle(
        started.missionId,
        (detail) =>
          childrenOf(detail, started.threadId).length === 2 &&
          detail.threads.every((thread) => thread.state === "Resting"),
      );
      const [first, second] = childrenOf(opened, started.threadId) as [ThreadSummary, ThreadSummary];

      yield* send(first.id, tool("send_thread_message", { text: "Which format?", to: second.id }));
      const refused = yield* settle(started.missionId, (detail) => lastText(detail).includes("Echo:"), first.id);
      expect(lastText(refused)).toContain("only message your parent");

      yield* send(first.id, tool("send_thread_message", { text: "Which format?", to: started.threadId }));
      const asked = yield* settle(started.missionId, (detail) =>
        detail.messages.some((message) => message.fromThreadId === first.id && message.text === "Which format?"),
      );
      expect(asked.messages.find((message) => message.text === "Which format?")?.fromTitle).toBe("First");

      yield* send(started.threadId, tool("send_thread_message", { text: "Markdown.", to: first.id }));
      yield* settle(
        started.missionId,
        (detail) =>
          detail.messages.some((message) => message.fromThreadId === started.threadId && message.text === "Markdown."),
        first.id,
      );
    }).pipe(Effect.provide(live())),
  );

  it.live("continues a Done thread when a message reaches it", () =>
    Effect.gen(function* () {
      const started = yield* start(tool("report_result", { journal: "nothing to record", result: "Finished." }));
      yield* settle(started.missionId, (detail) => detail.thread.state === "Fulfilled");
      yield* send(started.threadId, "One more thing");
      const detail = yield* settle(started.missionId, (current) => lastText(current) === "Echo: One more thing");
      expect(detail.thread.state).toBe("Resting");
    }).pipe(Effect.provide(live())),
  );
});

describe("stopping and resuming", () => {
  it.live("stops only the selected thread; the threads beneath keep running", () =>
    Effect.gen(function* () {
      const started = yield* start(tool("open_thread", { request: "wait 400" }));
      const running = yield* settle(started.missionId, (detail) => detail.thread.state === "Waiting");
      const child = only(childrenOf(running, started.threadId));
      yield* call({ _tag: "StopThread", threadId: started.threadId });
      const after = yield* settle(started.missionId, (detail) => stateOf(detail, child.id) === "Resting");
      expect(after.thread.state).toBe("Resting");
    }).pipe(Effect.provide(live())),
  );

  it.live("starts a new turn when the owner sends after stopping", () =>
    Effect.gen(function* () {
      const started = yield* start("wait 60000");
      yield* settle(started.missionId, (detail) => detail.thread.state === "Underway");
      yield* call({ _tag: "StopThread", threadId: started.threadId });
      expect((yield* read(started.missionId)).thread.state).toBe("Resting");
      yield* send(started.threadId, "Are you there?");
      const resumed = yield* settle(started.missionId, (detail) => lastText(detail) === "Echo: Are you there?");
      expect(resumed.thread.state).toBe("Resting");
    }).pipe(Effect.provide(live())),
  );

  it.live("refuses Resume for a thread that is not Stopped", () =>
    Effect.gen(function* () {
      const started = yield* start("Begin");
      yield* settle(started.missionId, (detail) => detail.thread.state === "Resting");
      const failure = yield* failureOf({ _tag: "ResumeThread", threadId: started.threadId });
      expect(failure.kind).toBe("InvalidInput");
    }).pipe(Effect.provide(live())),
  );
});

describe("limiting threads", () => {
  it.live("refuses open_thread with the reason once 8 threads run in the mission", () =>
    Effect.gen(function* () {
      const opens = Array.from({ length: 8 }, (_, index) =>
        tool("open_thread", { request: `wait 600\nTask ${index}` }),
      );
      const started = yield* start(opens.join("\n"));
      const detail = yield* settle(started.missionId, (current) => lastText(current).startsWith("Echo:"));
      expect(childrenOf(detail, started.threadId)).toHaveLength(7);
      expect(lastText(detail)).toContain("8 threads are already running");
    }).pipe(Effect.provide(live())),
  );

  it.live("counts threads waiting on the owner inside their turn toward the 8 running", () =>
    Effect.gen(function* () {
      // An escape from the sandbox asks the owner; a sandboxed command would run unasked (CHG-0208).
      const push = `prompt Bash ${JSON.stringify({ command: "git push origin main", dangerouslyDisableSandbox: true })}`;
      const asking = Array.from({ length: 7 }, (_, index) =>
        tool("open_thread", { request: `${push}\nTask ${index}` }),
      );
      const started = yield* start([...asking, "wait 300", tool("open_thread", { request: "One more" })].join("\n"));
      const detail = yield* settle(started.missionId, (current) => lastText(current).startsWith("Echo:"));
      expect(detail.threads.filter((thread) => thread.state === "Attention")).toHaveLength(7);
      expect(childrenOf(detail, started.threadId)).toHaveLength(7);
      expect(lastText(detail)).toContain("8 threads are already running");
    }).pipe(Effect.provide(live())),
  );

  it.live("holds a message while 8 threads run and delivers it once one ends", () =>
    Effect.gen(function* () {
      const started = yield* start("Stand by");
      yield* settle(started.missionId, (detail) => detail.thread.state === "Resting");
      const busy = yield* open(started.threadId, "Ready");
      const held = yield* open(started.threadId, "Also ready");
      yield* settle(started.missionId, (detail) => detail.threads.every((thread) => thread.state === "Resting"));

      const opens = Array.from({ length: 6 }, (_, index) =>
        tool("open_thread", { request: `wait 400\nTask ${index}` }),
      );
      yield* send(started.threadId, `${opens.join("\n")}\nwait 400`);
      yield* send(busy.threadId, "wait 400");
      yield* settle(
        started.missionId,
        (detail) => detail.threads.filter((thread) => thread.state === "Underway").length === 8,
      );
      yield* send(held.threadId, "Queued while full");
      const full = yield* read(started.missionId, held.threadId);
      expect(full.thread).toMatchObject({ state: "Resting", waitingCount: 1 });
      yield* settle(started.missionId, (detail) => lastText(detail) === "Echo: Queued while full", held.threadId);
    }).pipe(Effect.provide(live())),
  );

  it.live("opens an errand from the quest and refuses nested errands", () =>
    Effect.gen(function* () {
      const started = yield* start("Top");
      const { threadId: parent } = yield* open(started.threadId, "Errand");
      const failure = yield* failureOf({
        _tag: "OpenThread",
        effort: "default",
        model: "default",
        parentThreadId: parent,
        requestId: "too-deep",
        shouldStartAnyway: false,
        text: "Nested errand",
      });
      expect(failure).toMatchObject({ kind: "InvalidInput" });
      expect(failure.message).toContain("quest conversation");
    }).pipe(Effect.provide(live())),
  );
});

describe("offering the owner a thread's actions", () => {
  it.live("offers Stop and in-turn sending while a thread works, and returns to Resting after Stop", () =>
    Effect.gen(function* () {
      const started = yield* start("wait 60000");
      const running = yield* settle(started.missionId, (current) => current.thread.state === "Underway");
      expect(running.thread.actions).toEqual({ canOpenBeneath: true, canResume: false, canStop: true, isInTurn: true });
      yield* call({ _tag: "StopThread", threadId: started.threadId });
      const stopped = yield* read(started.missionId);
      expect(stopped.thread.actions).toEqual({
        canOpenBeneath: true,
        canResume: false,
        canStop: false,
        isInTurn: false,
      });
    }).pipe(Effect.provide(live())),
  );
});
