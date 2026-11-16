import type { Consumption } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient, type Statement } from "effect/sql";
import { consumptionColumns } from "../core/index.ts";

// What turns used, shown rather than counted (budget-control, Estimated cost): the one read model behind the quest card,
// the quest and thread panels, the dashboard row, and the budget window, so a figure cannot differ between screens.

/** The columns `consumptionColumns` selects, as a row. */
export type ConsumptionRow = {
  readonly cacheCreation: number;
  readonly cacheRead: number;
  readonly earlierTurns: number;
  readonly estimated: number;
  readonly input: number;
  readonly output: number;
  readonly reported: number;
  readonly turns: number;
  readonly unpricedTurns: number;
};

/** A consumption read from a row of `consumptionColumns`. */
export const consumptionOf = (row: ConsumptionRow): Consumption => ({
  earlierTurns: row.earlierTurns,
  estimated: row.estimated,
  reported: row.reported,
  tokens: { cacheCreation: row.cacheCreation, cacheRead: row.cacheRead, input: row.input, output: row.output },
  turns: row.turns,
  unpricedTurns: row.unpricedTurns,
});

/** What the usage rows `where` selects used; an aggregate always returns a row, so none is a defect. */
export const readConsumptionWhere = Effect.fnUntraced(function* (where: Statement.Fragment) {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<ConsumptionRow>`SELECT ${sql.literal(consumptionColumns)} FROM usage u WHERE ${where}`;
  if (row === undefined) return yield* Effect.die(new Error("An aggregate read returned no row."));
  return consumptionOf(row);
});

/** What the turns of one thread used. */
export const readThreadConsumption = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  return yield* readConsumptionWhere(sql`u.thread_id = ${threadId}`);
});
