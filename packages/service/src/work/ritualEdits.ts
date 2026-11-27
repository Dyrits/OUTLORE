import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { isNotBeingDeletedOf, isQuestKindOf } from "./questVisibility.ts";
import { readRitual } from "./ritualStore.ts";
import type { ArgumentsOf } from "./threadTools.ts";
import { ritualTitleOf } from "./titles.ts";

const refusal = (text: string) => ({ _tag: "Refused", text }) as const;

/** Finds the exact Ritual in the caller's realm and resolves the edit without changing any fields. */
export const readRitualEdit = Effect.fnUntraced(function* (
  callerId: string,
  { ritual, ...fields }: ArgumentsOf<"edit_ritual">,
) {
  const sql = yield* SqlClient.SqlClient;
  if (Object.keys(fields).length === 0) return refusal("Give at least one Ritual field to change.");
  if (fields.title?.trim() === "" || fields.instruction?.trim() === "")
    return refusal("A Ritual's title and instruction must have text.");
  const [caller] = yield* sql<{ realmId: string | null }>`
    SELECT top.workspace_id AS realmId
    FROM threads t JOIN missions m ON m.id = t.mission_id JOIN threads top ON top.id = m.top_thread_id
    WHERE t.id = ${callerId} AND ${isNotBeingDeletedOf(sql)} AND ${isQuestKindOf(sql, "owner")}
      AND NOT EXISTS (SELECT 1 FROM rituals WHERE mission_id = m.id)`;
  if (caller === undefined) return refusal("Edit a Ritual from an ordinary quest or errand.");
  const target = ritual.trim();
  const matches = yield* sql<{
    id: string;
    missionId: string;
    realmId: string | null;
    realmName: string | null;
  }>`
    SELECT r.id, m.id AS missionId, w.id AS realmId, w.name AS realmName
    FROM rituals r JOIN missions m ON m.id = r.mission_id JOIN threads t ON t.id = m.top_thread_id
    LEFT JOIN workspaces w ON w.id = t.workspace_id
    WHERE t.workspace_id IS ${caller.realmId} AND ${isNotBeingDeletedOf(sql)} AND w.archived_at IS NULL
      AND (r.id = ${target} OR m.title = ${target})`;
  const row = matches.find(({ id }) => id === target) ?? (matches.length === 1 ? matches[0] : undefined);
  if (row === undefined)
    return refusal(
      matches.length > 1 ? "Several Rituals have that title. Give the Ritual id." : "No such Ritual in this realm.",
    );
  const current = yield* readRitual(row.missionId);
  if (current === null) return refusal("No such Ritual in this realm.");
  const { fallbacks, instruction, isOn, primary, schedule, title } = current;
  const before = { fallbacks, instruction, isOn, primary, schedule, title };
  const changes = { ...fields, ...(fields.title === undefined ? {} : { title: ritualTitleOf(fields.title) }) };
  const realm = row.realmName === null ? null : { id: row.realmId, name: row.realmName };
  return { _tag: "Clear", before, changes, realm, ritualId: row.id } as const;
});
