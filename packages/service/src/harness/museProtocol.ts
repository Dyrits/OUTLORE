import type { TokenUsage } from "@outlore/contracts";
import { type HarnessPrompt, numberFieldOf } from "../core/index.ts";

// Pure shapes of the Muse Session Protocol, as the adapter and its checks read and write them. The wire
// types come from @muse-code/sdk; nothing here owns a process or a connection (ADR 0008: the native
// protocol is driven directly, through the SDK's facade).

/** A choice offered by Muse for one approval requirement. */
export type MuseApprovalChoice = {
  /** Whether Muse takes guidance text with this choice (its `acceptsFeedback`). */
  readonly acceptsFeedback?: boolean;
  readonly choiceId: string;
  readonly decision: string;
  readonly scope: string;
};

/** Select only a one-time grant; absence means the caller must stop rather than guess. */
export const museApprovalChoice = (choices: ReadonlyArray<MuseApprovalChoice>, isAllowed: boolean): string | null => {
  const choice = isAllowed
    ? choices.find((candidate) => candidate.decision === "approved" && candidate.scope === "once")
    : (choices.find((candidate) => candidate.decision === "denied") ??
      choices.find((candidate) => candidate.decision === "abort"));
  return choice?.choiceId ?? null;
};

/** One of Muse's approval requests, as the adapter reads it off the wire. */
export type MuseApproval = {
  readonly approvalId: string;
  readonly availableChoices: ReadonlyArray<MuseApprovalChoice>;
  readonly rawArgs: string;
  readonly toolName: string;
};

/** One of Muse's requests to run a consequential action, as Outlore asks its owner about it. */
export const musePromptOf = (approval: MuseApproval): HarnessPrompt => ({
  input: museInputOf(approval.rawArgs),
  toolName: approval.toolName,
});

/** A tool call's arguments as the ask shows them: the model's JSON when it parses, the verbatim text else. */
export const museInputOf = (rawArgs: string): unknown => {
  if (rawArgs.trim() === "") return {};
  try {
    return JSON.parse(rawArgs);
  } catch {
    return rawArgs;
  }
};

/** Muse's token usage of one turn, as Outlore records it; reasoning is output-side, as Vibe's thought tokens are. */
export const museUsageOf = (usage: unknown): TokenUsage | null => {
  if (usage === undefined || usage === null || typeof usage !== "object") return null;
  const read = (key: string) => Math.max(0, numberFieldOf(usage, key));
  if (read("inputTokens") === 0 && read("outputTokens") === 0) return null;
  return {
    cacheCreation: read("cacheWriteTokens"),
    cacheRead: read("cacheReadTokens"),
    input: read("inputTokens"),
    output: read("outputTokens") + read("reasoningTokens"),
  };
};

/** Muse's own reasoning efforts, by their wire names (the SDK's surface is closed to eight levels). */
export type MuseReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max" | "ultra";

/** Muse's own reasoning efforts, read as strings so decoders stay one place. */
const museReasoningEfforts: ReadonlyArray<string> = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "ultra",
];

/** The reasoning effort Muse takes, by its own name; the model's own when the effort is not one of its levels. */
export const museReasoningEffortOf = (effort: string): MuseReasoningEffort | null =>
  museReasoningEfforts.includes(effort) ? (effort as MuseReasoningEffort) : null;
