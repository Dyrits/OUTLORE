import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  install,
  inWorld,
  openQuestionOf,
  replyOf,
  untilAsked,
  untilIdle,
  untilReplies,
} from "../fixtures/connectorWorld.ts";
import { listTools } from "../fixtures/mcp.ts";
import { receivedFor, recordingHarnessLayer } from "../fixtures/recordingHarness.ts";
import { call, send, startMission } from "../fixtures/service.ts";

type Turn = import("../../src/core/index.ts").TurnRequest;

const names = ["calendar__list-events", "calendar__create-event", "calendar__mystery"];
const qualified = (name: string) => `mcp__outlore__${name}`;

describe("what a harness is told of the connectors at a turn's start", () => {
  it.live(
    "lists the thread's connector tools, and lets Claude Code run them since each asks for itself in the gateway",
    () => {
      const received: Array<Turn> = [];
      return inWorld({ harness: recordingHarnessLayer(received) }, () =>
        Effect.gen(function* () {
          yield* install("calendar");
          const started = yield* startMission({ text: "Hello" });
          yield* untilIdle(started.missionId);
          const turn = yield* receivedFor(received, started.threadId);
          for (const name of names) {
            expect(turn.access.connectorTools).toContain(name);
            expect(turn.access.unaskedTools).toContain(qualified(name));
          }
          // The thread tools it already ran unasked are still named.
          expect(turn.access.unaskedTools).toContain(qualified("save_intel"));
        }),
      );
    },
  );

  it.live(
    "changes the tools it names at the next turn when a tool is switched off, which restarts a kept process",
    () => {
      const received: Array<Turn> = [];
      return inWorld({ harness: recordingHarnessLayer(received) }, () =>
        Effect.gen(function* () {
          yield* install("calendar");
          const started = yield* startMission({ text: "Hello" });
          yield* untilIdle(started.missionId);
          yield* call({ _tag: "SetConnectorTool", connectorId: "calendar", isOn: false, tool: "list-events" });
          yield* send(started.threadId, "Again");
          yield* untilReplies(started.missionId, 2);
          const turn = yield* receivedFor(received, started.threadId);
          expect(turn.access.connectorTools).not.toContain("calendar__list-events");
          expect(turn.access.unaskedTools).not.toContain(qualified("calendar__list-events"));
          expect(turn.access.connectorTools).toContain("calendar__create-event");
        }),
      );
    },
  );

  it.live(
    "keeps connectorTools in the restart key under Code Mode while leaving individual connector tools out of unaskedTools",
    () => {
      const received: Array<Turn> = [];
      return inWorld({ harness: recordingHarnessLayer(received) }, () =>
        Effect.gen(function* () {
          yield* install("calendar");
          yield* call({ _tag: "ChangeSettings", change: { shouldUseCodeMode: true } });
          const started = yield* startMission({ text: "Hello" });
          yield* untilIdle(started.missionId);
          const turn = yield* receivedFor(received, started.threadId);
          expect(turn.access.connectorTools).toEqual(expect.arrayContaining(names));
          expect(turn.access.unaskedTools.filter((name) => name.includes("calendar__"))).toEqual([]);
          expect(turn.access.unaskedTools).toContain(qualified("run_code"));
        }),
      );
    },
  );

  it.live(
    "changes connectorTools at the next turn under Code Mode when a connector is installed, restarting a kept process",
    () => {
      const received: Array<Turn> = [];
      return inWorld({ harness: recordingHarnessLayer(received) }, () =>
        Effect.gen(function* () {
          yield* call({ _tag: "ChangeSettings", change: { shouldUseCodeMode: true } });
          const started = yield* startMission({ text: "Hello" });
          yield* untilIdle(started.missionId);
          const first = yield* receivedFor(received, started.threadId);
          expect(first.access.connectorTools).toEqual([]);
          yield* install("calendar");
          yield* send(started.threadId, "Again");
          yield* untilReplies(started.missionId, 2);
          const second = yield* receivedFor(received, started.threadId);
          expect(second.access.connectorTools).toEqual(expect.arrayContaining(names));
          expect(second.access.unaskedTools.filter((name) => name.includes("calendar__"))).toEqual([]);
          expect(second.access.unaskedTools).toContain(qualified("run_code"));
        }),
      );
    },
  );
});

describe("the connectors under Code Mode", () => {
  const writeByCode = `call run_code ${JSON.stringify({ code: "async () => await connectors.calendar.create_event({ day: 'd', title: 't' })" })}`;
  const readByCode = `call run_code ${JSON.stringify({ code: "async () => (await connectors.calendar.list_events({ day: 'd' })).events.length" })}`;

  it.live(
    "declares the connector's tools in the code tool, lists none of them directly, and refuses a direct call",
    () =>
      inWorld({}, () =>
        Effect.gen(function* () {
          yield* install("calendar");
          yield* call({ _tag: "ChangeSettings", change: { shouldUseCodeMode: true } });
          const started = yield* startMission({ text: 'call calendar__list-events {"day":"d"}' });
          const done = yield* untilIdle(started.missionId);
          expect(replyOf(done)).toContain("Code Mode is on: call calendar__list-events from code");
          const tools = yield* listTools(started.threadId);
          expect(tools.map((tool) => tool.name)).not.toContain("calendar__list-events");
          expect(tools.find((tool) => tool.name === "run_code")?.description).toContain("connectors.calendar");
        }),
      ),
  );

  it.live("runs a read by code unasked and asks for a write while the code runs, as a direct call does", () =>
    inWorld({}, (world) =>
      Effect.gen(function* () {
        yield* install("calendar");
        yield* call({ _tag: "ChangeSettings", change: { shouldUseCodeMode: true } });
        const reading = yield* startMission({ text: readByCode });
        const read = yield* untilIdle(reading.missionId);
        expect(replyOf(read)).toBe("Echo: 1");
        expect(read.questions).toEqual([]);

        const writing = yield* startMission({ text: writeByCode });
        const asked = yield* untilAsked(writing.missionId);
        expect(openQuestionOf(asked)).toMatchObject({
          pattern: "calendar/create-event",
          summary: "Use Calendar: Create an event",
        });
        expect(world.received.calendar.filter((entry) => entry.tool === "create-event")).toEqual([]);
        yield* call({
          _tag: "AnswerQuestion",
          answer: "Allow",
          message: null,
          questionId: openQuestionOf(asked)?.id as never,
        });
        expect(replyOf(yield* untilIdle(writing.missionId))).toContain('"created"');
      }),
    ),
  );

  it.live(
    "fails a call inside the code when its connector is switched off, and a denial reaches the code as an error",
    () =>
      inWorld({}, (world) =>
        Effect.gen(function* () {
          yield* install("calendar");
          yield* call({ _tag: "ChangeSettings", change: { shouldUseCodeMode: true } });
          const off = yield* startMission({ text: writeByCode });
          yield* untilAsked(off.missionId);
          yield* call({
            _tag: "SetConnectorSwitch",
            choice: "Off",
            connectorId: "calendar",
            level: { _tag: "Global" },
          });
          const done = yield* untilIdle(off.missionId);
          expect(replyOf(done)).toContain("The code failed: Error: This connector is off for this thread.");
          yield* call({ _tag: "SetConnectorSwitch", choice: "On", connectorId: "calendar", level: { _tag: "Global" } });
          const denied = yield* startMission({ text: writeByCode });
          const asked = yield* untilAsked(denied.missionId);
          yield* call({
            _tag: "AnswerQuestion",
            answer: "Deny",
            message: "Not now",
            questionId: openQuestionOf(asked)?.id as never,
          });
          expect(replyOf(yield* untilIdle(denied.missionId))).toContain(
            "The code failed: Error: Denied by the owner: Not now",
          );
          expect(world.received.calendar).toEqual([]);
        }),
      ),
  );
});
