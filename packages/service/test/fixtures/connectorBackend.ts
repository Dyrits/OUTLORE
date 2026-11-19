import { Deferred, Effect, Layer } from "effect";
import {
  BackendFailure,
  type BackendTool,
  type CatalogEntry,
  type ConnectorBackend,
  ConnectorBackends,
  type ConnectorErrorClass,
  SecretMissing,
  VaultPort,
  VaultUnavailable,
} from "../../src/connectors/index.ts";

// Test doubles for what the connectors stand on: a scripted fake backend (reads, writes, a failing tool, a slow one, one
// the catalog does not name, and one that echoes its secret), a fake Vault and a test catalog (connectors blueprint, Seams).

/** One call a fake backend received. */
export type BackendCall = {
  readonly args: unknown;
  readonly secret: string | null;
  readonly tool: string;
};

/** The ways a scripted tool can answer. */
export type Script = (call: BackendCall) => Effect.Effect<string, BackendFailure>;

/** One tool the fake server lists, and what it does when called. */
export type ScriptedTool = {
  readonly description?: string;
  readonly name: string;
  readonly run: Script;
};

/** The failure of a class, as a server reports it, with words that must never reach a thread. */
export const failureOf = (errorClass: ConnectorErrorClass, upstream = "UPSTREAM SECRET-LOOKING WORDS") =>
  new BackendFailure({ class: errorClass, upstream });

/** A fake server over scripted tools, recording what it is called with. */
export const fakeBackendOf = (tools: ReadonlyArray<ScriptedTool>, received: Array<BackendCall>) => {
  const state = { closes: 0, listings: 0 };
  const listed = (): ReadonlyArray<BackendTool> =>
    tools.map((tool) => ({
      description: tool.description ?? `Server's own words about ${tool.name}.`,
      inputSchema: { properties: {}, type: "object" },
      name: tool.name,
    }));
  const backend: ConnectorBackend = {
    call: (name, args, secret) => {
      const found = tools.find((tool) => tool.name === name);
      received.push({ args, secret, tool: name });
      return found === undefined ? Effect.fail(failureOf("InvalidArguments")) : found.run({ args, secret, tool: name });
    },
    close: Effect.sync(() => void state.closes++),
    listTools: () =>
      Effect.sync(() => {
        state.listings++;
        return listed();
      }),
  };
  return { backend, state };
};

/** The backends layer over fake servers keyed by connector id; a connector with none is unreachable. */
export const fakeBackendsLayer = (servers: Readonly<Record<string, ConnectorBackend>>) =>
  Layer.succeed(ConnectorBackends, {
    open: (entry) =>
      Effect.succeed(
        Object.hasOwn(servers, entry.id)
          ? (servers[entry.id] as ConnectorBackend)
          : {
              call: () => Effect.fail(failureOf("Unreachable")),
              close: Effect.void,
              listTools: () => Effect.fail(failureOf("Unreachable")),
            },
      ),
  });

/** A fake Vault: secrets by connector and kind, and a switch to make its removal fail. */
export const fakeVault = () => {
  const secrets = new Map<string, string>();
  const state = { isFailingRemoval: false, isLocked: false, removed: [] as Array<string> };
  const keyOf = (connector: string, kind: string) => `${connector}\u0000${kind}`;
  const layer = Layer.succeed(VaultPort, {
    holds: (connector, kind) =>
      state.isLocked
        ? Effect.fail(new VaultUnavailable({ reason: "Locked" }))
        : Effect.succeed(secrets.has(keyOf(connector, kind))),
    removeAllOf: (connector) =>
      Effect.suspend(() => {
        if (state.isFailingRemoval) return Effect.fail(new VaultUnavailable({ reason: "Failed" }));
        for (const key of [...secrets.keys()]) if (key.startsWith(`${connector}\u0000`)) secrets.delete(key);
        state.removed.push(connector);
        return Effect.void;
      }),
    withSecret: (connector, kind, use) => {
      if (state.isLocked) return Effect.fail(new VaultUnavailable({ reason: "Locked" }));
      const secret = secrets.get(keyOf(connector, kind));
      return secret === undefined ? Effect.fail(new SecretMissing({ connector, kind })) : use(secret);
    },
  });
  return {
    holds: (connector: string, kind: string) => secrets.has(keyOf(connector, kind)),
    layer,
    put: (connector: string, kind: string, secret: string) => void secrets.set(keyOf(connector, kind), secret),
    secretCount: () => secrets.size,
    state,
  };
};

/** The key the test connectors are given, distinctive so a search for it finds only a leak. */
export const testSecret = "sk-live-7f3a9c2e/key+value==";

/** Holds a tool's answer until the test opens the gate; the way a slow call is made deterministic. */
export const gated =
  (gate: Deferred.Deferred<void>, text: string): Script =>
  () =>
    Deferred.await(gate).pipe(Effect.as(text));

/** The tools every test connector's fake server lists. */
export const scriptedToolsOf = (gate: Deferred.Deferred<void>): ReadonlyArray<ScriptedTool> => [
  {
    name: "list-events",
    run: ({ args }) => Effect.succeed(JSON.stringify({ events: [{ id: "e1", title: "Standup" }], got: args })),
  },
  { name: "create-event", run: ({ args }) => Effect.succeed(JSON.stringify({ created: args })) },
  { name: "delete-event", run: () => Effect.succeed("deleted") },
  { name: "wait-read", run: gated(gate, "waited") },
  { name: "wait-write", run: gated(gate, "wrote after waiting") },
  { name: "refused-read", run: () => Effect.fail(failureOf("Disconnected")) },
  { name: "unreachable-read", run: () => Effect.fail(failureOf("Unreachable")) },
  { name: "bad-read", run: () => Effect.fail(failureOf("InvalidArguments")) },
  { name: "broken-read", run: () => Effect.fail(failureOf("Failed")) },
  { name: "unreachable-write", run: () => Effect.fail(failureOf("Unreachable")) },
  // Not in the catalog: unclassified, so it asks.
  { name: "mystery", run: () => Effect.succeed("mystery done") },
  // Echoes the key it was given, raw, URL-encoded and base64, in its answer.
  {
    name: "echo-read",
    run: ({ secret }) =>
      Effect.succeed(
        `key=${secret} url=${encodeURIComponent(secret ?? "")} b64=${Buffer.from(secret ?? "").toString("base64")}`,
      ),
  },
];

const entryTools = {
  "bad-read": { app: null, class: "Read", summary: "A read given bad arguments" },
  "broken-read": { app: null, class: "Read", summary: "A read that breaks" },
  "create-event": { app: null, class: "Write", summary: "Create an event" },
  "delete-event": { app: null, class: "Write", summary: "Delete an event" },
  "echo-read": { app: null, class: "Read", summary: "A read that echoes its key" },
  "list-events": { app: null, class: "Read", summary: "List the events of a day" },
  "refused-read": { app: null, class: "Read", summary: "A read the server refuses" },
  "unreachable-read": { app: null, class: "Read", summary: "A read that cannot reach its server" },
  "unreachable-write": { app: null, class: "Write", summary: "A write that cannot reach its server" },
  "wait-read": { app: null, class: "Read", summary: "Wait, then read" },
  "wait-write": { app: null, class: "Write", summary: "Wait, then write" },
} as const satisfies CatalogEntry["tools"];

/** A connector with a key, reads and writes named by the catalog, and a tool the catalog does not name. */
export const calendarEntry: CatalogEntry = {
  apps: [],
  backend: { _tag: "Http", header: "x-api-key", url: "https://calendar.example.invalid/mcp" },
  description: "A calendar for the tests.",
  id: "calendar",
  licence: "MIT",
  name: "Calendar",
  notice: null,
  platform: "Any",
  secretKind: "API key",
  tools: entryTools,
};

/** A connector like Composio: no tool is named, so every call asks. */
export const unclassifiedEntry: CatalogEntry = {
  ...calendarEntry,
  description: "A connector whose tools the catalog does not name.",
  id: "unnamed_service",
  name: "Unnamed service",
  notice: "This service stores your sign-ins and sees what its tools return.",
  tools: {},
};

/** A Mac-only connector with apps, one on by default and one off, and no key. */
export const appleLikeEntry: CatalogEntry = {
  ...calendarEntry,
  apps: [
    { id: "calendar", isDefault: true, name: "Calendar" },
    { id: "mail", isDefault: false, name: "Mail" },
  ],
  backend: { _tag: "Stdio", command: ["fake"], version: "1.0.0" },
  description: "Mac apps for the tests.",
  id: "applefake",
  name: "Apple apps",
  notice: "What a tool reads goes to the model provider.",
  platform: "macOS",
  secretKind: null,
  tools: {
    "list-events": { app: "calendar", class: "Read", summary: "List the events of a day" },
    "read-mail": { app: "mail", class: "Read", summary: "Read a message" },
    "send-email": { app: "mail", class: "Write", summary: "Send an email" },
  },
};

/** The tools the Mac-like fake server lists, among them one the catalog names for no app. */
export const appleLikeToolsOf = (gate: Deferred.Deferred<void>): ReadonlyArray<ScriptedTool> => [
  { name: "list-events", run: gated(gate, "events") },
  { name: "read-mail", run: () => Effect.succeed("mail text") },
  { name: "send-email", run: () => Effect.succeed("sent") },
  { name: "stray-tool", run: () => Effect.succeed("stray") },
];
