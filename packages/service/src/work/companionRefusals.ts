import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { HarnessTools, harnessLabels, isAntigravityLimitFor } from "../harness/index.ts";
import { configDirectoryOf } from "./accounts.ts";
import { type AccountRef, reachedScopesOf } from "./budgetScopes.ts";
import type { CompanionThread } from "./companionThreads.ts";
import { PlanLimits } from "./planLimits.ts";
import { AccountsRoot } from "./threads.ts";

// Why a Companion cannot answer before it is asked (thread-messaging, Mentioning a Companion with @): its account is gone
// or signed out, a budget is reached, or its plan reports a limit used up. The cause is the Companion's own answer in the
// conversation, in plain words, with when it resets when the plan says.

const whoseBudget = { Account: "its account's", Global: "the global", Mission: "its" } as const;

/** A moment as the owner reads a reset: the time of day, with the day when it is not today. */
const resetTextOf = (resetsAt: number, now: number) => {
  const at = new Date(resetsAt);
  const time = at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return at.toDateString() === new Date(now).toDateString()
    ? time
    : `${at.toLocaleDateString([], { day: "numeric", month: "short" })}, ${time}`;
};

/**
 * Whether a window of the plan's limits applies to the Companion's model.
 * Only Antigravity names groups ("Gemini · Weekly", "Others · Weekly"), so there a grouped window binds only models of its group; any other window binds every model of its harness.
 */
const isLimitFor = (companion: CompanionThread, label: string) =>
  companion.harness !== "antigravity" || isAntigravityLimitFor(label, companion.model);

/**
 * The used-up, not yet reset windows of the plan's limits that apply to the Companion's model, told as one reason, or null when none.
 * With several used up it gives the latest reset, because the Companion can answer only once all have reset.
 */
const usageLimitOf = Effect.fnUntraced(function* (companion: CompanionThread, account: AccountRef) {
  const reading = yield* (yield* PlanLimits).latest(account);
  const now = yield* Clock.currentTimeMillis;
  const used = (reading?.windows ?? []).filter(
    (window) => window.usedPercent >= 100 && window.resetsAt > now && isLimitFor(companion, window.label),
  );
  if (used.length === 0) return null;
  const resetsAt = Math.max(...used.map((window) => window.resetsAt));
  return `its usage limit is reached (resets at ${resetTextOf(resetsAt, now)})`;
});

/**
 * Why the Companion cannot answer now, or null when it can: its account removed or signed out, its harness not
 * installed, a budget reached, or its plan's limit used up. An API key account is signed in while its key is held, which
 * the turn reads when it starts, so a key it cannot read fails the turn and is told then.
 */
export const readCompanionRefusal = Effect.fnUntraced(function* (companion: CompanionThread) {
  const sql = yield* SqlClient.SqlClient;
  const tools = yield* HarnessTools;
  const accountsRoot = yield* AccountsRoot;
  const label = harnessLabels[companion.harness];
  const account: AccountRef = { accountId: companion.accountId, harness: companion.harness };
  if (companion.accountId !== null) {
    const [row] = yield* sql<{ keyProvider: string | null }>`
      SELECT key_provider AS keyProvider FROM accounts WHERE id = ${companion.accountId} AND harness = ${companion.harness}`;
    if (row === undefined) return "its account is no longer in Outlore";
    const installation = yield* tools.inspect(companion.harness);
    if (installation.problem !== null) return `${label} cannot run: ${installation.problem}`;
    if (row.keyProvider === null) {
      const status = yield* tools.readSignIn(companion.harness, configDirectoryOf(accountsRoot, companion.accountId));
      if (status.signIn === "SignedOut") return "its account is signed out";
    }
  } else {
    const installation = yield* tools.inspect(companion.harness);
    if (installation.problem !== null) return `${label} cannot run: ${installation.problem}`;
    if ((yield* tools.readSignIn(companion.harness, null)).signIn === "SignedOut") return "its account is signed out";
  }
  const [reached] = yield* reachedScopesOf(companion.missionId, account);
  if (reached !== undefined) return `${whoseBudget[reached._tag]} budget is reached; only the owner can raise it`;
  return yield* usageLimitOf(companion, account);
});
