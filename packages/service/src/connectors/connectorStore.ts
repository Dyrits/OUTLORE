import { Effect, Option, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { capabilities } from "../policy/index.ts";
import type { ConnectorChoices, Subject, SwitchChoice } from "./availability.ts";

// The connectors' stored choices (connectors blueprint, Stored choices): own tables, written inside the caller's
// transaction, nothing else in `core/` changed. Callers run the writes in a transaction.

/** The options a connector keeps: Apple apps' chosen apps. */
const Options = Schema.Struct({ apps: Schema.optionalKey(Schema.Array(Schema.String)) });
const decodeOptions = Schema.decodeUnknownOption(Schema.fromJsonString(Options));

/** One installed connector as stored. */
export type ConnectorRecord = {
  /** The apps chosen, or null when the connector has none. */
  readonly apps: ReadonlyArray<string> | null;
  readonly id: string;
  readonly installedAt: number;
  readonly isEnabled: boolean;
  readonly isRemoving: boolean;
  /** Why it Needs connecting after a refused sign-in or permission, or null. */
  readonly needs: string | null;
};

type ConnectorRow = {
  readonly id: string;
  readonly installedAt: number;
  readonly isEnabled: number;
  readonly isRemoving: number;
  readonly needs: string | null;
  readonly options: string;
};

const recordOf = (row: ConnectorRow): ConnectorRecord => ({
  apps: Option.match(decodeOptions(row.options), { onNone: () => null, onSome: (options) => options.apps ?? null }),
  id: row.id,
  installedAt: row.installedAt,
  isEnabled: row.isEnabled === 1,
  isRemoving: row.isRemoving === 1,
  needs: row.needs,
});

/** Every installed connector, in the order they were installed. */
export const readConnectorRecords = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<ConnectorRow>`SELECT id, installed_at AS installedAt, is_enabled AS isEnabled,
    is_removing AS isRemoving, needs, options FROM connectors ORDER BY installed_at, id`;
  return rows.map(recordOf);
});

/** One installed connector, or null. */
export const readConnectorRecord = Effect.fnUntraced(function* (connectorId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<ConnectorRow>`SELECT id, installed_at AS installedAt, is_enabled AS isEnabled,
    is_removing AS isRemoving, needs, options FROM connectors WHERE id = ${connectorId}`;
  return row === undefined ? null : recordOf(row);
});

/** Installs a connector: enabled everywhere, with the apps chosen when it has apps. */
export const insertConnector = Effect.fnUntraced(function* (
  connectorId: string,
  apps: ReadonlyArray<string> | null,
  now: number,
) {
  const sql = yield* SqlClient.SqlClient;
  const options = JSON.stringify(apps === null ? {} : { apps });
  yield* sql`INSERT INTO connectors (id, installed_at, is_enabled, is_removing, options)
    VALUES (${connectorId}, ${now}, 1, 0, ${options})`;
});

/** Sets the global switch. */
export const writeEnabled = Effect.fnUntraced(function* (connectorId: string, isEnabled: boolean) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`UPDATE connectors SET is_enabled = ${isEnabled ? 1 : 0} WHERE id = ${connectorId}`;
});

/** Sets the apps chosen. */
export const writeApps = Effect.fnUntraced(function* (connectorId: string, apps: ReadonlyArray<string>) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`UPDATE connectors SET options = ${JSON.stringify({ apps })} WHERE id = ${connectorId}`;
});

/** Records why the connector Needs connecting, or clears it with null. */
export const writeNeeds = Effect.fnUntraced(function* (connectorId: string, needs: string | null) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`UPDATE connectors SET needs = ${needs} WHERE id = ${connectorId}`;
});

/** The first step of a removal: the connector is unusable from here on. */
export const markRemoving = Effect.fnUntraced(function* (connectorId: string) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`UPDATE connectors SET is_removing = 1 WHERE id = ${connectorId}`;
});

/**
 * The last step of a removal: the connector's rows (its choices and tool switches go with it) and its standing
 * permissions. The permissions are those of the connector capability whose pattern begins `<id>/`, compared by prefix with
 * `substr`, since `_` in an id would be a wildcard in `LIKE`.
 */
export const deleteConnector = Effect.fnUntraced(function* (connectorId: string) {
  const sql = yield* SqlClient.SqlClient;
  const prefix = `${connectorId}/`;
  yield* sql`DELETE FROM standing_permissions WHERE sentence = ${capabilities.useConnectorTool}
    AND substr(pattern, 1, ${prefix.length}) = ${prefix}`;
  yield* sql`DELETE FROM connector_choices WHERE connector_id = ${connectorId}`;
  yield* sql`DELETE FROM connector_tools WHERE connector_id = ${connectorId}`;
  yield* sql`DELETE FROM connectors WHERE id = ${connectorId}`;
});

/** The explicit choices of a connector. */
export const readChoices = Effect.fnUntraced(function* (connectorId: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{
    choice: SwitchChoice;
    kind: string;
    missionId: string | null;
    workspaceId: string | null;
  }>`SELECT kind, workspace_id AS workspaceId, mission_id AS missionId, choice
    FROM connector_choices WHERE connector_id = ${connectorId}`;
  const quests = new Map<string, SwitchChoice>();
  const realms = new Map<string, SwitchChoice>();
  let borderlands: SwitchChoice | null = null;
  for (const row of rows) {
    if (row.kind === "Borderlands") borderlands = row.choice;
    else if (row.kind === "Realm" && row.workspaceId !== null) realms.set(row.workspaceId, row.choice);
    else if (row.kind === "Quest" && row.missionId !== null) quests.set(row.missionId, row.choice);
  }
  return { borderlands, quests, realms } satisfies ConnectorChoices;
});

/** Where an explicit choice is kept. */
export type ChoiceLevel =
  | { readonly _tag: "Borderlands" }
  | { readonly _tag: "Realm"; readonly realmId: string }
  | { readonly _tag: "Quest"; readonly missionId: string };

/** Writes an explicit choice at a level, or removes it (Reset, back to Inherit) with null. */
export const writeChoice = Effect.fnUntraced(function* (
  connectorId: string,
  level: ChoiceLevel,
  choice: SwitchChoice | null,
) {
  const sql = yield* SqlClient.SqlClient;
  const realmId = level._tag === "Realm" ? level.realmId : null;
  const missionId = level._tag === "Quest" ? level.missionId : null;
  yield* sql`DELETE FROM connector_choices WHERE connector_id = ${connectorId} AND kind = ${level._tag}
    AND workspace_id IS ${realmId} AND mission_id IS ${missionId}`;
  if (choice !== null)
    yield* sql`INSERT INTO connector_choices (connector_id, kind, workspace_id, mission_id, choice)
      VALUES (${connectorId}, ${level._tag}, ${realmId}, ${missionId}, ${choice})`;
});

/** The tools of a connector switched off, by exact name. */
export const readOffTools = Effect.fnUntraced(function* (connectorId: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{ tool: string }>`SELECT tool FROM connector_tools WHERE connector_id = ${connectorId}`;
  return new Set(rows.map((row) => row.tool));
});

/** Switches one tool off (a row) or on (no row). */
export const writeToolSwitch = Effect.fnUntraced(function* (connectorId: string, tool: string, isOn: boolean) {
  const sql = yield* SqlClient.SqlClient;
  if (isOn) yield* sql`DELETE FROM connector_tools WHERE connector_id = ${connectorId} AND tool = ${tool}`;
  else yield* sql`INSERT OR IGNORE INTO connector_tools (connector_id, tool) VALUES (${connectorId}, ${tool})`;
});

/** Whether a realm exists, so a choice is not stored for one that does not. */
export const hasRealm = Effect.fnUntraced(function* (realmId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{ id: string }>`SELECT id FROM workspaces WHERE id = ${realmId}`;
  return row !== undefined;
});

/** Whether a quest exists. */
export const hasQuest = Effect.fnUntraced(function* (missionId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{ id: string }>`SELECT id FROM missions WHERE id = ${missionId}`;
  return row !== undefined;
});

/**
 * Who a thread asks as, read at the time of asking so a quest's move needs no migration: Chronicler's, or its quest with
 * its top thread's realm. Null when the thread does not exist.
 */
export const readSubject = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{ isGuildmaster: number; missionId: string; realmId: string | null }>`
    SELECT m.id AS missionId, m.is_guildmaster AS isGuildmaster, top.workspace_id AS realmId
    FROM threads t JOIN missions m ON m.id = t.mission_id JOIN threads top ON top.id = m.top_thread_id
    WHERE t.id = ${threadId}`;
  if (row === undefined) return null;
  return row.isGuildmaster === 1
    ? ({ _tag: "Chronicler" } satisfies Subject)
    : ({ _tag: "Quest", missionId: row.missionId, realmId: row.realmId } satisfies Subject);
});
