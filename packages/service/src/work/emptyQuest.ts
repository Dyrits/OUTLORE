/**
 * The SQL condition that holds for a quest carrying nothing worth keeping: it used no tokens, holds no message, and is
 * not a Ritual's (mission-tracking, Ending a mission). Archiving such a quest deletes it, and the sidebar offers
 * Delete instead of Archive on it. `missionId` is a column expression, such as `m.id`.
 */
export const emptyQuestCondition = (missionId: string) =>
  `(NOT EXISTS(SELECT 1 FROM rituals WHERE mission_id = ${missionId})
    AND NOT EXISTS(SELECT 1 FROM messages WHERE thread_id IN (SELECT id FROM threads WHERE mission_id = ${missionId}))
    AND COALESCE((SELECT SUM(input + output + cache_read + cache_creation) FROM usage WHERE mission_id = ${missionId}), 0) = 0)`;

/**
 * The SQL condition that holds for an errand carrying nothing worth keeping: it holds no message of its own, ran no
 * turn, and has no errand beneath it. The message it hangs from belongs to its parent conversation, so it does not
 * count. Archiving such an errand deletes it, and the errand's controls offer Delete instead of Archive on it.
 * `threadId` is a column expression, such as `t.id`.
 */
export const emptyErrandCondition = (threadId: string) =>
  `(NOT EXISTS(SELECT 1 FROM messages WHERE thread_id = ${threadId})
    AND NOT EXISTS(SELECT 1 FROM turns WHERE thread_id = ${threadId})
    AND NOT EXISTS(SELECT 1 FROM threads WHERE parent_id = ${threadId}))`;
