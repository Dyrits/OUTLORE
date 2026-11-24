import type { ThreadState } from "@outlore/contracts";
import { Clock, Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { Commands } from "./commands.ts";
import { autoArchiveLayer } from "./ending.ts";
import { changed, unchanged } from "./followUps.ts";
import { ensureGuildmaster } from "./guildmasterPlace.ts";
import { appendMessage } from "./messageStorage.ts";
import { questStateOf, shownStatesOf } from "./missionStates.ts";
import { timedSweep } from "./timedSweep.ts";

const hour = 60 * 60 * 1000;
const warningHours = { Attention: 4, Resting: 12 } as const;

// Titles are plain text even when the owner or a Companion gives them Markdown punctuation.
const plainTitleOf = (title: string) => title.replace(/\s+/g, " ").replace(/[!-/:-@[-`{-~]/g, "\\$&");

type QuestThread = {
  readonly id: string;
  readonly parentId: string | null;
  readonly missionId: string;
  readonly topThreadId: string;
  readonly realmId: string;
  readonly state: ThreadState;
  readonly questTitle: string;
  readonly messageId: string | null;
  readonly lastMessageAt: number | null;
};

const postDueMissives = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const now = yield* Clock.currentTimeMillis;
  const threads = yield* sql<QuestThread>`
    SELECT t.id, t.parent_id AS parentId, m.id AS missionId, top.id AS topThreadId, w.id AS realmId,
      t.state, m.title AS questTitle, last.id AS messageId, last.sent_at AS lastMessageAt
    FROM threads t JOIN missions m ON m.id = t.mission_id
      JOIN threads top ON top.id = m.top_thread_id JOIN workspaces w ON w.id = top.workspace_id
      LEFT JOIN messages last ON last.id = (
        SELECT msg.id FROM messages msg
        WHERE msg.thread_id = t.id AND msg.sender_kind IN ('user', 'agent') AND msg.is_conversation_only = 0
        ORDER BY msg.sequence DESC LIMIT 1
      ) AND last.id IS NOT t.inactivity_warned_message_id
    WHERE t.archived_at IS NULL AND t.is_deleting = 0 AND w.archived_at IS NULL
      AND m.ending IS NULL AND m.is_guildmaster = 0
      AND NOT EXISTS (SELECT 1 FROM rituals WHERE mission_id = m.id)
    ORDER BY m.id, t.id`;
  const quests = Map.groupBy(threads, (thread) => thread.missionId);
  let hasPosted = false;
  for (const tree of quests.values()) {
    const top = tree.find((thread) => thread.id === thread.topThreadId);
    if (top === undefined) continue;
    const questState = questStateOf(
      top.state,
      tree.filter((thread) => thread !== top).map((thread) => thread.state),
      false,
    );
    if (questState === "Underway" || questState === "Waiting") continue;
    const shownStates = shownStatesOf(tree.map((thread) => ({ ...thread, isArchived: false })));
    const due = tree.flatMap((thread) => {
      const state = thread === top ? questState : shownStates.get(thread.id);
      const ownState = thread === top && thread.state === "Fulfilled" ? "Resting" : thread.state;
      // A descendant's Attention should use that descendant's last message, not an older ancestor's message.
      if (state !== ownState || (state !== "Attention" && state !== "Resting")) return [];
      const hours = warningHours[state];
      if (thread.lastMessageAt === null || now - thread.lastMessageAt < hours * hour) return [];
      return [{ state, thread }];
    });
    if (due.length === 0) continue;
    const channel = yield* ensureGuildmaster(top.realmId);
    const lines = [plainTitleOf(top.questTitle)];
    for (const [state, warnings] of Map.groupBy(due, (warning) => warning.state)) {
      const hasQuest = warnings.some(({ thread }) => thread === top);
      const errands = warnings.length - Number(hasQuest);
      const hours = warningHours[state];
      if (hasQuest) lines.push(`This quest is in ${state}. Its last message was at least ${hours} hours ago.`);
      if (errands === 1) lines.push(`One errand is in ${state} and last had a message at least ${hours} hours ago.`);
      if (errands > 1)
        lines.push(`${errands} errands are in ${state} and last had messages at least ${hours} hours ago.`);
    }
    yield* appendMessage({
      ...channel,
      fromThreadId: top.id,
      isConversationOnly: true,
      isQueued: false,
      isResult: false,
      now,
      senderKind: "system",
      text: lines.join("\n\n"),
    });
    for (const { thread } of due) {
      yield* sql`UPDATE threads SET inactivity_warned_message_id = ${thread.messageId} WHERE id = ${thread.id}`;
    }
    hasPosted = true;
  }
  return hasPosted ? changed(null) : unchanged(null);
});

const inactivityMissivesLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const commands = yield* Commands;
    yield* timedSweep({
      name: "Inactivity warnings",
      untilNext: Effect.succeed(hour),
      work: commands.run(postDueMissives),
    });
  }),
);

/** Runs independent inactivity and automatic archiving sweeps for quests. */
export const questMaintenanceLayer = Layer.mergeAll(autoArchiveLayer, inactivityMissivesLayer);
