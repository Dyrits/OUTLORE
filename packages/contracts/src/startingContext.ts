import { Schema } from "effect";
import { ModelChoice } from "./companions.ts";

/** What a new thread's starting context takes, in estimated tokens, by part (thread-tree, Opening a thread). */
export const StartingContextParts = Schema.Struct({
  /** The budget line; none without a budget. */
  budget: Schema.Number,
  /** The instructions every thread receives: on threads, the journal, lore, and approvals. */
  instructions: Schema.Number,
  /** The mission's briefing and its latest entries. */
  journal: Schema.Number,
  /** The lore in the new thread's scope: scoped lore in full and the global index. */
  lore: Schema.Number,
  /** The opener's messages since the journal's latest entry. */
  openerMessages: Schema.Number,
  /** The line naming the new thread's title and its opener's. */
  position: Schema.Number,
  /** The opener's request, the new thread's first message. */
  request: Schema.Number,
  /** The working folder: the workspace with its own instructions, or the mission's scratch folder. */
  workspace: Schema.Number,
});
export type StartingContextParts = typeof StartingContextParts.Type;

/** How much of the chosen model's context window a new thread's starting context would take (thread-tree, Opening a thread). */
export const StartingContext = Schema.Struct({
  /** Whether it takes more than the warning share, so the owner is warned before the thread starts. */
  isOverWarning: Schema.Boolean,
  /** The models with a larger context window than the chosen one, largest first. */
  largerModels: Schema.Array(ModelChoice),
  parts: StartingContextParts,
  /** The whole starting context: the sum of its parts. */
  tokens: Schema.Number,
  /** The share in percent above which the owner is warned. */
  warningPercent: Schema.Number,
  /** The chosen model's context window, in tokens. */
  windowTokens: Schema.Number,
});
export type StartingContext = typeof StartingContext.Type;
