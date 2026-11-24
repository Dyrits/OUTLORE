import { Clock, Effect, Layer, PubSub } from "effect";
import { SqlClient } from "effect/sql";
import { Changes, hourMillis, nextStartOf, readGlobalBudget } from "../core/index.ts";
import { releaseBudgets } from "./budgets.ts";
import { Commands } from "./commands.ts";
import { changed, unchanged } from "./followUps.ts";
import { timedSweep } from "./timedSweep.ts";

/**
 * Releases threads held at the global limit, or an account's, once a new period starts and the spending counted since is
 * under it (budget-control, Global budget). It wakes at each period start, and at least hourly while a thread is held,
 * or immediately when a committed change updates budgets or threads.
 */
export const budgetPeriodsLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const commands = yield* Commands;
    const changes = yield* Changes;
    const subscription = yield* PubSub.subscribe(changes.pubsub);
    const release = commands.run(
      Effect.map(releaseBudgets, (released) =>
        released.length === 0 ? unchanged(null) : changed(null, { threadsToWake: released }),
      ),
    );
    const sql = yield* SqlClient.SqlClient;
    const untilNextCheck = Effect.gen(function* () {
      const [held] = yield* sql<{ id: string }>`SELECT id FROM threads WHERE blocker = 'Budget' LIMIT 1`;
      if (held === undefined) return null;
      const now = yield* Clock.currentTimeMillis;
      const { nextStart } = yield* readGlobalBudget;
      // An account's period starting over releases its threads the same way (budget-control, Account budgets).
      const accounts = yield* sql<{ period: "Day" | "Week" | "Month" }>`
        SELECT period FROM account_budgets WHERE period IS NOT NULL`;
      const next = Math.min(nextStart, ...accounts.map((account) => nextStartOf(now, account.period)));
      return Math.max(1, Math.min(next - now, hourMillis));
    });
    yield* timedSweep({
      isRunAtStart: false,
      isWakeOnlyWhenIdle: true,
      name: "The budget-period sweep",
      untilNext: untilNextCheck,
      wakeOn: PubSub.take(subscription),
      work: release,
    });
  }),
);
