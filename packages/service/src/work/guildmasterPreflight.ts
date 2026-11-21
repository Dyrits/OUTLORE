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

/** `create_ritual`: the origin quest it names when there is one, and the realm, and the title as stored, after the shared refusals. */
export const readRitualPreflight = Effect.fnUntraced(function* (args: ArgumentsOf<"create_ritual">) {
  const sql = yield* SqlClient.SqlClient;
  if (args.instruction.trim() === "" || titleOf(args.title) === "") return refusal("Give an instruction and a title.");
  const { isNamed, realm } = yield* readOptionalRealm(args.realm);
  if (isNamed && realm === null)
    return refusal(`Not created: no realm "${args.realm}". Name one of the realms in your context, or leave it out.`);
  // The quest a Ritual is made from names its realm (rituals, Creation); nothing else of the quest comes along.
  const [origin] =
    args.origin === undefined || args.origin.trim() === ""
      ? []
      : yield* sql<{ missionId: string; realmName: string | null; realmPath: string | null }>`
          SELECT m.id AS missionId, w.name AS realmName, w.path AS realmPath
          FROM missions m JOIN threads t ON t.id = m.top_thread_id
          LEFT JOIN workspaces w ON w.id = t.workspace_id
          WHERE m.id = ${args.origin} AND m.is_guildmaster = 0 AND t.is_deleting = 0`;
  if (args.origin !== undefined && args.origin.trim() !== "" && origin === undefined)
    return refusal(
      `Not created: no quest "${args.origin}". Give a quest's id as your context shows it, or leave the origin out.`,
    );
  return {
    _tag: "Clear",
    originMissionId: origin?.missionId ?? null,
    realm,
    title: ritualTitleOf(args.title),
  } as const;
});
