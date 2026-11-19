import { describe, expect, it } from "@effect/vitest";
import type { HarnessName, MissionDetail } from "@outlore/contracts";
import { Effect } from "effect";
import { testSecret } from "../fixtures/connectorBackend.ts";
import {
  install,
  inWorld,
  openQuestionOf,
  replyOf,
  untilAsked,
  untilIdle,
  untilReplies,
} from "../fixtures/connectorWorld.ts";
import { call, read, send, startMission } from "../fixtures/service.ts";

const harnesses: ReadonlyArray<HarnessName> = ["claude", "codex", "opencode"];
const day = { day: "2026-11-19" };
const use = (name: string, args: object = {}) => `call ${name} ${JSON.stringify(args)}`;
const answerOpen = (detail: MissionDetail, answer: "Allow" | "AlwaysAllow" | "Deny", message: string | null = null) => {
  const question = openQuestionOf(detail);
  if (question === null) return Effect.die("no open question");
  return call({ _tag: "AnswerQuestion", answer, message, questionId: question.id });
};

/** Waits until a fake server has been called this many times, the way a test sees a call underway. */
const untilCalled = (received: ReadonlyArray<unknown>, count: number) =>
  Effect.gen(function* () {
    for (let attempt = 0; attempt < 400 && received.length < count; attempt++) yield* Effect.sleep("10 millis");
    expect(received.length).toBeGreaterThanOrEqual(count);
  });

/** Starts a quest on the harness whose first turn carries the script. */
const startOn = (harness: HarnessName, text: string) => startMission({ harness, text });

describe.each(harnesses)("a thread on %s calling a connector's tools", (harness) => {
  it.live("runs a read-only tool without a question, with the connector's key given by the Vault alone", () =>
    inWorld({}, (world) =>
      Effect.gen(function* () {
        yield* install("calendar");
        const started = yield* startOn(harness, use("calendar__list-events", day));
        const detail = yield* untilIdle(started.missionId);
        expect(replyOf(detail)).toContain("Standup");
        expect(detail.questions).toEqual([]);
        expect(world.received.calendar).toEqual([{ args: day, secret: testSecret, tool: "list-events" }]);
      }),
    ),
  );

  it.live("asks once per call for a write, in the catalog's words, and runs it only when allowed", () =>
    inWorld({}, (world) =>
      Effect.gen(function* () {
        yield* install("calendar");
        const started = yield* startOn(harness, use("calendar__create-event", { day: "d", title: "Plan" }));
        const asked = yield* untilAsked(started.missionId);
        expect(openQuestionOf(asked)).toMatchObject({
          pattern: "calendar/create-event",
          permission: "Use a connector's tool",
          source: "Thread",
          summary: "Use Calendar: Create an event",
        });
        expect(openQuestionOf(asked)?.details).toContain('"title": "Plan"');
        expect(world.received.calendar).toEqual([]);
        yield* answerOpen(asked, "Allow");
        const done = yield* untilIdle(started.missionId);
        expect(replyOf(done)).toContain('"created"');
        expect(world.received.calendar).toHaveLength(1);
        // Allow covers this call alone: the next one asks again.
        yield* send(started.threadId, use("calendar__create-event", { day: "d", title: "Again" }));
        const again = yield* untilAsked(started.missionId);
        expect(openQuestionOf(again)?.details).toContain("Again");
      }),
    ),
  );

  it.live("tells the thread a denied write was not approved and never calls the server", () =>
    inWorld({}, (world) =>
      Effect.gen(function* () {
        yield* install("calendar");
        const started = yield* startOn(harness, use("calendar__delete-event", { id: "e1" }));
        yield* answerOpen(yield* untilAsked(started.missionId), "Deny", "Not that one");
        const done = yield* untilIdle(started.missionId);
        expect(replyOf(done)).toContain("Denied by the owner: Not that one");
        expect(world.received.calendar).toEqual([]);
      }),
    ),
  );

  it.live("lets Always allow cover that tool of that connector only, in the thread's quest", () =>
    inWorld({}, (world) =>
      Effect.gen(function* () {
        yield* install("calendar");
        const started = yield* startOn(harness, use("calendar__create-event", { day: "d", title: "One" }));
        yield* answerOpen(yield* untilAsked(started.missionId), "AlwaysAllow");
        yield* untilIdle(started.missionId);
        const permissions = (yield* call({ _tag: "ReadPermissions", missionId: started.missionId })).permissions;
        expect(permissions).toHaveLength(1);
        expect(permissions[0]).toMatchObject({ pattern: "calendar/create-event", sentence: "Use a connector's tool" });
        // The same tool runs unasked from now on.
        yield* send(started.threadId, use("calendar__create-event", { day: "d", title: "Two" }));
        yield* untilReplies(started.missionId, 2);
        expect(world.received.calendar).toHaveLength(2);
        // Another tool of the same connector still asks.
        yield* send(started.threadId, use("calendar__delete-event", { id: "e1" }));
        const other = yield* untilAsked(started.missionId);
        expect(openQuestionOf(other)?.pattern).toBe("calendar/delete-event");
        yield* answerOpen(other, "Deny");
        yield* untilReplies(started.missionId, 3);
        // And a command named like the permission's pattern is no covered action: the permissions are kinds apart.
        yield* send(started.threadId, `ask ${JSON.stringify({ action: "Run it", command: "calendar/create-event" })}`);
        expect(openQuestionOf(yield* untilAsked(started.missionId))?.permission).toBe("Run this exact command");
      }),
    ),
  );

  it.live("asks about a tool the catalog does not name, every call, by the tool's own exact name", () =>
    inWorld({}, (world) =>
      Effect.gen(function* () {
        yield* install("calendar");
        const started = yield* startOn(harness, use("calendar__mystery"));
        const asked = openQuestionOf(yield* untilAsked(started.missionId));
        expect(asked?.pattern).toBe("calendar/mystery");
        expect(asked?.summary).toContain("Outlore does not know what it changes");
        yield* answerOpen(yield* read(started.missionId), "Allow");
        yield* untilIdle(started.missionId);
        expect(world.received.calendar.map((received) => received.tool)).toEqual(["mystery"]);
      }),
    ),
  );

  it.live("asks about every call of a connector whose tools the catalog names none of, as Composio's", () =>
    inWorld({}, (world) =>
      Effect.gen(function* () {
        yield* install("unnamed_service");
        const started = yield* startOn(harness, use("unnamed_service__list-events", day));
        expect(openQuestionOf(yield* untilAsked(started.missionId))?.pattern).toBe("unnamed_service/list-events");
        yield* answerOpen(yield* read(started.missionId), "AlwaysAllow");
        yield* untilIdle(started.missionId);
        // Only a standing permission for that tool lets it run unasked.
        yield* send(started.threadId, use("unnamed_service__list-events", day));
        yield* untilReplies(started.missionId, 2);
        expect(world.received.unnamed_service).toHaveLength(2);
        yield* send(started.threadId, use("unnamed_service__create-event", { day: "d", title: "t" }));
        expect(openQuestionOf(yield* untilAsked(started.missionId))?.pattern).toBe("unnamed_service/create-event");
      }),
    ),
  );

  it.live(
    "answers a tool no connector offers as unknown, and one of a connector that is not installed as off for the thread",
    () =>
      inWorld({}, () =>
        Effect.gen(function* () {
          yield* install("calendar");
          const started = yield* startOn(
            harness,
            `${use("calendar__nothing")}\n${use("applefake__list-events")}\n${use("nope__x")}`,
          );
          const done = yield* untilIdle(started.missionId);
          expect(replyOf(done)).toContain("Unknown tool: calendar__nothing");
          expect(replyOf(done)).toContain(
            "Unknown tool: calendar__nothing | This connector is off for this thread. | Unknown tool: nope__x",
          );
          expect(replyOf(done)).toContain("Unknown tool: nope__x");
        }),
      ),
  );
});

describe.each(harnesses)("a connector that fails for a thread on %s", (harness) => {
  it.live("warns, marks the connector Needs connecting for everyone, and lets the turn carry on without it", () =>
    inWorld({}, (world) =>
      Effect.gen(function* () {
        yield* install("calendar");
        const other = yield* startMission({ text: "Hello" });
        yield* untilIdle(other.missionId);
        const started = yield* startOn(
          harness,
          `${use("calendar__refused-read")}\n${use("calendar__list-events", day)}`,
        );
        const done = yield* untilIdle(started.missionId);
        expect(replyOf(done)).toContain("marked Needs connecting");
        // The turn went on: its second call, to a connector now unavailable to it, was answered, not lost.
        expect(replyOf(done)).toContain("This connector is off for this thread.");
        expect(done.handovers.map((line) => line.text)).toEqual([
          "Calendar needs connecting again, so this turn goes on without it.",
        ]);
        const [card] = (yield* call({ _tag: "ListConnectors" })).filter((entry) => entry.id === "calendar");
        expect(card).toMatchObject({
          needs: "Calendar refused its sign-in or permission. Connect it again.",
          state: "NeedsConnecting",
        });
        expect(world.received.calendar).toHaveLength(1);
        // Nobody is given its tools now, and the upstream's own words appear nowhere.
        expect(JSON.stringify([done, card])).not.toContain("UPSTREAM");
        yield* send(other.threadId, "Hi");
        yield* untilReplies(other.missionId, 2);
      }),
    ),
  );

  it.live("warns for an unreachable server without marking it, and retries a read once and a write never", () =>
    inWorld({}, (world) =>
      Effect.gen(function* () {
        yield* install("calendar");
        const started = yield* startOn(harness, use("calendar__unreachable-read"));
        const done = yield* untilIdle(started.missionId);
        expect(replyOf(done)).toContain("could not be reached");
        expect(done.handovers.map((line) => line.text)).toEqual([
          "Calendar could not be reached, so this turn goes on without it.",
        ]);
        expect(world.received.calendar.map((received) => received.tool)).toEqual([
          "unreachable-read",
          "unreachable-read",
        ]);
        const [card] = (yield* call({ _tag: "ListConnectors" })).filter((entry) => entry.id === "calendar");
        expect(card).toMatchObject({ needs: null, state: "Ready" });
        world.received.calendar.length = 0;
        yield* send(started.threadId, use("calendar__unreachable-write"));
        yield* answerOpen(yield* untilAsked(started.missionId), "Allow");
        yield* untilReplies(started.missionId, 2);
        expect(world.received.calendar.map((received) => received.tool)).toEqual(["unreachable-write"]);
      }),
    ),
  );

  it.live("answers a thread's own bad arguments with a fixed sentence and leaves the connector as it was", () =>
    inWorld({}, () =>
      Effect.gen(function* () {
        yield* install("calendar");
        const started = yield* startOn(harness, `${use("calendar__bad-read")}\n${use("calendar__broken-read")}`);
        const done = yield* untilIdle(started.missionId);
        expect(replyOf(done)).toContain("did not accept these arguments");
        expect(replyOf(done)).toContain("could not do this");
        expect(done.handovers).toEqual([]);
        expect(replyOf(done)).not.toContain("UPSTREAM");
        const [card] = (yield* call({ _tag: "ListConnectors" })).filter((entry) => entry.id === "calendar");
        expect(card).toMatchObject({ needs: null, state: "Ready" });
      }),
    ),
  );
});

describe.each(harnesses)("switching a connector off while a thread on %s is using it", (harness) => {
  it.live("stops a read underway at once and tells the thread the connector is off for it", () =>
    inWorld({}, (world) =>
      Effect.gen(function* () {
        yield* install("calendar");
        const started = yield* startOn(harness, use("calendar__wait-read"));
        yield* untilCalled(world.received.calendar, 1);
        yield* call({ _tag: "SetConnectorSwitch", choice: "Off", connectorId: "calendar", level: { _tag: "Global" } });
        const done = yield* untilIdle(started.missionId);
        expect(replyOf(done)).toContain("This connector is off for this thread.");
        expect(replyOf(done)).not.toContain("waited");
      }),
    ),
  );

  it.live(
    "stops a write that reached the server, saying the action may already have happened, and does not retry it",
    () =>
      inWorld({}, (world) =>
        Effect.gen(function* () {
          yield* install("calendar");
          const started = yield* startOn(harness, use("calendar__wait-write"));
          yield* answerOpen(yield* untilAsked(started.missionId), "Allow");
          yield* untilCalled(world.received.calendar, 1);
          yield* call({ _tag: "SetConnectorTool", connectorId: "calendar", isOn: false, tool: "wait-write" });
          const done = yield* untilIdle(started.missionId);
          expect(replyOf(done)).toContain(
            "Stopped: this connector is off for this thread. The action may already have happened.",
          );
          expect(world.received.calendar).toHaveLength(1);
        }),
      ),
  );

  it.live("withdraws the question a write waits on and never runs it", () =>
    inWorld({}, (world) =>
      Effect.gen(function* () {
        yield* install("calendar");
        const started = yield* startOn(harness, use("calendar__create-event", { day: "d", title: "t" }));
        yield* untilAsked(started.missionId);
        yield* call({
          _tag: "SetConnectorSwitch",
          choice: "Off",
          connectorId: "calendar",
          level: { _tag: "Quest", missionId: started.missionId },
        });
        const done = yield* untilIdle(started.missionId);
        expect(replyOf(done)).toContain("This connector is off for this thread.");
        expect(done.questions.map((question) => question.outcome)).toEqual(["Withdrawn"]);
        expect(world.received.calendar).toEqual([]);
      }),
    ),
  );

  it.live(
    "keeps a tool off for the rest of the turn once switched off and on again, and applies a switch on at the next turn",
    () =>
      inWorld({}, () =>
        Effect.gen(function* () {
          yield* install("calendar");
          // Off at the turn's start: the snapshot lacks the tool, and switching on during the turn does not add it.
          yield* call({ _tag: "SetConnectorTool", connectorId: "calendar", isOn: false, tool: "list-events" });
          const started = yield* startOn(harness, `wait 300\n${use("calendar__list-events", day)}`);
          yield* call({ _tag: "SetConnectorTool", connectorId: "calendar", isOn: true, tool: "list-events" });
          const first = yield* untilIdle(started.missionId);
          expect(replyOf(first)).toContain("This connector is off for this thread.");
          yield* send(started.threadId, use("calendar__list-events", day));
          const second = yield* untilReplies(started.missionId, 2);
          expect(replyOf(second)).toContain("Standup");
        }),
      ),
  );

  it.live("keeps a tool off for the rest of the turn when it is switched off and on during the turn", () =>
    inWorld({}, () =>
      Effect.gen(function* () {
        yield* install("calendar");
        const started = yield* startOn(harness, `wait 300\n${use("calendar__list-events", day)}`);
        yield* call({ _tag: "SetConnectorTool", connectorId: "calendar", isOn: false, tool: "list-events" });
        yield* call({ _tag: "SetConnectorTool", connectorId: "calendar", isOn: true, tool: "list-events" });
        const first = yield* untilIdle(started.missionId);
        expect(replyOf(first)).toContain("This connector is off for this thread.");
        yield* send(started.threadId, use("calendar__list-events", day));
        expect(replyOf(yield* untilReplies(started.missionId, 2))).toContain("Standup");
      }),
    ),
  );
});

describe("a secret a server echoes", () => {
  it.live("reaches no thread, conversation, question, permission, connector card or lore, in any spelling", () =>
    inWorld({}, () =>
      Effect.gen(function* () {
        yield* install("calendar");
        const started = yield* startMission({ text: use("calendar__echo-read") });
        const done = yield* untilIdle(started.missionId);
        expect(replyOf(done)).toContain("key=[redacted] url=[redacted] b64=[redacted]");
        const spellings = [testSecret, encodeURIComponent(testSecret), Buffer.from(testSecret).toString("base64")];
        const everything = JSON.stringify([
          yield* read(started.missionId),
          yield* call({ _tag: "ListConnectors" }),
          yield* call({ _tag: "ReadPermissions", missionId: null }),
          yield* call({ _tag: "ListOpenQuestions" }),
          yield* call({ _tag: "ListIntel", scope: null, state: null, threadId: null }),
        ]);
        for (const spelling of spellings) expect(everything).not.toContain(spelling);
      }),
    ),
  );
});
