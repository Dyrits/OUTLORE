import type { MissionState, ThreadAnchor, ThreadId, ThreadState } from "@outlore/contracts";

/** The compact reply-count text shown on an in-feed reply line, or null while the thread has no replies and is not opening. */
export const replyCountLabelOf = (
  replyCount: number | undefined,
  state: ThreadState | MissionState | undefined,
): string | null => {
  if (replyCount === undefined || replyCount <= 0) {
    return state === "Underway" ? "Opening…" : null;
  }
  return replyCount === 1 ? "1 reply" : `${replyCount} replies`;
};

/** Returns the first anchor whose thread was not in `seen`, so a channel can auto-open a newly started quest. */
export const findNewlyAnchoredQuest = (
  anchors: ReadonlyArray<ThreadAnchor>,
  seen: ReadonlySet<ThreadId>,
): ThreadAnchor | null => anchors.find((anchor) => !seen.has(anchor.threadId)) ?? null;
