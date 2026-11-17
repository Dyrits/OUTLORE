import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { newId } from "../core/index.ts";

/** What a resolved card shows in a conversation: the quest or Ritual a thread opened, as a card with a link. */
export type ResolvedCard = {
  /** The thread whose conversation shows the card. */
  readonly callerId: string;
  readonly isRitual: boolean;
  readonly realmPath: string | null;
  readonly target: { readonly missionId: string; readonly threadId: string; readonly title: string };
  readonly text: string;
  readonly title: string;
};

/** Records, in the caller's conversation, a card for the quest or Ritual it opened for the owner without asking. */
export const recordResolvedCard = Effect.fnUntraced(function* (card: ResolvedCard) {
  const sql = yield* SqlClient.SqlClient;
  const [caller] = yield* sql<{
    missionId: string;
  }>`SELECT mission_id AS missionId FROM threads WHERE id = ${card.callerId}`;
  const now = yield* Clock.currentTimeMillis;
  const cardId = yield* newId;
  yield* sql`INSERT INTO suggestions (id, mission_id, thread_id, text, title, matches, asked_at, outcome, is_automatic,
        is_ritual, target_mission_id, target_thread_id, target_title, resolved_at, realm_path)
      VALUES (${cardId}, ${caller?.missionId ?? ""}, ${card.callerId}, ${card.text}, ${card.title}, '[]', ${now},
        'MovedToMission', 1, ${card.isRitual ? 1 : 0}, ${card.target.missionId}, ${card.target.threadId}, ${card.target.title}, ${now}, ${card.realmPath})`;
});
