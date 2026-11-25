import type { StartingContext, StartingContextParts, Suggestion, SuggestionOutcome } from "@outlore/contracts";
import { countedOf, countOf, tokenCountOf } from "./countLabels";

// The labels are split by what they describe; this file keeps the names other folders import working.
export { countedOf, tokenCountOf } from "./countLabels";
export * from "./loreLabels";
export * from "./spendLabels";

const sideQuestsOf = (count: number) => countedOf(count, "errand");

/** The mark on a thread that folds agent-opened threads beneath it, for example "+3 errands". */
export const foldedLabelOf = (count: number) => `+${sideQuestsOf(count)}`;

/** The one deletion confirmation: the threads beneath, and the running ones only when some run. */
export const deletionQuestionOf = (preview: {
  readonly descendantCount: number;
  readonly runningCount: number;
  readonly isMission: boolean;
}) => {
  const beneath = preview.descendantCount === 0 ? "" : ` and ${sideQuestsOf(preview.descendantCount)} beneath it`;
  const running =
    preview.runningCount === 0
      ? ""
      : preview.descendantCount === 0
        ? " (running)"
        : ` (${preview.runningCount} running)`;
  return `Delete this ${preview.isMission ? "quest" : "errand"}${beneath}${running}?`;
};

/** Who wrote a journal entry, as the Journal view names it. */
export const journalAuthorOf = (entry: {
  readonly authorKind: "thread" | "user";
  readonly authorTitle: string | null;
}) => (entry.authorKind === "user" ? "You" : `"${entry.authorTitle ?? ""}"`);
/** The briefing's estimated size against its limit, for example "About 120 of 2,000 tokens". */
export const briefingSizeOf = (tokens: number, limit: number) =>
  `About ${countOf(tokens)} of ${countOf(limit)} tokens${tokens > limit ? ": over the limit" : ""}`;

/** The warning before a thread starts with too large a starting context (thread-tree, Opening a thread). */
export const startingContextWarningOf = (context: StartingContext) =>
  `This errand would start with about ${tokenCountOf(context.tokens)} tokens, ${Math.round((context.tokens * 100) / context.windowTokens)}% of the model's ${countOf(context.windowTokens)}-token context window; the warning is at ${context.warningPercent}%.`;

/** Each part of a starting context with its tokens, for example "Request 100 · Journal 50 · … tokens". */
export const startingContextPartsOf = (parts: StartingContextParts) =>
  [
    `Request ${tokenCountOf(parts.request)}`,
    `Journal ${tokenCountOf(parts.journal)}`,
    `Lore ${tokenCountOf(parts.lore)}`,
    `Opener's messages ${tokenCountOf(parts.openerMessages)}`,
    `Realm ${tokenCountOf(parts.workspace)}`,
    `Instructions ${tokenCountOf(parts.instructions)}`,
    `Title and budget ${tokenCountOf(parts.position + parts.budget)} tokens`,
  ].join(" · ");

/** A dashboard row's thread count, for example "1 quest · 4 errands · 2 running". */
export const threadCountOf = (mission: { readonly runningCount: number; readonly threadCount: number }) =>
  `1 quest · ${sideQuestsOf(Math.max(0, mission.threadCount - 1))}${mission.runningCount === 0 ? "" : ` · ${mission.runningCount} running`}`;

/** What the line left behind says about where an off-topic request went (thread-tree, Off-topic requests). */
export const suggestionLabels = {
  Continued: "Continued in quest",
  KeptAsAside: "Kept as aside",
  MovedToMission: "Moved to quest",
  Withdrawn: "Off-topic suggestion withdrawn",
} as const satisfies Record<SuggestionOutcome, string>;

/** Describes a settled suggestion in both the conversation and its quest cards. */
export const settledSuggestionLabelOf = (suggestion: Suggestion) =>
  suggestion.isRitual
    ? "Created Ritual"
    : suggestion.isFromGuildmaster && suggestion.outcome === "MovedToMission"
      ? "Opened quest"
      : suggestionLabels[suggestion.outcome ?? "Continued"];
