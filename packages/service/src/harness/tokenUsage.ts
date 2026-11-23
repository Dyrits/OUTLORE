import type { TokenUsage } from "@outlore/contracts";

/** What a model call's prompt and reply held, or null when the call reported no usage. */
export const contextOf = (usage: TokenUsage | null) =>
  usage === null ? null : usage.input + usage.cacheRead + usage.cacheCreation + usage.output;

/** Sums the usage of the prompts of one turn; unknown when none reported any. */
export const addUsage = (total: TokenUsage | null, usage: TokenUsage | null): TokenUsage | null =>
  total === null || usage === null
    ? (total ?? usage)
    : {
        cacheCreation: total.cacheCreation + usage.cacheCreation,
        cacheRead: total.cacheRead + usage.cacheRead,
        input: total.input + usage.input,
        output: total.output + usage.output,
      };
