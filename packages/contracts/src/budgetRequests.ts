import { Schema } from "effect";
import { BudgetLimits, BudgetPeriod } from "./budgets.ts";
import { HarnessName } from "./harnesses.ts";
import { AccountId, BudgetStopId } from "./ids.ts";

/** Every provider account's use and budget (budget-control, Account budgets and credits). */
export const ReadAccountBudgets = Schema.TaggedStruct("ReadAccountBudgets", {});
/**
 * Sets, changes, or removes an account's budget: limits over a period, or with no period (credits) counted from
 * `since`, a time on the day they were bought; null counts from now.
 */
export const SetAccountBudget = Schema.TaggedStruct("SetAccountBudget", {
  accountId: Schema.NullOr(AccountId),
  harness: HarnessName,
  limits: BudgetLimits,
  period: Schema.NullOr(BudgetPeriod),
  since: Schema.NullOr(Schema.Number),
});
/** Adds credit to an account's cost limit, which has no period. */
export const AddCredit = Schema.TaggedStruct("AddCredit", {
  accountId: Schema.NullOr(AccountId),
  amount: Schema.Number.check(Schema.isGreaterThan(0)),
  harness: HarnessName,
});
/** At an account's budget, hands the held thread to its next backup Companion. */
export const SwitchAtBudget = Schema.TaggedStruct("SwitchAtBudget", { stopId: BudgetStopId });
/** The model price table in use and where it came from (budget-control, The price table). */
export const ReadPriceStatus = Schema.TaggedStruct("ReadPriceStatus", {});
/** Reads the public price table now, as Refresh now in the Workshop does. */
export const RefreshPrices = Schema.TaggedStruct("RefreshPrices", {});
