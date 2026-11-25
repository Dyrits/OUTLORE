import type { PlanLimitReading } from "@outlore/contracts";
import { Clock, Context, Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { Changes, Harness } from "../core/index.ts";
import { configDirectoryOf } from "./accounts.ts";
import { type AccountRef, accountKeyOf } from "./budgetScopes.ts";
import { AccountsRoot } from "./threads.ts";
import { afterFailure, afterRead, type GateState, isReadDue, noReadYet } from "./usageReadGate.ts";

// What each subscription's harness reports of its plan's limits (budget-control, Plan limits): the last reading kept in
// the database, and a read started in the background, never more often than the pacing gate allows.

/** The names of the window lengths that have one. */
const fixedWindowLabels: Readonly<Record<number, string>> = { 1440: "Daily", 10080: "Weekly", 43200: "Monthly" };

/** A window's name from its length in minutes, for example "5-hour" or "Weekly". */
export const windowLabelOf = (minutes: number) =>
  fixedWindowLabels[minutes] ?? (minutes % 60 === 0 ? `${minutes / 60}-hour` : `${minutes}-minute`);

/** The plan limits of provider accounts. */
export class PlanLimits extends Context.Service<
  PlanLimits,
  {
    /**
     * The account's last reading, or null when its harness reports none. Starts a read in the background when one is due
     * and none runs; the change feed announces the new reading.
     */
    readonly latest: (account: AccountRef) => Effect.Effect<PlanLimitReading | null>;
  }
>()("outlore/PlanLimits") {}

const decodeWindows = Schema.decodeUnknownSync(
  Schema.Array(
    Schema.Struct({
      label: Schema.String,
      resetsAt: Schema.Number,
      usedPercent: Schema.Number,
      windowMinutes: Schema.optionalKey(Schema.Number),
    }),
  ),
);

/** The plan limits over the service's database, the harnesses, and the change feed. */
export const planLimitsLayer = Layer.effect(
  PlanLimits,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const harness = yield* Harness;
    const changes = yield* Changes;
    const accountsRoot = yield* AccountsRoot;
    const scope = yield* Effect.scope;
    const gates = new Map<string, GateState>();
    const running = new Set<string>();

    const stored = Effect.fnUntraced(function* (key: string) {
      const [row] = yield* sql<{ readAt: number; windows: string }>`
        SELECT windows, read_at AS readAt FROM plan_limits WHERE account_key = ${key}`;
      return row === undefined
        ? null
        : ({ readAt: row.readAt, windows: decodeWindows(JSON.parse(row.windows)) } satisfies PlanLimitReading);
    }, Effect.orDie);

    /** Reads the account's limits now and keeps them; a harness that reports none leaves no reading. */
    const read = Effect.fnUntraced(
      function* (account: AccountRef, key: string) {
        const configDirectory = configDirectoryOf(accountsRoot, account.accountId);
        const report = yield* harness.readPlanLimits(account.harness, configDirectory);
        const now = yield* Clock.currentTimeMillis;
        if (report === null || report.windows.length === 0) {
          // A harness that reports nothing has not failed: it is asked again after the reading's time, and an
          // earlier reading, which no longer holds (the plan changed), is forgotten rather than shown as current.
          const forgotten = yield* sql`DELETE FROM plan_limits WHERE account_key = ${key} RETURNING account_key`.pipe(
            Effect.orDie,
          );
          gates.set(key, afterRead(now));
          if (forgotten.length > 0) yield* changes.publish;
          return;
        }
        const windows = report.windows.map((window) => ({
          label: window.label ?? windowLabelOf(window.windowMinutes),
          resetsAt: window.resetsAtSeconds * 1000,
          usedPercent: window.usedPercent,
          windowMinutes: window.windowMinutes,
        }));
        yield* sql`INSERT INTO plan_limits (account_key, windows, read_at) VALUES (${key}, ${JSON.stringify(windows)}, ${now})
          ON CONFLICT (account_key) DO UPDATE SET windows = excluded.windows, read_at = excluded.read_at`.pipe(
          Effect.orDie,
        );
        gates.set(key, afterRead(now));
        yield* changes.publish;
      },
      (effect, _account, key) =>
        effect.pipe(
          Effect.onError(() =>
            Clock.currentTimeMillis.pipe(
              Effect.map((now) => gates.set(key, afterFailure(gates.get(key) ?? noReadYet, now))),
            ),
          ),
          Effect.ensuring(Effect.sync(() => running.delete(key))),
          Effect.ignore,
        ),
    );

    const latest = Effect.fnUntraced(function* (account: AccountRef) {
      const key = accountKeyOf(account);
      const now = yield* Clock.currentTimeMillis;
      if (!running.has(key) && isReadDue(gates.get(key) ?? noReadYet, now)) {
        running.add(key);
        yield* Effect.forkIn(read(account, key), scope);
      }
      return yield* stored(key);
    });

    return PlanLimits.of({ latest });
  }),
);
