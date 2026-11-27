import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { probeApplePermissions, probeToolOf } from "../../src/connectors/applePermission.ts";
import { BackendFailure, type ConnectorBackend } from "../../src/connectors/backend.ts";
import { appleEntry } from "../../src/connectors/catalogEntries.ts";
import type { CatalogEntry } from "../../src/connectors/index.ts";
import { fakeHarnessLayer, serviceLayer } from "../../src/index.ts";
import { Service } from "../../src/serviceTag.ts";
import { fakeBackendOf, fakeBackendsLayer, fakeVault, type ScriptedTool } from "../fixtures/connectorBackend.ts";
import { call, temporary } from "../fixtures/service.ts";

// The Apple permission probe: what it asks through the connector's own child, and the RequestApplePermission owner
// request around it. Apple Events are blocked in a thread's sandbox, so the probe runs against a fake backend here;
// the owner runs the real one on their Mac (see the verification note).

/** An Apple-like entry whose three apps probe differently: one allows, one is refused, one cannot be asked. */
const permEntry: CatalogEntry = {
  apps: [
    { id: "calendar", isDefault: true, name: "Calendar" },
    { id: "mail", isDefault: false, name: "Mail" },
    { id: "notes", isDefault: false, name: "Notes" },
  ],
  backend: { _tag: "Stdio", server: "perm-fake", version: "1.0.0" },
  description: "Mac apps for the permission tests.",
  id: "permfake",
  licence: "MIT",
  name: "Permission apps",
  notice: null,
  platform: "macOS",
  secretKind: null,
  tools: {
    "list-calendars": { app: "calendar", class: "Read", summary: "Lists the calendars" },
    "list-note-folders": { app: "notes", class: "Read", summary: "Lists the note folders" },
    "read-mail": { app: "mail", class: "Read", summary: "Reads a message" },
  },
};

const permTools: ReadonlyArray<ScriptedTool> = [
  { name: "list-calendars", run: () => Effect.succeed("personal, work") },
  {
    name: "read-mail",
    run: () =>
      Effect.fail(
        new BackendFailure({ class: "Failed", upstream: "not authorized to send Apple events to Mail (-1743)" }),
      ),
  },
  { name: "list-note-folders", run: () => Effect.fail(new BackendFailure({ class: "Unreachable", upstream: "gone" })) },
];

describe("the probe tool of an app", () => {
  it("is a Read tool of that app in the catalog, for every app Apple apps offers", () => {
    for (const app of appleEntry.apps) {
      const tool = probeToolOf(appleEntry, app.id);
      expect(tool).not.toBeNull();
      const catalogTool = appleEntry.tools[tool ?? ""];
      expect(catalogTool?.app).toBe(app.id);
      expect(catalogTool?.class).toBe("Read");
    }
    expect(probeToolOf(appleEntry, "no-such-app")).toBeNull();
  });
});

describe("the Apple permission report over a fake backend", () => {
  const reportOf = (tools: ReadonlyArray<ScriptedTool>, apps: ReadonlyArray<string>) => {
    const backend: ConnectorBackend = fakeBackendOf(tools, []).backend;
    return Effect.runPromise(probeApplePermissions(permEntry, apps, backend));
  };

  it("reports Allowed for an app whose probe answered", async () => {
    expect((await reportOf(permTools, ["calendar"])).apps).toEqual([{ app: "calendar", status: "Allowed" }]);
  });

  it("reports NotAllowed when macOS's refusal comes back in the tool's error", async () => {
    expect((await reportOf(permTools, ["mail"])).apps).toEqual([{ app: "mail", status: "NotAllowed" }]);
  });

  it("reports NotAllowed when the server refuses the connection as a permission refusal", async () => {
    const tools: ReadonlyArray<ScriptedTool> = [
      {
        name: "list-calendars",
        run: () => Effect.fail(new BackendFailure({ class: "Disconnected", upstream: "refused" })),
      },
    ];
    expect((await reportOf(tools, ["calendar"])).apps).toEqual([{ app: "calendar", status: "NotAllowed" }]);
  });

  it("reports NotAskedYet when the probe failed for any other reason, and for an app with no read tool", async () => {
    expect((await reportOf(permTools, ["notes"])).apps).toEqual([{ app: "notes", status: "NotAskedYet" }]);
    const withoutNotes: CatalogEntry = {
      ...permEntry,
      tools: { ...permEntry.tools, "list-note-folders": { app: "notes", class: "Write", summary: "writes" } },
    };
    const backend = fakeBackendOf(permTools, []).backend;
    const report = await Effect.runPromise(probeApplePermissions(withoutNotes, ["notes"], backend));
    expect(report.apps).toEqual([{ app: "notes", status: "NotAskedYet" }]);
  });

  it("asks one app at a time and covers exactly the chosen apps", async () => {
    const received: Array<string> = [];
    const tools: ReadonlyArray<ScriptedTool> = permTools.map((tool) => ({
      ...tool,
      run: (call) => Effect.sync(() => void received.push(call.tool)).pipe(Effect.andThen(tool.run(call))),
    }));
    const report = await reportOf(tools, ["calendar", "mail", "notes"]);
    expect(report.apps).toEqual([
      { app: "calendar", status: "Allowed" },
      { app: "mail", status: "NotAllowed" },
      { app: "notes", status: "NotAskedYet" },
    ]);
    expect(received).toEqual(["list-calendars", "read-mail", "list-note-folders"]);
  });
});

describe("the RequestApplePermission owner request", () => {
  /** A fresh service over the permission world. */
  const world = () => {
    const directory = temporary("outlore-permission-");
    const vault = fakeVault();
    const backend = fakeBackendOf(permTools, []).backend;
    const layer = serviceLayer({
      connectorBackends: fakeBackendsLayer({ permfake: backend }),
      connectorCatalog: [permEntry],
      connectorPlatform: "darwin",
      connectorVault: vault.layer,
      filename: join(directory, "store.sqlite"),
      harness: fakeHarnessLayer("10 millis"),
      homeFolder: directory,
      scratchRoot: join(directory, "missions"),
    });
    return { layer };
  };

  /** Runs a test body on a fresh service over the permission world. */
  const inPermWorld = <A, E, R>(body: Effect.Effect<A, E, R>) => body.pipe(Effect.provide(world().layer));

  it.live("asks through the connector's backend and answers each chosen app's status", () =>
    inPermWorld(
      Effect.gen(function* () {
        yield* call({
          _tag: "InstallConnector",
          apps: ["calendar", "mail", "notes"],
          connectorId: "permfake",
          hasConfirmedNotice: true,
        });
        const report = yield* call({ _tag: "RequestApplePermission", connectorId: "permfake" });
        expect(report.apps).toEqual([
          { app: "calendar", status: "Allowed" },
          { app: "mail", status: "NotAllowed" },
          { app: "notes", status: "NotAskedYet" },
        ]);
        const service = yield* Service;
        expect(yield* service.handle({ _tag: "ListConnectors" }, { isPairedDevice: true })).toMatchObject([
          {
            apps: [
              { id: "calendar", permission: "Allowed" },
              { id: "mail", permission: "NotAllowed" },
              { id: "notes", permission: "NotAskedYet" },
            ],
            state: "NeedsConnecting",
          },
        ]);
      }),
    ),
  );

  it.live("asks the default apps when the owner chose none at install", () =>
    inPermWorld(
      Effect.gen(function* () {
        yield* call({ _tag: "InstallConnector", connectorId: "permfake", hasConfirmedNotice: true });
        const report = yield* call({ _tag: "RequestApplePermission", connectorId: "permfake" });
        expect(report.apps).toEqual([{ app: "calendar", status: "Allowed" }]);
      }),
    ),
  );

  it.live("refuses a paired device before any handler runs", () =>
    inPermWorld(
      Effect.gen(function* () {
        const service = yield* Service;
        const refused = yield* Effect.flip(
          service.handle({ _tag: "RequestApplePermission", connectorId: "permfake" }, { isPairedDevice: true }),
        );
        expect(refused.kind).toBe("AccessRefused");
      }),
    ),
  );

  it.live("refuses a connector that is not installed", () =>
    inPermWorld(
      Effect.gen(function* () {
        const refused = yield* Effect.flip(call({ _tag: "RequestApplePermission", connectorId: "permfake" }));
        expect(refused.kind).toBe("InvalidInput");
      }),
    ),
  );
});
