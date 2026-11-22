import { Settings } from "@outlore/contracts";
import { Effect, Exit, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { readSettings } from "../core/index.ts";
import { readWorkingIds } from "./ending.ts";
import { readOptionalRealm } from "./guildmasterPlace.ts";
import { isChangeableSetting, isKeptFromChronicler } from "./guildmasterSettingNames.ts";
import { parseJson } from "./guildmasterText.ts";
import type { ArgumentsOf } from "./threadTools.ts";
import { ritualTitleOf, titleOf } from "./titles.ts";

// What structural tools check before acting. Settings and Ritual creation share their checks with the authorization
// derivation; quest derivation retains its own sequence because its failure order differs.

const refusal = (text: string) => ({ _tag: "Refused", text }) as const;

/** `change_setting`: the setting, the value as JSON, and the settings before and after, whole. */
export const readSettingChange = Effect.fnUntraced(function* (args: ArgumentsOf<"change_setting">) {
  const setting = args.setting;
  if (isKeptFromChronicler(setting))
    return refusal(`Not done: ${setting} is the owner's alone to change, in the Workshop. Tell them where.`);
  if (!isChangeableSetting(setting))
    return refusal(`Not done: no setting "${setting}". Read the settings first; use a name from them.`);
  const parsed = parseJson(args.value);
  if (Exit.isFailure(parsed))
    return refusal(`Not done: value must be JSON text, such as true, 14, or "Steer"; ${args.value} is not.`);
  const value = parsed.value;
  const before = yield* readSettings;
  // The value must decode as the setting, whole: a wrong shape or range changes nothing.
  const after = Schema.decodeUnknownExit(Settings)({ ...before, [setting]: value });
  if (Exit.isFailure(after))
    return refusal(
      `Not done: ${JSON.stringify(value)} is not a value ${setting} accepts. Read the settings for its shape.`,
    );
  return { _tag: "Clear", after: after.value, before: before[setting], setting, value } as const;
});

/** `act_on_mission`: the quest as stored, and for Stop the threads at work, after the refusals every action shares. */
export const readQuestAction = Effect.fnUntraced(function* (args: ArgumentsOf<"act_on_mission">) {
  const sql = yield* SqlClient.SqlClient;
  const [quest] = yield* sql<{ id: string; title: string; ending: string | null }>`
      SELECT m.id, m.title, m.ending FROM missions m JOIN threads top ON top.id = m.top_thread_id
      WHERE m.id = ${args.mission} AND m.is_guildmaster = 0 AND top.is_deleting = 0`;
  if (quest === undefined) return refusal("Not done: no such quest.");
  if (args.action === "Rename" && titleOf(args.title ?? "") === "") return refusal("Not done: give the new title.");
  const ids: ReadonlyArray<string> = args.action === "Stop" ? yield* readWorkingIds(args.mission) : [];
  if (args.action === "Stop" && ids.length === 0) return refusal(`"${quest.title}" has no thread at work to stop.`);
  return { _tag: "Clear", ids, quest } as const;
});

/** Resolves Ritual creation in the caller's realm and binds its origin and destination to approval. */
export const readRitualPreflight = Effect.fnUntraced(function* (callerId: string, args: ArgumentsOf<"create_ritual">) {
  const sql = yield* SqlClient.SqlClient;
  if (args.instruction.trim() === "" || titleOf(args.title) === "") return refusal("Give an instruction and a title.");
  const [caller] = yield* sql<{
    missionId: string;
    isControl: number;
    channel: string | null;
    ritualId: string | null;
  }>`SELECT m.id AS missionId, m.is_guildmaster AS isControl, m.chronicler_channel AS channel,
      r.id AS ritualId FROM threads t JOIN missions m ON m.id = t.mission_id
      LEFT JOIN rituals r ON r.mission_id = m.id WHERE t.id = ${callerId} AND t.is_deleting = 0`;
  if (caller === undefined || caller.ritualId !== null) return refusal("A Ritual run cannot create a Ritual.");
  const isLegacyConversation = caller.isControl === 1 && caller.channel === null;
  if (!isLegacyConversation && (args.realm !== undefined || args.origin !== undefined))
    return refusal("Leave realm and origin out. Outlore uses this conversation's realm and quest.");
  if (args.realm !== undefined && args.origin !== undefined) return refusal("Give realm or origin, not both.");
  const originMissionId = caller.isControl === 0 ? caller.missionId : args.origin?.trim() || null;
  const [origin] =
    originMissionId === null
      ? []
      : yield* sql<{
          realmId: string | null;
          name: string | null;
          path: string | null;
          archivedAt: number | null;
        }>`SELECT w.id AS realmId, w.name, w.path, w.archived_at AS archivedAt
    FROM missions m JOIN threads t ON t.id = m.top_thread_id
    LEFT JOIN workspaces w ON w.id = t.workspace_id
    WHERE m.id = ${originMissionId} AND m.is_guildmaster = 0 AND t.is_deleting = 0
      AND NOT EXISTS (SELECT 1 FROM rituals WHERE mission_id = m.id)`;
  if (originMissionId !== null && origin === undefined) return refusal("No such origin quest.");
  const [channelRealm] =
    caller.channel === null || caller.channel === "borderlands"
      ? []
      : yield* sql<{
          realmId: string;
          name: string;
          path: string | null;
          archivedAt: number | null;
        }>`SELECT id AS realmId, name, path, archived_at AS archivedAt FROM workspaces WHERE id = ${caller.channel}`;
  if (caller.channel !== null && caller.channel !== "borderlands" && channelRealm === undefined)
    return refusal("This conversation's realm no longer exists.");
  const destination = origin ?? channelRealm;
  if (destination !== undefined && destination.archivedAt !== null)
    return refusal("Restore this archived realm before creating a Ritual.");
  const { isNamed, realm: namedRealm } = yield* readOptionalRealm(args.realm);
  if (isNamed && namedRealm === null) return refusal(`Not created: no realm "${args.realm}".`);
  const realm = destination?.name == null ? namedRealm : { name: destination.name, path: destination.path };
  return {
    _tag: "Clear",
    originMissionId,
    realm,
    realmId: destination?.realmId ?? null,
    title: ritualTitleOf(args.title),
  } as const;
});
