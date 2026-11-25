import type { AccountId, EffortChoice, HarnessName, ModelChoice } from "@outlore/contracts";

/** What a thread runs on: its harness, provider account (null for the computer's own sign-in), model, and effort. */
export type Runner = {
  readonly accountId: AccountId | null;
  readonly effort: EffortChoice;
  readonly harness: HarnessName;
  readonly model: ModelChoice;
};
