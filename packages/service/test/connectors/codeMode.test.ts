import { describe, expect, it } from "@effect/vitest";
import { Deferred, Effect, Fiber } from "effect";
import { noConnectorsLayer } from "../../src/connectors/index.ts";
import { fakeGateway, serviceWithGateway } from "../fixtures/connectors.ts";
import { callTool, listToolNames, listTools } from "../fixtures/mcp.ts";
import { call, start } from "../fixtures/service.ts";

const turnCodeModeOn = call({ _tag: "ChangeSettings", change: { shouldUseCodeMode: true } });

const textOf = (answer: { result: { content: ReadonlyArray<{ text: string }> } }) =>
  answer.result.content.map((part) => part.text).join("");

/** Runs a test body on a service with the fake gateway, handing the body the gateway's controls. */
const withGateway = <A, E, R>(body: (gateway: Effect.Success<typeof fakeGateway>) => Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const gateway = yield* fakeGateway;
    return yield* body(gateway).pipe(Effect.provide(serviceWithGateway(gateway.layer)));
  });

describe("listing connector tools", () => {
  it.live("lists each connector tool, and no code tool, while Code Mode is off", () =>
    withGateway(() =>
      Effect.gen(function* () {
        const { threadId } = yield* start();
        const names = yield* listToolNames(threadId);
        expect(names).toContain("calendar__list-events");
        expect(names).toContain("calendar__create-event");
        expect(names).not.toContain("run_connector_code");
      }),
    ),
  );

  it.live("lists one code tool, declaring the connector tools, instead of them while Code Mode is on", () =>
    withGateway(() =>
      Effect.gen(function* () {
        yield* turnCodeModeOn;
        const { threadId } = yield* start();
        const tools = yield* listTools(threadId);
        const names = tools.map((tool) => tool.name);
        expect(names).not.toContain("calendar__list-events");
        expect(names).toContain("run_connector_code");
        expect(names).toContain("save_intel");
        const description = tools.find((tool) => tool.name === "run_connector_code")?.description ?? "";
        expect(description).toContain("/** Lists the events of a day. */");
        expect(description).toContain("list_events(input: {");
        expect(description).toContain("/** The day, as YYYY-MM-DD. */");
        expect(description).toContain("day: string;");
        expect(description).toContain("create_event(input: {");
      }),
    ),
  );

  it.live("lists no code tool when the thread has no connector tool", () =>
    Effect.gen(function* () {
      yield* turnCodeModeOn;
      const { threadId } = yield* start();
      expect(yield* listToolNames(threadId)).not.toContain("run_connector_code");
    }).pipe(Effect.provide(serviceWithGateway(noConnectorsLayer))),
  );
});

describe("calling connector tools from code", () => {
  it.live("gives the same result and makes the same gateway call as calling the tool directly", () =>
    withGateway((gateway) =>
      Effect.gen(function* () {
        const { threadId } = yield* start();
        const direct = yield* callTool(threadId, "calendar__list-events", { day: "2026-11-17" });
        yield* turnCodeModeOn;
        const coded = yield* callTool(threadId, "run_connector_code", {
          code: "async () => connectors.calendar.list_events({ day: '2026-11-17' })",
        });
        expect(coded.result.isError).toBe(false);
        expect(JSON.parse(textOf(coded))).toEqual(JSON.parse(textOf(direct)));
        expect(gateway.calls).toEqual([
          { args: { day: "2026-11-17" }, name: "calendar__list-events", threadId },
          { args: { day: "2026-11-17" }, name: "calendar__list-events", threadId },
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
          callTool(threadId, "run_connector_code", {
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
        const caught = yield* callTool(threadId, "run_connector_code", {
          code: "async () => { const reasons = []; for (const call of [() => connectors.calendar.create_event({ day: 'd', title: 't' }), () => connectors.calendar.delete_event({ id: 'e1' })]) { try { await call(); } catch (error) { reasons.push(error.message); } } return reasons; }",
        });
        expect(JSON.parse(textOf(caught))).toEqual([
          "The owner denied this action.",
          "This connector tool is switched off for this thread.",
        ]);
        const uncaught = yield* callTool(threadId, "run_connector_code", {
          code: "async () => connectors.calendar.delete_event({ id: 'e1' })",
        });
        expect(uncaught.result.isError).toBe(true);
        expect(textOf(uncaught)).toBe("The code failed: Error: This connector tool is switched off for this thread.");
      }),
    ),
  );

  it.live("reaches nothing but the connector tools from code", () =>
    withGateway(() =>
      Effect.gen(function* () {
        yield* turnCodeModeOn;
        const { threadId } = yield* start();
        const answered = yield* callTool(threadId, "run_connector_code", {
          code: "async () => [typeof fetch, typeof require, typeof process, Object.keys(connectors), Object.keys(connectors.calendar)]",
        });
        expect(JSON.parse(textOf(answered))).toEqual([
          "undefined",
          "undefined",
          "undefined",
          ["calendar"],
          ["list_events", "create_event", "delete_event"],
        ]);
      }),
    ),
  );

  it.live("refuses a direct connector call while Code Mode is on, and the code tool while it is off", () =>
    withGateway((gateway) =>
      Effect.gen(function* () {
        const { threadId } = yield* start();
        const offCode = yield* callTool(threadId, "run_connector_code", { code: "async () => 1" });
        expect(textOf(offCode)).toBe("Unknown tool: run_connector_code");
        yield* turnCodeModeOn;
        const direct = yield* callTool(threadId, "calendar__list-events", { day: "2026-11-17" });
        expect(direct.result.isError).toBe(true);
        expect(textOf(direct)).toBe("Code Mode is on: call calendar__list-events from code, with run_connector_code.");
        expect(gateway.calls).toEqual([]);
      }),
    ),
  );

  it.live("refuses a call without code", () =>
    withGateway(() =>
      Effect.gen(function* () {
        yield* turnCodeModeOn;
        const { threadId } = yield* start();
        const answered = yield* callTool(threadId, "run_connector_code", {});
        expect(answered.result.isError).toBe(true);
        expect(textOf(answered)).toBe("Invalid arguments: give code, a JavaScript async arrow function.");
      }),
    ),
  );
});
