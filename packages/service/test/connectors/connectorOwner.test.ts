import { SqliteClient, SqliteMigrator } from "@effect/sql-sqlite-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { migrations } from "../../src/core/store.ts";
import { testSecret } from "../fixtures/connectorBackend.ts";
import {
  connectorWorld,
  install,
  inWorld,
  openQuestionOf,
  replyOf,
  untilAsked,
  untilIdle,
  untilReplies,
} from "../fixtures/connectorWorld.ts";
import { listToolNames } from "../fixtures/mcp.ts";
import { call, read, send, startMission } from "../fixtures/service.ts";

const card = (id: string) =>
  call({ _tag: "ListConnectors" }).pipe(Effect.map((cards) => cards.find((entry) => entry.id === id)));
const rows = (table: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    return yield* sql.unsafe<Record<string, unknown>>(`SELECT * FROM ${table}`);
  });

describe("the Charter's list of connectors", () => {
  it.live("lists every connector the catalog offers, installed or not, with its notice and its tools", () =>
    inWorld({}, () =>
      Effect.gen(function* () {
        const cards = yield* call({ _tag: "ListConnectors" });
        expect(cards.map((entry) => [entry.id, entry.state])).toEqual([
          ["calendar", "NotInstalled"],
          ["unnamed_service", "NotInstalled"],
          ["applefake", "NotInstalled"],
        ]);
        expect(cards.find((entry) => entry.id === "unnamed_service")?.notice).toContain("stores your sign-ins");
        expect(cards.find((entry) => entry.id === "calendar")?.tools.map((tool) => tool.name)).toContain(
          "create-event",
        );
      }),
    ),
  );
});

describe("installing a connector", () => {
  it.live("enables it everywhere at once, and refuses it twice, unknown, or without its notice confirmed", () =>
    inWorld({}, () =>
      Effect.gen(function* () {
        const installed = yield* install("calendar");
        expect(installed).toMatchObject({ isEnabled: true, needs: null, state: "Ready" });
        expect((yield* Effect.flip(install("calendar"))) as { kind: string }).toMatchObject({ kind: "InvalidInput" });
        expect(
          yield* Effect.flip(call({ _tag: "InstallConnector", connectorId: "nope", hasConfirmedNotice: true })),
        ).toMatchObject({ kind: "NotFound" });
        const unconfirmed = yield* Effect.flip(
          call({ _tag: "InstallConnector", connectorId: "unnamed_service", hasConfirmedNotice: false }),
        );
        expect(unconfirmed).toMatchObject({ kind: "InvalidInput" });
        expect((yield* card("unnamed_service"))?.state).toBe("NotInstalled");
        expect((yield* install("unnamed_service")).state).toBe("Ready");
      }),
    ),
  );

  it.live("refuses Apple apps on a host that is not a Mac, which shows Needs a Mac", () =>
    Effect.gen(function* () {
      const world = yield* connectorWorld({ platform: "linux" });
      yield* Effect.gen(function* () {
        expect(yield* card("applefake")).toMatchObject({ needs: "Needs a Mac.", state: "NeedsMac" });
        const refused = yield* Effect.flip(install("applefake"));
        expect(refused).toMatchObject({ kind: "InvalidInput", message: "Apple apps needs a Mac." });
        expect(yield* rows("connectors")).toEqual([]);
      }).pipe(Effect.provide(world.layer));
    }),
  );

  it.live("chooses Calendar and not Mail by default, and refuses an app it does not have", () =>
    inWorld({}, () =>
      Effect.gen(function* () {
        const installed = yield* install("applefake");
        expect(installed.apps).toEqual([
          { id: "calendar", isChosen: true, name: "Calendar", permission: "NotAskedYet" },
          { id: "mail", isChosen: false, name: "Mail" },
        ]);
        const refused = yield* Effect.flip(install("applefake", ["spreadsheets"]));
        expect(refused).toMatchObject({ kind: "InvalidInput" });
      }),
    ),
  );
});

describe("Apple apps' chosen apps", () => {
  it.live("offers the tools of the chosen apps only, never a tool of no known app, and changes with the choice", () =>
    inWorld({}, () =>
      Effect.gen(function* () {
        yield* install("applefake");
        yield* call({ _tag: "RequestApplePermission", connectorId: "applefake" });
        const started = yield* startMission({ text: "Hello" });
        yield* untilIdle(started.missionId);
        const listed = () => listToolNames(started.threadId);
        expect(yield* listed()).toContain("applefake__list-events");
        expect(yield* listed()).not.toContain("applefake__read-mail");
        expect(yield* listed()).not.toContain("applefake__send-email");
        // The server lists a tool the catalog names for no app: its app cannot be checked, so it is not offered.
        expect(yield* listed()).not.toContain("applefake__stray-tool");
        yield* call({ _tag: "ChooseAppleApps", apps: ["calendar", "mail"], connectorId: "applefake" });
        yield* call({ _tag: "RequestApplePermission", connectorId: "applefake" });
        expect(yield* listed()).toContain("applefake__read-mail");
        expect(yield* listed()).toContain("applefake__send-email");
        const refused = yield* Effect.flip(call({ _tag: "ChooseAppleApps", apps: ["x"], connectorId: "applefake" }));
        expect(refused).toMatchObject({ kind: "InvalidInput" });
        const notApps = yield* Effect.flip(call({ _tag: "ChooseAppleApps", apps: [], connectorId: "calendar" }));
        expect(notApps).toMatchObject({ kind: "NotFound" });
      }),
    ),
  );

  it.live("stops a call to an app turned off during the call, and runs no call to an app that is not chosen", () =>
    inWorld({}, (world) =>
      Effect.gen(function* () {
        yield* install("applefake");
        yield* call({ _tag: "RequestApplePermission", connectorId: "applefake" });
        world.received.applefake.length = 0;
        const started = yield* startMission({ text: "call applefake__list-events {}" });
        for (let attempt = 0; attempt < 400 && world.received.applefake.length < 1; attempt++)
          yield* Effect.sleep("10 millis");
        yield* call({ _tag: "ChooseAppleApps", apps: ["mail"], connectorId: "applefake" });
        const done = yield* untilIdle(started.missionId);
        expect(replyOf(done)).toContain("This connector is off for this thread.");
        // An app that is not chosen is not called: the gateway checks the app at the call too.
        yield* send(started.threadId, "call applefake__list-events {}");
        const second = yield* untilReplies(started.missionId, 2);
        expect(replyOf(second)).toContain("This connector is off for this thread.");
        expect(world.received.applefake).toHaveLength(1);
      }),
    ),
  );
});

describe("removing a connector", () => {
  it.live(
    "forgets its choices, its tool switches, its standing permissions and its secret, and no other connector's",
    () =>
      inWorld({}, (world) =>
        Effect.gen(function* () {
          yield* install("calendar");
          yield* install("unnamed_service");
          const started = yield* startMission({ text: 'call calendar__create-event {"day":"d","title":"t"}' });
          yield* call({
            _tag: "AnswerQuestion",
            answer: "AlwaysAllow",
            message: null,
            questionId: openQuestionOf(yield* untilAsked(started.missionId))?.id as never,
          });
          yield* untilIdle(started.missionId);
          yield* call({ _tag: "SetConnectorTool", connectorId: "calendar", isOn: false, tool: "delete-event" });
          yield* call({
            _tag: "SetConnectorSwitch",
            choice: "Off",
            connectorId: "calendar",
            level: { _tag: "Borderlands" },
          });
          // A permission whose pattern only reads like the connector's id, as `_` would in a LIKE, must survive.
          const sql = yield* SqlClient.SqlClient;
          yield* sql`INSERT INTO standing_permissions (id, sentence, pattern, created_at)
          VALUES ('keep-1', 'Use a connector''s tool', 'unnamed_service/x', 1), ('keep-2', 'Run this exact command', 'calendar/create-event', 1)`;
          expect(world.vault.holds("calendar", "API key")).toBe(true);

          const removed = yield* call({ _tag: "RemoveConnector", connectorId: "calendar" });
          expect(removed.state).toBe("NotInstalled");
          expect(world.vault.holds("calendar", "API key")).toBe(false);
          expect(world.vault.holds("unnamed_service", "API key")).toBe(true);
          expect((yield* rows("connectors")).map((row) => row.id)).toEqual(["unnamed_service"]);
          expect(yield* rows("connector_choices")).toEqual([]);
          expect(yield* rows("connector_tools")).toEqual([]);
          // The permission for the removed connector's tool is gone; a command's and another connector's remain.
          expect((yield* rows("standing_permissions")).map((row) => row.id).toSorted()).toEqual(["keep-1", "keep-2"]);
          expect(yield* listToolNames(started.threadId)).not.toContain("calendar__list-events");
        }),
      ),
  );

  it.live(
    "leaves a connector Removing and unusable when the Vault cannot remove its secret, and finishes when sent again",
    () =>
      inWorld({}, (world) =>
        Effect.gen(function* () {
          yield* install("calendar");
          const started = yield* startMission({ text: "Hello" });
          yield* untilIdle(started.missionId);
          world.vault.state.isFailingRemoval = true;
          const failure = yield* Effect.flip(call({ _tag: "RemoveConnector", connectorId: "calendar" }));
          expect(failure).toMatchObject({ kind: "ExecutionFailure" });
          expect(failure.message).toContain("stays marked as being removed");
          expect(yield* card("calendar")).toMatchObject({ state: "Removing" });
          // It is never usable again, and its secret is not gone.
          expect(yield* listToolNames(started.threadId)).not.toContain("calendar__list-events");
          expect(world.vault.holds("calendar", "API key")).toBe(true);
          expect(
            (yield* Effect.flip(
              call({ _tag: "SetConnectorTool", connectorId: "calendar", isOn: false, tool: "list-events" }),
            )).kind,
          ).toBe("InvalidInput");
          world.vault.state.isFailingRemoval = false;
          expect((yield* call({ _tag: "RemoveConnector", connectorId: "calendar" })).state).toBe("NotInstalled");
          expect(world.vault.holds("calendar", "API key")).toBe(false);
        }),
      ),
  );

  it.live("resumes a removal a crash left halfway when the service starts again", () =>
    Effect.gen(function* () {
      const world = yield* connectorWorld({});
      yield* Effect.gen(function* () {
        yield* install("calendar");
        const sql = yield* SqlClient.SqlClient;
        // The first step done, the Vault and the rows not: what a crash after step 1 leaves.
        yield* sql`UPDATE connectors SET is_removing = 1 WHERE id = 'calendar'`;
        yield* sql`INSERT INTO connector_tools (connector_id, tool) VALUES ('calendar', 'list-events')`;
      }).pipe(Effect.provide(world.layer));
      expect(world.vault.holds("calendar", "API key")).toBe(true);
      yield* Effect.gen(function* () {
        expect(yield* rows("connectors")).toEqual([]);
        expect(yield* rows("connector_tools")).toEqual([]);
        expect((yield* card("calendar"))?.state).toBe("NotInstalled");
      }).pipe(Effect.provide(world.build()));
      expect(world.vault.holds("calendar", "API key")).toBe(false);
    }),
  );

  it.live("removes a connector idempotently: its secrets may already be gone", () =>
    inWorld({}, (world) =>
      Effect.gen(function* () {
        yield* install("calendar");
        world.vault.state.removed.length = 0;
        yield* call({ _tag: "RemoveConnector", connectorId: "calendar" });
        const again = yield* Effect.flip(call({ _tag: "RemoveConnector", connectorId: "calendar" }));
        expect(again).toMatchObject({ kind: "NotFound" });
        expect(world.vault.state.removed).toEqual(["calendar"]);
      }),
    ),
  );
});

describe("a connector's secret", () => {
  it.live("is not in the owner's connector cards, whose only trace of it is the kind that is missing", () =>
    inWorld({ hasKey: false }, () =>
      Effect.gen(function* () {
        const installed = yield* install("calendar");
        expect(JSON.stringify(installed)).not.toContain(testSecret);
        expect(installed.secretKinds).toEqual(["API key"]);
      }),
    ),
  );
});

describe("a thread reaching for the owner's connector requests", () => {
  it.live("finds no tool by which to install, switch or remove a connector", () =>
    inWorld({}, () =>
      Effect.gen(function* () {
        yield* install("calendar");
        const started = yield* startMission({
          text: 'call InstallConnector {"connectorId":"unnamed_service"}\ncall set_connector_switch {}\ncall RemoveConnector {"connectorId":"calendar"}',
        });
        const done = yield* untilIdle(started.missionId);
        expect(replyOf(done)).toBe(
          "Echo: Unknown tool: InstallConnector | Unknown tool: set_connector_switch | Unknown tool: RemoveConnector",
        );
        expect((yield* card("calendar"))?.state).toBe("Ready");
        expect((yield* card("unnamed_service"))?.state).toBe("NotInstalled");
        const detail = yield* read(started.missionId);
        expect(detail.questions).toEqual([]);
      }),
    ),
  );
});

describe("the connectors' tables on a database saved before them", () => {
  it.effect("are added beside the data already there, which stays as it was", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const migrateUntil = (last: string) =>
        SqliteMigrator.run({
          loader: SqliteMigrator.fromRecord(
            Object.fromEntries(Object.entries(migrations).filter(([id]) => id <= last)),
          ),
        });
      yield* migrateUntil("0059_thread_archived");
      yield* sql`INSERT INTO standing_permissions (id, sentence, pattern, created_at) VALUES ('p', 'Run this exact command', 'ls', 1)`;
      yield* migrateUntil("0062_connectors");
      expect(yield* sql`SELECT id FROM standing_permissions`).toEqual([{ id: "p" }]);
      expect(yield* sql`SELECT id FROM connectors`).toEqual([]);
      yield* sql`INSERT INTO connectors (id, installed_at) VALUES ('calendar', 1)`;
      expect(
        yield* sql`SELECT is_enabled AS isEnabled, is_removing AS isRemoving, options, needs FROM connectors`,
      ).toEqual([{ isEnabled: 1, isRemoving: 0, needs: null, options: "{}" }]);
    }).pipe(Effect.provide(SqliteClient.layer({ filename: ":memory:" }))),
  );
});
