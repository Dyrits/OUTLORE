import type { TokenUsage } from "@outlore/contracts";

/** What a model call's prompt and reply held, or null when the call reported no usage. */
export const contextOf = (usage: TokenUsage | null) =>
  usage === null ? null : usage.input + usage.cacheRead + usage.cacheCreation + usage.output;
