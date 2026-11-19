import { join } from "node:path";
import { Deferred, Effect, Layer } from "effect";
import type { ConnectorTool } from "../../src/connectors/gateway.ts";
import { ConnectorGateway } from "../../src/connectors/index.ts";
import { type ToolAnswer, unknownToolAnswer } from "../../src/core/index.ts";
import { fakeHarnessLayer, serviceLayer } from "../../src/index.ts";
import { temporary } from "./service.ts";

/** One call the fake gateway received. */
export type GatewayCall = { readonly args: unknown; readonly name: string; readonly threadId: string };

const toolOf = (connector: string, name: string, description: string, inputSchema: Record<string, unknown>) =>
  ({ connector, description, inputSchema, name: `${connector}__${name}`, tool: name }) satisfies ConnectorTool;

/** The fake connector's tools: a read, a write that waits for the owner, and a switched-off one. */
export const fakeConnectorTools = [
  toolOf("calendar", "list-events", "Lists the events of a day.", {
    properties: { day: { description: "The day, as YYYY-MM-DD.", type: "string" } },
    required: ["day"],
    type: "object",
  }),
  toolOf("calendar", "create-event", "Creates an event.", {
    properties: { day: { type: "string" }, title: { type: "string" } },
    required: ["day", "title"],
    type: "object",
  }),
  toolOf("calendar", "delete-event", "Deletes an event.", {
    properties: { id: { type: "string" } },
    required: ["id"],
    type: "object",
  }),
] as const;

/**
 * A stand-in for the connector gateway (connectors blueprint, `gateway.ts`): it answers reads at once, holds a write
 * until the test plays the owner's answer, and refuses the switched-off tool, recording every call it receives.
 */
export const fakeGateway = Effect.gen(function* () {
  const calls: Array<GatewayCall> = [];
  const asked = yield* Deferred.make<GatewayCall>();
  const answer = yield* Deferred.make<boolean>();
  const answers: Record<string, (args: unknown) => Effect.Effect<ToolAnswer>> = {
    "calendar__create-event": (args) =>
      Effect.gen(function* () {
        yield* Deferred.succeed(asked, { args, name: "calendar__create-event", threadId: "" });
        return (yield* Deferred.await(answer))
          ? { isError: false, text: JSON.stringify({ created: args }) }
          : { isError: true, text: "The owner denied this action." };
      }),
    "calendar__delete-event": () =>
      Effect.succeed({ isError: true, text: "This connector tool is switched off for this thread." }),
    "calendar__list-events": (args) =>
      Effect.succeed({ isError: false, text: JSON.stringify([{ day: args, id: "e1", title: "Standup" }]) }),
  };
  const layer = Layer.succeed(ConnectorGateway, {
    beginTurn: () => Effect.succeed(fakeConnectorTools.map((tool) => tool.name)),
    call: (threadId, name, args) =>
      Effect.suspend(() => {
        calls.push({ args, name, threadId });
        const answered = Object.hasOwn(answers, name) ? (answers[name] ?? null) : null;
        return answered === null ? Effect.succeed(unknownToolAnswer(name)) : answered(args);
      }),
    endTurn: () => Effect.void,
    listingFor: () => Effect.succeed(fakeConnectorTools),
  });
  return { answer, asked, calls, layer };
});

/** An isolated service with the fake harness and the given connector gateway. */
export const serviceWithGateway = (gateway: Layer.Layer<ConnectorGateway>) => {
  const directory = temporary("outlore-connectors-");
  return serviceLayer({
    connectorGateway: gateway,
    filename: join(directory, "store.sqlite"),
    harness: fakeHarnessLayer("10 millis"),
    homeFolder: directory,
    scratchRoot: join(directory, "missions"),
  });
};
