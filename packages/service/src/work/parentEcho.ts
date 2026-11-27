import type { SendToParentScope } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { ensureGuildmaster } from "./guildmasterPlace.ts";
import { insertMessage } from "./messaging.ts";
import { isNotBeingDeletedOf, isQuestKindOf } from "./questVisibility.ts";

/** Formats a child thread's visible conversation so its parent can read the full context. */
export const formatThreadContext = Effect.fnUntraced(function* (
  threadId: string,
  excludeMessageId: string | null = null,
) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{
    id: string;
    senderKind: "user" | "agent" | "thread";
    fromTitle: string | null;
    text: string;
  }>`
    SELECT m.id, m.sender_kind AS senderKind, COALESCE(s.title, m.sender_title) AS fromTitle, m.text
    FROM messages m LEFT JOIN threads s ON s.id = m.sender_thread_id
    WHERE m.thread_id = ${threadId}
      AND m.sender_kind IN ('user', 'agent', 'thread')
      AND m.is_conversation_only = 0
    ORDER BY m.sequence ASC`;
  const included = rows.filter((row) => row.id !== excludeMessageId && row.text.trim() !== "");
  if (included.length === 0) return "";
  const lines = included.map((row) => {
    const label =
      row.senderKind === "user" ? "Owner" : row.senderKind === "agent" ? "Companion" : (row.fromTitle ?? "Thread");
    return `**${label}**: ${row.text.trim()}`;
  });
  const count = included.length === 1 ? "1 message" : `${included.length} messages`;
  return `---\n**Thread context** (${count}):\n\n${lines.join("\n\n")}`;
});

/** Appends the child thread's conversation context when requested. */
export const withThreadContext = Effect.fnUntraced(function* (
  threadId: string,
  text: string,
  shouldIncludeContext: boolean,
  excludeMessageId: string | null = null,
) {
  if (!shouldIncludeContext) return text;
  const context = yield* formatThreadContext(threadId, excludeMessageId);
  return context === "" ? text : `${text}\n\n${context}`;
});

const noWakes: ReadonlyArray<string> = [];

/**
 * Echoes an owner message from a quest or errand into its parent conversation.
 * Errands wake their parent quest; quests post to their realm or Borderlands channel without waking Chronicler.
 */
export const echoUserMessageToParent = Effect.fnUntraced(function* (
  threadId: string,
  text: string,
  scope: SendToParentScope,
  sentMessageId: string,
) {
  const sql = yield* SqlClient.SqlClient;
  const [thread] = yield* sql<{
    parentId: string | null;
    workspaceId: string | null;
    isGuildmaster: number;
  }>`
    SELECT t.parent_id AS parentId, t.workspace_id AS workspaceId, ${isQuestKindOf(sql, "chronicler")} AS isGuildmaster
    FROM threads t JOIN missions m ON m.id = t.mission_id
    WHERE t.id = ${threadId} AND ${isNotBeingDeletedOf(sql)}`;
  if (thread === undefined || thread.isGuildmaster === 1) return noWakes;
  const echoText = yield* withThreadContext(threadId, text, scope === "FullContext", sentMessageId);
  if (thread.parentId !== null) {
    const { threadsToWake } = yield* insertMessage({
      fromThreadId: threadId,
      isConversationOnly: false,
      isQueued: false,
      isResult: false,
      text: echoText,
      threadId: thread.parentId,
    });
    return threadsToWake;
  }
  const channel = yield* ensureGuildmaster(thread.workspaceId);
  yield* insertMessage({
    fromThreadId: threadId,
    isConversationOnly: true,
    isQueued: false,
    isResult: false,
    text: echoText,
    threadId: channel.threadId,
  });
  return noWakes;
});
