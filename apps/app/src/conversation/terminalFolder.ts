import type { ThreadView } from "@outlore/contracts";

/**
 * Where a thread's `!` terminal starts: the worktree the thread works in (its own copy, which a thread keeps for its
 * whole life), else its workspace's folder, else null for the owner's home (conversation-terminal).
 */
export const terminalFolderOf = (thread: Pick<ThreadView, "ownCopy" | "workspace"> | null): string | null =>
  thread?.ownCopy?.path ?? thread?.workspace?.path ?? null;
