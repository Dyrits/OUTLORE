import { Schema } from "effect";
import { BudgetUse, Consumption, PlanLimitReading, Spending } from "./budgets.ts";
import { BackupCompanions } from "./companions.ts";
import { ContextGauge } from "./contextGauge.ts";

/** What the thread panel shows beyond the thread itself (thread-panel, The panel). */
export const ThreadPanel = Schema.Struct({
  /** The Companions tried in order after a turn of this thread fails; at most five. */
  backups: BackupCompanions,
  /** The mission's budget and its spending, as the quest panel shows them. */
  budget: BudgetUse,
  /** Tools of usable connectors from their last server listing, including switched-off tools. */
  connectorTools: Schema.Array(
    Schema.Struct({
      connectorId: Schema.String,
      connectorName: Schema.String,
      isOn: Schema.Boolean,
      name: Schema.String,
    }),
  ),
  /** What this thread's own turns used, with the estimated cost. */
  consumption: Consumption,
  /** Null until a turn reported usage: shown as "Not measured yet", never guessed. */
  context: Schema.NullOr(ContextGauge),
  /** Outlore's own tools available to the thread's harness. */
  outloreTools: Schema.Array(Schema.String),
  /** The plan limits of the account this thread runs on, as last reported, or null. */
  planLimits: Schema.NullOr(PlanLimitReading),
  /** What this thread alone spent. */
  spending: Spending,
  /** Turns this thread has run with usage reported. */
  turnCount: Schema.Number,
});
export type ThreadPanel = typeof ThreadPanel.Type;
