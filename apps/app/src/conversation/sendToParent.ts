import type { MissionDetail, SendToParentScope } from "@outlore/contracts";

/** The parent conversation label for the "Also send to <parent>" checkbox, or null when the thread has no parent. */
export const parentTargetLabelOf = (detail: MissionDetail): string | null => {
  if (detail.thread.parentId != null) {
    const parent = detail.threads.find((candidate) => candidate.id === detail.thread.parentId);
    const title = parent?.title.trim() ?? "";
    return title === "" ? "parent quest" : title;
  }
  if (detail.mission.ritual != null) return null;
  return detail.thread.workspace?.name ?? "Borderlands";
};

/** Resolves the `sendToParent` scope from the checkbox and context toggle. */
export const sendToParentScopeOf = (isChecked: boolean, shouldIncludeFullContext: boolean): SendToParentScope | null =>
  isChecked ? (shouldIncludeFullContext ? "FullContext" : "MessageOnly") : null;
