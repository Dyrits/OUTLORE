import type { ThreadView } from "@outlore/contracts";

/**
 * Where a thread's `!` terminal starts: the git worktree the thread's own tool calls moved into, as its host inferred it,
 * else the worktree it works in (its own copy, which a thread keeps for its whole life), else its workspace's folder, else
 * null for the owner's home (conversation-terminal). A host that infers no folder sends none, and the rest still hold.
 */
export const terminalFolderOf = (
  thread: Pick<ThreadView, "ownCopy" | "workingFolder" | "workspace"> | null,
): string | null => thread?.workingFolder ?? thread?.ownCopy?.path ?? thread?.workspace?.path ?? null;
