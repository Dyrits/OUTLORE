import type { ThreadView } from "@outlore/contracts";

/** Which folder a MissingWorkspace notice names: the realm's when it is gone, else the errand's own copy when it has one. */
export type MissingFolder = {
  readonly isOwnCopy: boolean;
  readonly path: string;
};

/** The missing folder to show for a thread held on MissingWorkspace, or null when it has neither realm nor own copy. */
export const missingFolderOf = (thread: Pick<ThreadView, "ownCopy" | "workspace">): MissingFolder | null => {
  if (thread.workspace?.isMissing === true) return { isOwnCopy: false, path: thread.workspace.path };
  if (thread.ownCopy !== null) return { isOwnCopy: true, path: thread.ownCopy.path };
  if (thread.workspace !== null) return { isOwnCopy: false, path: thread.workspace.path };
  return null;
};
