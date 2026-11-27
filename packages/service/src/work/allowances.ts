import { Effect } from "effect";
import type { SqlError } from "effect/sql";

// The one-time allowances (action-approval, CHG-0063): targets the owner approved through `request_approval` that the next
// matching harness prompt may run once, in the turn they were given in. They are kept by run key, so a run beside a thread's
// main turn (a thread's main run is keyed by the thread's id; work/turnScopes.ts) neither spends nor loses the main turn's.

type Grant = { readonly isOutsideSandbox: boolean; readonly target: string; readonly turnId: string };

/** The allowances held in memory; `readTurnId` answers the turn a thread is running now, which a grant must have been given in. */
export const makeAllowances = (readTurnId: (threadId: string) => Effect.Effect<string | null, SqlError.SqlError>) => {
  // Each run keeps its thread, so a withdrawal of the thread clears every run's.
  const held = new Map<string, { readonly grants: ReadonlyArray<Grant>; readonly threadId: string }>();
  return {
    /** Lets the exact target run once for the run, in the turn it was approved in. */
    allow: (threadId: string, runKey: string, target: string, turnId: string, isOutsideSandbox: boolean) =>
      Effect.sync(() =>
        held.set(runKey, {
          grants: [...(held.get(runKey)?.grants ?? []), { isOutsideSandbox, target: target.trim(), turnId }],
          threadId,
        }),
      ),
    /** The run's turn ends: what it was allowed once is spent, and no other run's. */
    end: (runKey: string) => Effect.sync(() => void held.delete(runKey)),
    /** The thread's questions are withdrawn: every run's allowances go with them. */
    forgetThread: (threadId: string) => {
      for (const [runKey, entry] of [...held]) if (entry.threadId === threadId) held.delete(runKey);
    },
    /** Spends the run's allowance for the target if its turn is the thread's running turn; whether there was one. */
    take: Effect.fnUntraced(function* (threadId: string, runKey: string, target: string, isOutsideSandbox: boolean) {
      const turnId = yield* readTurnId(threadId);
      const grants = held.get(runKey)?.grants ?? [];
      const index = grants.findIndex(
        (grant) =>
          grant.target === target.trim() && grant.turnId === turnId && grant.isOutsideSandbox === isOutsideSandbox,
      );
      if (index === -1) return false;
      held.set(runKey, { grants: grants.toSpliced(index, 1), threadId });
      return true;
    }),
  };
};
