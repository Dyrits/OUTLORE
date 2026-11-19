import type { TokenUsage } from "@outlore/contracts";
import { numberFieldOf } from "../core/index.ts";

/** A turn's usage from the prompt's answer, whose input excludes the cached part. */
export const usageOf = (usage: unknown): TokenUsage | null =>
  usage === undefined || usage === null
    ? null
    : {
        cacheCreation: numberFieldOf(usage, "cachedWriteTokens"),
        cacheRead: numberFieldOf(usage, "cachedReadTokens"),
        input: numberFieldOf(usage, "inputTokens"),
        output: numberFieldOf(usage, "outputTokens") + numberFieldOf(usage, "thoughtTokens"),
      };

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
