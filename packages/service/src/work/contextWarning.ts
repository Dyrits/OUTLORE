import type { HarnessName } from "@outlore/contracts";

// The line a thread gets when its context reaches the limit (thread-panel, The context gauge; CHG-0509).

/**
 * The line the thread's conversation shows when its context reaches `limit` tokens: the soft limit every model is held
 * to, or a smaller window the model reports itself. The thread keeps working past either; the line says what to do.
 * Compaction has no action of its own in Outlore (the harnesses compact on their own terms), so it points the owner to
 * the way that needs none: an errand for the next part of the work, which starts light and reads the quest's journal.
 */
export const contextLimitLineOf = (
  limit: { readonly isSoftLimit: boolean; readonly tokens: number },
  harness: HarnessName,
) => {
  const size = limit.tokens.toLocaleString("en-US");
  const reached = limit.isSoftLimit
    ? `This thread's context has reached the soft limit of ${size} tokens. It keeps working past it, but each turn costs more and the model may lose early detail.`
    : `This thread's context has reached its model's window of ${size} tokens, so the model may lose early detail or fail.`;
  const offer =
    "To compact it, open a new errand for the next part of the work: the quest's journal carries what this thread learned.";
  const own =
    harness === "claude"
      ? " Claude Code also compacts on its own near its model's window, and says so here when it does."
      : "";
  return `${reached} ${offer}${own}`;
};

/** Whether the context went from under the limit to at or over it, which is when the line is written (not on every turn past it). */
export const hasReachedLimit = (before: number | null, now: number, limit: number) =>
  now >= limit && (before === null || before < limit);
