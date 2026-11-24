import { Effect, Layer } from "effect";
import { dayMillis, PriceTable } from "../core/index.ts";
import { timedSweep } from "./timedSweep.ts";

/**
 * Reads the public price table at startup and then daily, while the Charter's Fetch prices switch is on; a failed
 * read keeps the table as it was and tries again at the next time (budget-control, The price table).
 */
export const priceRefreshLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const prices = yield* PriceTable;
    yield* timedSweep({ name: "The price refresh", untilNext: Effect.succeed(dayMillis), work: prices.refresh });
  }),
);
