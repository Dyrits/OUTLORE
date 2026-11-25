import { Effect } from "effect";
import { type PriceTable, ServiceFailure } from "../core/index.ts";
import { addCredit, readAccountBudgets, setAccountBudget } from "./accountBudgets.ts";
import { setMissionBudget, stopAtBudget, switchAtBudget } from "./budgetChanges.ts";
import { readBudgetWindow } from "./budgetViews.ts";
import type { HandlerDependencies, OwnerHandlers } from "./requestContext.ts";
import { readUsage } from "./usageReport.ts";

/** Requests for budgets, usage and the model price table share the service request context. */
export const budgetsHandlers = ({ commands }: Pick<HandlerDependencies, "commands">, prices: PriceTable["Service"]) =>
  ({
    AddCredit: (given) => commands.run(addCredit({ accountId: given.accountId, harness: given.harness }, given.amount)),
    ReadAccountBudgets: () => readAccountBudgets,
    ReadBudget: (read) => readBudgetWindow(read.missionId),
    ReadPriceStatus: () => prices.status,
    ReadUsage: (read) => readUsage(read.period, read.filters),
    RefreshPrices: () =>
      prices.refresh.pipe(
        Effect.catchTag("PriceReadFailed", (failure) =>
          Effect.fail(new ServiceFailure({ kind: "ExecutionFailure", message: failure.reason })),
        ),
      ),
    SetAccountBudget: (given) =>
      commands.run(
        setAccountBudget(
          { accountId: given.accountId, harness: given.harness },
          given.limits,
          given.period,
          given.since,
        ),
      ),
    SetMissionBudget: (given) => commands.run(setMissionBudget(given.missionId, given.limits)),
    StopAtBudget: (given) => commands.run(stopAtBudget(given.stopId)),
    SwitchAtBudget: (given) => commands.run(switchAtBudget(given.stopId)),
  }) satisfies OwnerHandlers<
    | "AddCredit"
    | "ReadAccountBudgets"
    | "ReadBudget"
    | "ReadPriceStatus"
    | "ReadUsage"
    | "RefreshPrices"
    | "SetAccountBudget"
    | "SetMissionBudget"
    | "StopAtBudget"
    | "SwitchAtBudget"
  >;
