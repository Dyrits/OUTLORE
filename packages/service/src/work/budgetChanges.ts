import type { BudgetLimits } from "@outlore/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import {
  changeTextOf,
  invalid,
  isEmpty,
  limitsTextOf,
  missionLimitsOf,
  notFound,
  readGlobalBudget,
} from "../core/index.ts";
import { fallBackToBackup } from "./backups.ts";
import { accountLabelOf, type BudgetScope, isScopeReached, scopeOfStop, threadsWhere } from "./budgetScopes.ts";
import { enforceBudgets, insertEvent, insertGlobalEvent, releaseBudgets, stopScope } from "./budgets.ts";
import { changed } from "./followUps.ts";
import { haltThreads, releaseThread } from "./lifecycle.ts";

// The owner's answers to a budget stop, and the budget changes they make (budget-control, Reaching a limit): carry on, switch to a backup, or raise the limit.

/** The held threads under a scope, to stop or to carry on. */
const heldThreadsOf = Effect.fnUntraced(function* (scope: BudgetScope) {
  const sql = yield* SqlClient.SqlClient;
  return yield* sql<{ id: string; missionId: string }>`
      SELECT id, mission_id AS missionId FROM threads
      WHERE blocker = 'Budget' AND state = 'Attention' AND ${threadsWhere(sql, scope)}`;
});

/** A budget stop still waiting for the owner's answer; fails when there is none, or it was answered. */
const readOpenStop = Effect.fnUntraced(function* (stopId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [stop] = yield* sql<{
    accountKey: string | null;
    missionId: string | null;
    resolution: string | null;
    threadId: string;
  }>`SELECT mission_id AS missionId, account_key AS accountKey, resolution, thread_id AS threadId
      FROM budget_stops WHERE id = ${stopId}`;
  if (stop === undefined) return yield* notFound("No such budget stop.");
  if (stop.resolution !== null) return yield* invalid("This budget question was already answered.");
  return stop;
});

/**
 * The owner answers Stop: the stop's held threads become Stopped and keep their messages, and the missions
 * whose threads stopped are woken.
 */
export const stopAtBudget = Effect.fnUntraced(function* (stopId: string) {
  const sql = yield* SqlClient.SqlClient;
  const stop = yield* readOpenStop(stopId);
  const now = yield* Clock.currentTimeMillis;
  yield* sql`UPDATE budget_stops SET resolution = 'Stopped', resolved_at = ${now} WHERE id = ${stopId}`;
  const held = yield* heldThreadsOf(scopeOfStop(stop));
  yield* haltThreads(
    held.map((thread) => thread.id),
    "Stopped",
  );
  return changed(null, { missionsToWake: [...new Set(held.map((thread) => thread.missionId))] });
});

/**
 * The owner answers Switch to a backup Companion at an account's budget: the thread that holds the question carries on
 * with its next backup on another account or harness (a backup on the same account is passed over), and the threads still held by the account stay held under
 * the same question. Refused when the stop is not an account's or the thread has no backup to take.
 */
export const switchAtBudget = Effect.fnUntraced(function* (stopId: string) {
  const sql = yield* SqlClient.SqlClient;
  const stop = yield* readOpenStop(stopId);
  const scope = scopeOfStop(stop);
  if (scope._tag !== "Account") return yield* invalid("Only an account's budget offers a backup Companion.");
  // A held thread is in Attention, which a change of runner refuses: it is released first, and the whole answer is
  // undone when it has no backup to take.
  yield* releaseThread(stop.threadId);
  const reason = `Account ${yield* accountLabelOf(scope)} reached its budget`;
  const switched = yield* fallBackToBackup(stop.threadId, reason, { isOtherAccountRequired: true });
  if (!switched.followUps.isChanged)
    return yield* invalid("This thread has no backup Companion on another account that can take this message.");
  const others = (yield* heldThreadsOf(scope)).filter((thread) => thread.id !== stop.threadId);
  const now = yield* Clock.currentTimeMillis;
  if (others[0] === undefined)
    yield* sql`UPDATE budget_stops SET resolution = 'Switched', resolved_at = ${now} WHERE id = ${stopId}`;
  else yield* sql`UPDATE budget_stops SET thread_id = ${others[0].id} WHERE id = ${stopId}`;
  return switched;
});

/** After a scope's budget changed: `halt` stops the work under it if it is now reached, then held threads are released. */
const applyScopeChange = Effect.fnUntraced(function* <E, R>(
  scope: BudgetScope,
  halt: Effect.Effect<ReadonlyArray<string>, E, R>,
) {
  const halted = (yield* isScopeReached(scope)) ? yield* halt : [];
  return changed(null, { threadsToWake: yield* releaseBudgets, turnsToCancel: halted });
});

/**
 * The owner sets, changes, or removes a mission's budget: the line is recorded, then work stops if the
 * budget is now reached, or held threads are released: the halted turns are cancelled and the released
 * threads woken.
 */
export const setMissionBudget = Effect.fnUntraced(function* (missionId: string, limits: BudgetLimits) {
  const sql = yield* SqlClient.SqlClient;
  const [mission] = yield* sql<{
    topThreadId: string;
  }>`SELECT top_thread_id AS topThreadId FROM missions WHERE id = ${missionId}`;
  if (mission === undefined) return yield* notFound("No such mission.");
  const before = yield* missionLimitsOf(missionId);
  yield* sql`UPDATE missions SET budget_cost = ${limits.cost}, budget_tokens = ${limits.tokens} WHERE id = ${missionId}`;
  const text = changeTextOf(before, limits);
  if (text !== null) yield* insertEvent(missionId, text);
  return yield* applyScopeChange({ _tag: "Mission", id: missionId }, enforceBudgets(missionId, mission.topThreadId));
});

/**
 * After the global budget changed: work stops if it is reached, or held threads are released; the halted
 * turns are cancelled and the released threads woken.
 */
export const applyGlobalBudget = Effect.fnUntraced(function* (before: BudgetLimits) {
  const global = yield* readGlobalBudget;
  const text = changeTextOf(before, global.limits);
  if (text !== null) yield* insertGlobalEvent(text.replace(/^Budget/, "Global budget"));
  return yield* applyScopeChange({ _tag: "Global" }, stopScope({ _tag: "Global" }, null));
});

/**
 * After an account's budget changed: its threads stop if it is now reached, or held threads are released; the halted
 * turns are cancelled and the released threads woken.
 */
export const applyAccountBudget = (scope: BudgetScope & { _tag: "Account" }) =>
  applyScopeChange(scope, stopScope(scope, null));

/** Records a new mission's budget, copied from the default, with its line. Callers run it in a transaction. */
export const applyDefaultBudget = Effect.fnUntraced(function* (missionId: string, limits: BudgetLimits) {
  const sql = yield* SqlClient.SqlClient;
  if (isEmpty(limits)) return;
  yield* sql`UPDATE missions SET budget_cost = ${limits.cost}, budget_tokens = ${limits.tokens} WHERE id = ${missionId}`;
  yield* insertEvent(missionId, `Budget set: ${limitsTextOf(limits)}`);
});
