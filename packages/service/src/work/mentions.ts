import { type Mentionable, type MentionReference, mentionReferencesOf, mentionTokenOf } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { readMissionSummaryMap } from "./matching.ts";

// Quests and errands the owner names with `@`, and realms with `#` (thread-messaging, Who can message whom; CHG-0181): what the
// menu offers, the reference appended to the message the harness reads, and what a mention opens for the turn it reaches.

/** A thread of a quest not archived. */
type ThreadRow = {
  readonly id: string;
  readonly missionId: string;
  readonly parentId: string | null;
  readonly title: string;
};

/**
 * The quests a mention may name: not archived, and not Chronicler's own. One fragment for the menu and for what a turn may
 * read or message, so what is offered and what is reachable cannot drift apart. `m` is the quest's row.
 */
const isOpenQuestOf = (sql: SqlClient.SqlClient) =>
  sql`(m.ending IS NULL OR m.ending <> 'Archived') AND m.is_guildmaster = 0`;

/** Whether `m` is the owner's own message, rather than a service-made run or routed suggestion. */
export const isOwnerMessageOf = (sql: SqlClient.SqlClient) =>
  sql`m.sender_kind = 'user' AND m.sender_thread_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM ritual_run_messages r WHERE r.message_id = m.id)
    AND NOT EXISTS (SELECT 1 FROM suggested_messages s WHERE s.message_id = m.id)`;

/** The titles from a quest's top thread down to the thread, the top one being the quest's title. */
const trailOf = (thread: ThreadRow, byId: ReadonlyMap<string, ThreadRow>, questTitle: string) => {
  const titles: string[] = [];
  for (
    let at: ThreadRow | null = thread;
    at !== null;
    at = at.parentId === null ? null : (byId.get(at.parentId) ?? null)
  ) {
    titles.unshift(at.parentId === null ? questTitle : at.title);
  }
  return titles;
};

/**
 * Every quest not archived with its errands beneath it, latest activity first, then every realm by name. Chronicler's own
 * quest and threads being deleted are never offered.
 */
export const listMentionables = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const quests = yield* sql<{ id: string; title: string; realmName: string | null }>`
    SELECT m.id, m.title, w.name AS realmName FROM missions m
      JOIN threads top ON top.id = m.top_thread_id LEFT JOIN workspaces w ON w.id = top.workspace_id
    WHERE ${isOpenQuestOf(sql)} AND top.is_deleting = 0
    ORDER BY m.last_activity_at DESC`;
  const threads = yield* sql<ThreadRow>`
    SELECT t.id, t.mission_id AS missionId, t.parent_id AS parentId, t.title FROM threads t
      JOIN missions m ON m.id = t.mission_id
    WHERE ${isOpenQuestOf(sql)} AND t.is_deleting = 0
    ORDER BY t.rowid`;
  const realms = yield* sql<{ id: string; name: string; path: string | null }>`
    SELECT id, name, path FROM workspaces WHERE archived_at IS NULL ORDER BY name COLLATE NOCASE`;
  const byId = new Map(threads.map((thread) => [thread.id, thread]));
  return [
    ...quests.flatMap(
      (quest): ReadonlyArray<Mentionable> => [
        { detail: quest.realmName, id: quest.id, kind: "quest", trail: [quest.title] },
        ...threads
          .filter((thread) => thread.missionId === quest.id && thread.parentId !== null)
          .map(
            (thread): Mentionable => ({
              detail: quest.realmName,
              id: thread.id,
              kind: "side-quest",
              trail: trailOf(thread, byId, quest.title),
            }),
          ),
      ],
    ),
    ...realms.map((realm): Mentionable => ({ detail: realm.path, id: realm.id, kind: "realm", trail: [realm.name] })),
  ];
});

/** A mentioned errand's thread, in a quest not archived; null when there is none. */
const readSideQuest = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{ missionId: string; state: string }>`
      SELECT t.mission_id AS missionId, t.state FROM threads t JOIN missions m ON m.id = t.mission_id
      WHERE t.id = ${threadId} AND t.parent_id IS NOT NULL AND t.is_deleting = 0 AND ${isOpenQuestOf(sql)}`;
  return row ?? null;
});

/** A quest not archived, nor Chronicler's own, with its state and realm; empty when there is none. */
const readQuest = Effect.fnUntraced(function* (missionId: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{
    id: string;
    title: string;
    topThreadId: string;
    workspaceName: string | null;
  }>`
      SELECT m.id, m.title, m.top_thread_id AS topThreadId, w.name AS workspaceName
      FROM missions m JOIN threads top ON top.id = m.top_thread_id LEFT JOIN workspaces w ON w.id = top.workspace_id
      WHERE m.id = ${missionId} AND ${isOpenQuestOf(sql)} AND top.is_deleting = 0`;
  const summaries = yield* readMissionSummaryMap(rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, state: summaries.get(row.id)?.state ?? "Resting" }));
});

/**
 * What one reference names: the line the receiving thread reads about it, and what it opens for the turn it reaches.
 * The line and the grants come from one reading, so what a thread is told it may do is what it may do.
 */
type ResolvedMention = {
  /** The line the receiving thread reads, with the ids its tools take. */
  readonly line: string;
  /** The thread it may message, or null. */
  readonly reachableThread: string | null;
  /** The quest whose journal the thread may read, or null. */
  readonly readableQuest: string | null;
};

/** The words for a quest's realm, as the receiving thread reads them. */
const realmLabelOf = (quest: { readonly workspaceName: string | null }) =>
  quest.workspaceName === null ? "no realm" : `realm ${quest.workspaceName}`;

const resolveRealmMention = Effect.fnUntraced(function* (reference: MentionReference) {
  const sql = yield* SqlClient.SqlClient;
  const token = mentionTokenOf(reference);
  const [realm] = yield* sql<{ name: string; path: string | null }>`
      SELECT name, path FROM workspaces WHERE id = ${reference.id}`;
  const line =
    realm === undefined
      ? `${token} = no realm has this id any more.`
      : `${token} = Realm "${realm.name}" (id ${reference.id}, ${realm.path === null ? "tied to no folder" : `folder ${realm.path}`}).`;
  // A realm is context only: it opens no quest and no thread.
  return { line, reachableThread: null, readableQuest: null } satisfies ResolvedMention;
});

const resolveQuestMention = Effect.fnUntraced(function* (reference: MentionReference) {
  const token = mentionTokenOf(reference);
  const [quest] = yield* readQuest(reference.id);
  const grants = { reachableThread: quest?.topThreadId ?? null, readableQuest: quest?.id ?? null };
  if (quest === undefined)
    return { line: `${token} = no open ${reference.kind} has this id: it was archived or deleted.`, ...grants };
  return {
    line: `${token} = Quest "${quest.title}" (id ${quest.id}, state ${quest.state}, ${realmLabelOf(quest)}, top thread id ${quest.topThreadId}). This turn you may read its journal with read_journal (mission ${quest.id}) and message its top thread with send_thread_message.`,
    ...grants,
  } satisfies ResolvedMention;
});

const resolveSideQuestMention = Effect.fnUntraced(function* (reference: MentionReference) {
  const sql = yield* SqlClient.SqlClient;
  const token = mentionTokenOf(reference);
  const sideQuest = yield* readSideQuest(reference.id);
  const [quest] = sideQuest === null ? [] : yield* readQuest(sideQuest.missionId);
  const grants = {
    reachableThread: sideQuest === null ? null : reference.id,
    readableQuest: sideQuest?.missionId ?? null,
  };
  if (sideQuest === null || quest === undefined)
    return { line: `${token} = no open ${reference.kind} has this id: it was archived or deleted.`, ...grants };
  const [thread] = yield* sql<{ title: string }>`SELECT title FROM threads WHERE id = ${reference.id}`;
  return {
    line: `${token} = Errand "${thread?.title ?? ""}" of quest "${quest.title}" (thread id ${reference.id}, state ${sideQuest.state}, quest id ${quest.id}, ${realmLabelOf(quest)}). This turn you may read its quest's journal with read_journal (mission ${quest.id}) and message it with send_thread_message.`,
    ...grants,
  } satisfies ResolvedMention;
});

const resolvers = {
  quest: resolveQuestMention,
  realm: resolveRealmMention,
  "side-quest": resolveSideQuestMention,
} satisfies Record<MentionReference["kind"], (reference: MentionReference) => unknown>;

const resolveMention = (reference: MentionReference) => resolvers[reference.kind](reference);

/**
 * What the owner's message tells its receiving thread about the quests, errands, and realms it mentions: a block
 * appended after the owner's own words, which stay as typed; empty when it mentions none.
 */
export const readMentionNote = Effect.fnUntraced(function* (text: string) {
  const references = mentionReferencesOf(text);
  if (references.length === 0) return "";
  const resolved = yield* Effect.forEach(references, resolveMention);
  return `\n\n[The owner mentioned these with @ or #, as context: decide from their words whether to look at each or write to it.\n${resolved.map((mention) => mention.line).join("\n")}]`;
});

/** What a thread may reach beyond its tree during its current turn, from what was delivered to that turn. */
export type TurnReach = {
  /** Threads it may message: the top thread of a mentioned quest, a mentioned errand, and a thread that wrote to it. */
  readonly reachable: ReadonlySet<string>;
  /** Quests whose journal it may read: those the owner mentioned, or whose errand the owner mentioned. */
  readonly readable: ReadonlySet<string>;
};

/**
 * What the owner's mentions and the thread messages delivered into the thread's latest turn open to it (CHG-0181). A
 * mention lasts for the turn it reached: the next turn starts with nothing beyond the tree unless mentioned again. A
 * thread that wrote to it in this turn can be answered, so a reply comes straight back.
 */
export const readTurnReach = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  // A sender being deleted can no longer be answered.
  const delivered = yield* sql<{ text: string; senderKind: string; fromThreadId: string | null; isOwner: number }>`
      SELECT m.text, m.sender_kind AS senderKind, s.id AS fromThreadId, (${isOwnerMessageOf(sql)}) AS isOwner FROM messages m
        LEFT JOIN threads s ON s.id = m.sender_thread_id AND s.is_deleting = 0
      WHERE m.thread_id = ${threadId} AND m.sender_kind IN ('user', 'thread') AND m.delivered_turn_id = (
        SELECT t.id FROM turns t WHERE t.thread_id = ${threadId} ORDER BY t.started_at DESC, t.rowid DESC LIMIT 1)`;
  const readable = new Set<string>();
  const reachable = new Set<string>();
  for (const message of delivered) {
    if (message.senderKind === "thread" && message.fromThreadId !== null) reachable.add(message.fromThreadId);
    if (message.isOwner !== 1) continue;
    for (const reference of mentionReferencesOf(message.text)) {
      const resolved = yield* resolveMention(reference);
      if (resolved.readableQuest !== null) readable.add(resolved.readableQuest);
      if (resolved.reachableThread !== null) reachable.add(resolved.reachableThread);
    }
  }
  reachable.delete(threadId);
  return { reachable, readable } satisfies TurnReach;
});
