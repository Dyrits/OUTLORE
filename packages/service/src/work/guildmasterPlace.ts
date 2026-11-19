import type { GuildmasterPlace, HarnessName, ModelChoice } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, readSettings } from "../core/index.ts";
import { claudeCheapestModel } from "../harness/index.ts";
import { changed, unchanged } from "./followUps.ts";
import { insertQuest } from "./missions.ts";
import { findRealmMatches } from "./realmResolution.ts";

// Chronicler, once the Guildmaster (quest coordination): one permanent thread the owner talks to, which looks for a quest
// that fits a request and offers to continue it, or proposes a new one for the owner to open. It is stored as a hidden
// quest so its turns, messages, usage, and cards are the quests' own; every list, search, and ending leaves it out.
// This file is the place itself, a leaf the other Chronicler files and the quest endings build on.

/** Chronicler's title, in its thread tree and its usage; data made as Guildmaster is renamed by migrations 0041 and 0050. */
export const guildmasterTitle = "Chronicler";

/**
 * The cheapest model Outlore knows for a harness, which Chronicler starts on: it only routes. Codex and OpenCode list
 * their models only by running, so they start on their own default; the owner can hand it over at any time.
 */
const cheapestModelOf = (harness: HarnessName): ModelChoice => (harness === "claude" ? claudeCheapestModel : "default");

/** Chronicler's quest and thread, made on first use. Callers run it in a transaction. */
export const ensureGuildmaster = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const [existing] = yield* sql<{ missionId: string; threadId: string }>`
    SELECT id AS missionId, top_thread_id AS threadId FROM missions WHERE is_guildmaster = 1`;
  if (existing !== undefined) return { ...existing, isCreated: false } as const;
  const settings = yield* readSettings;
  const started = yield* insertQuest(
    { firstMessage: null, isTitleByOwner: true, realm: null, shouldRememberChoices: false, title: guildmasterTitle },
    { effort: "default", harness: settings.defaultHarness, model: cheapestModelOf(settings.defaultHarness) },
    null,
  );
  // The default quest budget is for quests; Chronicler's own is the owner's to set (budget-control).
  yield* sql`UPDATE missions SET is_guildmaster = 1, budget_cost = NULL, budget_tokens = NULL WHERE id = ${started.missionId}`;
  return { isCreated: true, missionId: started.missionId, threadId: started.threadId } as const;
});

/** Where Chronicler's conversation is, made when it is not there yet. */
export const readGuildmaster = ensureGuildmaster.pipe(
  // Only making the place announces a change: a read that always did made every screen that follows changes reload
  // it at once, a loop that froze the Guild Hall.
  Effect.map(({ isCreated, missionId, threadId }) => {
    const place = { missionId, threadId } as GuildmasterPlace;
    return isCreated ? changed(place) : unchanged(place);
  }),
);

/** Whether the thread belongs to Chronicler. */
export const isGuildmasterThread = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{ id: string }>`
      SELECT t.id FROM threads t JOIN missions m ON m.id = t.mission_id WHERE t.id = ${threadId} AND m.is_guildmaster = 1`;
  return rows.length > 0;
});

/** Whether the quest is Chronicler's. */
export const isGuildmasterQuest = Effect.fnUntraced(function* (missionId: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{ id: string }>`SELECT id FROM missions WHERE id = ${missionId} AND is_guildmaster = 1`;
  return rows.length > 0;
});

/** Refuses to end, delete, or rename Chronicler's quest: it is permanent (quest coordination, Place). */
export const refuseGuildmaster = Effect.fnUntraced(function* (missionId: string, action: string) {
  if (yield* isGuildmasterQuest(missionId)) return yield* invalid(`Chronicler is permanent: it cannot be ${action}.`);
});

/** A realm the owner or Chronicler named, by its folder or its name; null when none matches. */
export const findRealm = Effect.fnUntraced(function* (given: string) {
  const matches = yield* findRealmMatches(given, true);
  if (matches.length > 1) return yield* invalid("Several active realms have that name. Use the realm's folder or id.");
  const [realm] = matches;
  return realm?.path == null ? null : { name: realm.name, path: realm.path };
});

/**
 * The realm a tool call names, for one that may leave it out: `isNamed` tells a realm named but not found (`realm`
 * null) from none named.
 */
export const readOptionalRealm = Effect.fnUntraced(function* (given: string | undefined) {
  const wanted = given?.trim() ?? "";
  if (wanted === "") return { isNamed: false, realm: null } as const;
  return { isNamed: true, realm: yield* findRealm(wanted) } as const;
});
