import { describe, expect, it } from "@effect/vitest";
import { Deferred, Effect, Fiber } from "effect";
import { maxWorkStartsPerRun } from "../../src/connectors/codeMode.ts";
import { noConnectorsLayer } from "../../src/connectors/gateway.ts";
import { Endpoints } from "../../src/core/index.ts";
import { isCoveredByCodeMode, threadTools } from "../../src/work/threadTools.ts";
import { fakeGateway, serviceWithGateway } from "../fixtures/connectors.ts";
import { approvedCall, startIdle } from "../fixtures/guildmaster.ts";
import { callTool, listToolNames, listTools } from "../fixtures/mcp.ts";
import { call, fixture, read, send, settle, start } from "../fixtures/service.ts";
import { folderIn } from "../work/guildmasterHelpers.ts";

const turnCodeModeOn = call({ _tag: "ChangeSettings", change: { shouldUseCodeMode: true } });
const turnCodeModeOff = call({ _tag: "ChangeSettings", change: { shouldUseCodeMode: false } });

const textOf = (answer: { result: { content: ReadonlyArray<{ text: string }> } }) =>
  answer.result.content.map((part) => part.text).join("");

/** The thread tools Code Mode covers, which a thread then lists in the code and not as tools. */
// The phone tools are covered too, but listed only while a phone is connected with their group on (phone-control).
const coveredNames = Object.keys(threadTools)
  .filter(isCoveredByCodeMode)
  .filter((name) => !name.startsWith("phone_"));
// A Claude Code thread, which the fake harness runs as, is also listed `answer_prompt`, which stays direct.
const directNames = ["answer_prompt", "report_result", "request_approval", "set_mission_title", "suggest_mission"];

/** Runs a test body on a service with the fake gateway, handing the body the gateway's controls. */
const withGateway = <A, E, R>(body: (gateway: Effect.Success<typeof fakeGateway>) => Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const gateway = yield* fakeGateway;
    return yield* body(gateway).pipe(Effect.provide(serviceWithGateway(gateway.layer)));
  });

describe("listing tools", () => {
  it.live("lists each connector tool and each thread tool, and no code tool, while Code Mode is off", () =>
    withGateway(() =>
      Effect.gen(function* () {
        const { threadId } = yield* start();
        const names = yield* listToolNames(threadId);
        expect(names).toContain("calendar__list-events");
        expect(names).toContain("calendar__create-event");
        expect(names).toContain("save_intel");
        expect(names).toContain("open_thread");
        expect(names).not.toContain("run_code");
      }),
    ),
  );

  it.live("lists one code tool and the direct tools, declaring the covered tools, while Code Mode is on", () =>
    withGateway(() =>
      Effect.gen(function* () {
        yield* turnCodeModeOn;
        const { threadId } = yield* start();
        const tools = yield* listTools(threadId);
        const names = tools.map((tool) => tool.name);
        expect(names).toContain("run_code");
        for (const direct of directNames) expect(names).toContain(direct);
        for (const covered of coveredNames) expect(names).not.toContain(covered);
        expect(names).not.toContain("calendar__list-events");
        expect(names).toHaveLength(directNames.length + 1);
        const description = tools.find((tool) => tool.name === "run_code")?.description ?? "";
        // Outlore's own tools, as `outlore.<tool>`, with their descriptions and argument types.
        expect(description).toContain("declare const outlore: {");
        expect(description).toContain("save_intel(input: {");
        expect(description).toContain("open_thread(input: {");
        expect(description).toContain("/** The ids of the lore entries you relied on");
        // The connectors' tools, as `connectors.<connector>.<tool>`.
        expect(description).toContain("declare const connectors: {");
        expect(description).toContain("/** Lists the events of a day. */");
        expect(description).toContain("list_events(input: {");
        expect(description).toContain("/** The day, as YYYY-MM-DD. */");
        expect(description).toContain("create_event(input: {");
        // What stays direct is named, and the caps are told.
        expect(description).toContain(`${directNames.join(", ")} stay listed`);
        expect(description).toContain(`at most ${maxWorkStartsPerRun} calls that start or redirect other work`);
      }),
    ),
  );

  it.live("still offers the code tool for Outlore's own tools when the thread has no connector tool", () =>
    Effect.gen(function* () {
      yield* turnCodeModeOn;
      const { threadId } = yield* start();
      const tools = yield* listTools(threadId);
      expect(tools.map((tool) => tool.name)).toContain("run_code");
      const description = tools.find((tool) => tool.name === "run_code")?.description ?? "";
      expect(description).toContain("declare const outlore: {");
      expect(description).not.toContain("declare const connectors");
    }).pipe(Effect.provide(serviceWithGateway(noConnectorsLayer))),
  );

  // The aim is fewer tool definitions in the thread's context (Cloudflare's Code Mode). Measured on 2026-11-18 with no
  // connector: the listing's JSON, which is what the harness hands the model, is 20,077 characters with Code Mode off and
  // 18,619 with it on, 7% less: the tools' long descriptions stay in the code tool's declarations, so most of the
  // gain is expected from chained calls and results that never enter the context, which a test cannot measure.
  it.live("does not make the listing a thread is given larger than the one it has with Code Mode off", () =>
    Effect.gen(function* () {
      const first = yield* start();
      const off = JSON.stringify(yield* listTools(first.threadId)).length;
      yield* turnCodeModeOn;
      const second = yield* start();
      const on = JSON.stringify(yield* listTools(second.threadId)).length;
      expect(on).toBeLessThan(off);
    }).pipe(Effect.provide(serviceWithGateway(noConnectorsLayer))),
  );
});

describe("calling connector tools from code", () => {
  it.live("gives the same result and makes the same gateway call as calling the tool directly", () =>
    withGateway((gateway) =>
      Effect.gen(function* () {
        const direct = yield* start();
        const asked = yield* callTool(direct.threadId, "calendar__list-events", { day: "2026-11-17" });
        yield* turnCodeModeOn;
        const coded = yield* start();
        const answered = yield* callTool(coded.threadId, "run_code", {
          code: "async () => connectors.calendar.list_events({ day: '2026-11-17' })",
        });
        expect(answered.result.isError).toBe(false);
        expect(JSON.parse(textOf(answered))).toEqual(JSON.parse(textOf(asked)));
        expect(gateway.calls).toEqual([
          { args: { day: "2026-11-17" }, name: "calendar__list-events", threadId: direct.threadId },
          { args: { day: "2026-11-17" }, name: "calendar__list-events", threadId: coded.threadId },
        ]);
      }),
    ),
  );

  it.live("waits for the owner's answer to a write while the code runs, then goes on", () =>
    withGateway((gateway) =>
      Effect.gen(function* () {
        yield* turnCodeModeOn;
        const { threadId } = yield* start();
        const running = yield* Effect.forkChild(
          callTool(threadId, "run_code", {
            code: "const made = await connectors.calendar.create_event({ day: '2026-11-18', title: 'Review' });\nconsole.log('made');\nreturn made.created.title;",
          }),
        );
        const asked = yield* Deferred.await(gateway.asked);
        expect(asked.args).toEqual({ day: "2026-11-18", title: "Review" });
        expect(running.pollUnsafe()).toBeUndefined();
        yield* Deferred.succeed(gateway.answer, true);
        const answered = yield* Fiber.join(running);
        expect(answered.result.isError).toBe(false);
        expect(textOf(answered)).toBe("Review\n\nLogged:\nmade");
      }),
    ),
  );

  it.live("throws a denied or switched-off call into the code as an Error", () =>
    withGateway((gateway) =>
      Effect.gen(function* () {
        yield* turnCodeModeOn;
        yield* Deferred.succeed(gateway.answer, false);
        const { threadId } = yield* start();
        const caught = yield* callTool(threadId, "run_code", {
          code: "async () => { const reasons = []; for (const call of [() => connectors.calendar.create_event({ day: 'd', title: 't' }), () => connectors.calendar.delete_event({ id: 'e1' })]) { try { await call(); } catch (error) { reasons.push(error.message); } } return reasons; }",
        });
        expect(JSON.parse(textOf(caught))).toEqual([
          "The owner denied this action.",
          "This connector tool is switched off for this thread.",
        ]);
        const uncaught = yield* callTool(threadId, "run_code", {
          code: "async () => connectors.calendar.delete_event({ id: 'e1' })",
        });
        expect(uncaught.result.isError).toBe(true);
        expect(textOf(uncaught)).toBe("The code failed: Error: This connector tool is switched off for this thread.");
      }),
    ),
  );
});

describe("calling Outlore's own tools from code", () => {
  it.live("reaches the covered tools as `outlore.<tool>`, and nothing else", () =>
    Effect.gen(function* () {
      yield* turnCodeModeOn;
      const { threadId } = yield* start();
      const directChecks = directNames.map((name) => `typeof outlore.${name}`).join(", ");
      const answered = yield* callTool(threadId, "run_code", {
        code: `async () => [typeof fetch, typeof require, typeof process, Object.keys(connectors), Object.keys(outlore).sort(), ${directChecks}]`,
      });
      expect(JSON.parse(textOf(answered))).toEqual([
        "undefined",
        "undefined",
        "undefined",
        [],
        [...coveredNames].sort(),
        ...directNames.map(() => "undefined"),
      ]);
    }).pipe(Effect.provide(serviceWithGateway(noConnectorsLayer))),
  );

  it.live("chains several of Outlore's tools in one call", () =>
    Effect.gen(function* () {
      yield* turnCodeModeOn;
      const { threadId } = yield* start();
      const answered = yield* callTool(threadId, "run_code", {
        code: "async () => { await outlore.save_intel({ kind: 'fact', scope: 'thread', text: 'Code Mode chains calls.' }); const found = await outlore.search_intel({ query: 'chains' }); const journal = await outlore.read_journal({}); return [typeof found, found.includes('Code Mode chains calls.'), typeof journal]; }",
      });
      expect(answered.result.isError).toBe(false);
      expect(JSON.parse(textOf(answered))).toEqual(["string", true, "string"]);
    }).pipe(Effect.provide(serviceWithGateway(noConnectorsLayer))),
  );

  it.live("gives the same answer, and the same refusal, as calling the tool directly", () =>
    Effect.gen(function* () {
      const direct = yield* start();
      const refused = yield* callTool(direct.threadId, "create_ritual", {
        instruction: "",
        schedule: { _tag: "Daily", time: "07:00" },
        title: "Ping",
      });
      const invalid = yield* callTool(direct.threadId, "send_thread_message", {});
      yield* turnCodeModeOn;
      const coded = yield* start();
      const fromCode = yield* callTool(coded.threadId, "run_code", {
        code: "async () => { const reasons = []; for (const call of [() => outlore.create_ritual({ instruction: '', schedule: { _tag: 'Daily', time: '07:00' }, title: 'Ping' }), () => outlore.send_thread_message({})]) { try { await call(); } catch (error) { reasons.push(error.message); } } return reasons; }",
      });
      expect(textOf(refused)).toBe("Give an instruction and a title.");
      expect(textOf(invalid)).toBe("Invalid arguments: give to and text.");
      expect(JSON.parse(textOf(fromCode))).toEqual([textOf(refused), textOf(invalid)]);
    }).pipe(Effect.provide(serviceWithGateway(noConnectorsLayer))),
  );

  it.live("refuses a direct call to a covered tool while Code Mode is on, and leaves the direct tools callable", () =>
    withGateway((gateway) =>
      Effect.gen(function* () {
        const off = yield* start();
        expect(textOf(yield* callTool(off.threadId, "run_code", { code: "async () => 1" }))).toBe(
          "Unknown tool: run_code",
        );
        yield* turnCodeModeOn;
        const { threadId } = yield* start();
        const covered = yield* callTool(threadId, "save_intel", { kind: "fact", scope: "thread", text: "x" });
        expect(covered.result.isError).toBe(true);
        expect(textOf(covered)).toBe("Code Mode is on: call save_intel from code, with run_code.");
        const connector = yield* callTool(threadId, "calendar__list-events", { day: "2026-11-17" });
        expect(textOf(connector)).toBe("Code Mode is on: call calendar__list-events from code, with run_code.");
        expect(gateway.calls).toEqual([]);
        // A direct tool reaches its own handler: its own answer, not Code Mode's refusal.
        expect(textOf(yield* callTool(threadId, "report_result", {}))).toContain("Not reported: give result");
        expect(textOf(yield* callTool(threadId, "set_mission_title", { title: "Named under Code Mode" }))).toBe(
          'Named the mission "Named under Code Mode".',
        );
      }),
    ),
  );

  it.live("refuses a call without code", () =>
    Effect.gen(function* () {
      yield* turnCodeModeOn;
      const { threadId } = yield* start();
      const answered = yield* callTool(threadId, "run_code", {});
      expect(answered.result.isError).toBe(true);
      expect(textOf(answered)).toBe("Invalid arguments: give code, a JavaScript async arrow function.");
    }).pipe(Effect.provide(serviceWithGateway(noConnectorsLayer))),
  );

  it.live("stops the calls that start or redirect work after the cap, and counts the refused ones", () =>
    Effect.gen(function* () {
      yield* turnCodeModeOn;
      const { threadId } = yield* start();
      const answered = yield* callTool(threadId, "run_code", {
        code: "async () => { const reasons = []; for (let index = 0; index < 7; index++) { try { await outlore.send_thread_message({ text: 'hi', to: 'nobody' }); reasons.push('sent'); } catch (error) { reasons.push(error.message); } } return reasons; }",
      });
      const reasons: Array<string> = JSON.parse(textOf(answered));
      const cap = `Not done: one run may make at most ${maxWorkStartsPerRun} calls that start or redirect other work. Go on in another run.`;
      expect(reasons).toHaveLength(7);
      expect(reasons.slice(0, maxWorkStartsPerRun).filter((reason) => reason === cap)).toEqual([]);
      expect(reasons.slice(maxWorkStartsPerRun)).toEqual([cap, cap]);
      // A tool that does not start work is not counted.
      const reads = yield* callTool(threadId, "run_code", {
        code: "async () => { for (let index = 0; index < 20; index++) await outlore.read_journal({}); return 'done'; }",
      });
      expect(textOf(reads)).toBe("done");
    }).pipe(Effect.provide(serviceWithGateway(noConnectorsLayer))),
  );
});

describe("a tool that asks the owner, called from code", () => {
  it.live("waits for the owner's answer while the code runs, then goes on", () => {
    const { directory, layer } = fixture();
    return Effect.gen(function* () {
      yield* turnCodeModeOn;
      const place = yield* startIdle("Existing work", folderIn(directory, "app"));
      const code = `async () => outlore.create_ritual({ instruction: 'Say hello to me', schedule: { _tag: 'Hourly', hours: 1 }, title: 'Hourly hello' })`;
      const text = yield* approvedCall(place, "run_code", { code });
      expect(text).toContain('Created the Ritual "Hourly hello"');
      expect(yield* call({ _tag: "ListRituals" })).toMatchObject([{ originMissionId: place.missionId }]);
      const edit = 'async () => outlore.edit_ritual({ instruction: "Wave hello", ritual: "Hourly hello" })';
      expect(yield* approvedCall(place, "run_code", { code: edit })).toContain('Edited the Ritual "Hourly hello"');
      expect(yield* call({ _tag: "ListRituals" })).toMatchObject([{ instruction: "Wave hello" }]);
    }).pipe(Effect.provide(layer));
  });
});

/** Waits until the thread's turn has held Code Mode as given, which it does when the turn starts. */
const awaitHeld = (threadId: string, isOn: boolean) =>
  Effect.gen(function* () {
    const endpoints = yield* Endpoints;
    for (let attempt = 0; attempt < 400; attempt++) {
      if (endpoints.heldCodeMode(threadId) === isOn) return;
      yield* Effect.sleep("10 millis");
    }
    return yield* Effect.die(new Error(`The turn never held Code Mode ${isOn ? "on" : "off"}.`));
  });

describe("when the setting takes effect", () => {
  it.live("holds the setting a turn started with, and applies a change from the next turn", () =>
    Effect.gen(function* () {
      const started = yield* start("wait 400");
      yield* awaitHeld(started.threadId, false);
      yield* turnCodeModeOn;
      // The turn underway was listed its tools with Code Mode off, so its calls keep the answers of that listing.
      const duringTurn = yield* listToolNames(started.threadId);
      expect(duringTurn).toContain("save_intel");
      expect(duringTurn).not.toContain("run_code");
      const saved = yield* callTool(started.threadId, "save_intel", { kind: "fact", scope: "thread", text: "kept" });
      expect(saved.result.isError).toBe(false);
      expect(textOf(yield* callTool(started.threadId, "run_code", { code: "async () => 1" }))).toBe(
        "Unknown tool: run_code",
      );
      yield* settle(started.missionId, (detail) => detail.thread.state === "Resting", started.threadId);
      // The next turn starts with Code Mode on.
      yield* send(started.threadId, "wait 2000");
      yield* awaitHeld(started.threadId, true);
      const names = yield* listToolNames(started.threadId);
      expect(names).toContain("run_code");
      expect(names).not.toContain("save_intel");
      // And turning it off again does not reach into the turn underway either.
      yield* turnCodeModeOff;
      expect(yield* listToolNames(started.threadId)).toContain("run_code");
      expect((yield* read(started.missionId, started.threadId)).thread.state).toBe("Underway");
    }).pipe(Effect.provide(serviceWithGateway(noConnectorsLayer))),
  );
});
