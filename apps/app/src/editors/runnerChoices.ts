import type { AccountId, EffortChoice, HarnessInfo, HarnessList, HarnessName, ModelChoice } from "@outlore/contracts";
import { harnessOfAccount } from "./accountModels";
import type { Runner } from "./runners";

/** The effort levels a harness's model list gives for a model; undefined when the list does not say (OpenCode). */
export const listedEffortsOf = (harness: HarnessInfo | undefined, model: ModelChoice) =>
  harness?.models.find((option) => option.id === model)?.efforts;

/**
 * The effort kept when the model changes: the same when the new model's list offers it, else the model's own
 * default, also when its levels are only known once asked (OpenCode).
 */
export const effortFor = (harness: HarnessInfo | undefined, model: ModelChoice, effort: EffortChoice): EffortChoice =>
  listedEffortsOf(harness, model)?.includes(effort) === true ? effort : "default";

/** The runner selected from a harness, account and model, keeping compatible effort. */
export const companionOf = (
  harnesses: HarnessList | null,
  value: Runner,
  harness: HarnessName,
  accountId: AccountId | null,
  model: ModelChoice,
): Runner => ({
  accountId,
  effort: effortFor(
    harnessOfAccount(
      harnesses?.harnesses.find((candidate) => candidate.name === harness),
      accountId,
    ),
    model,
    value.effort,
  ),
  harness,
  model,
});

/** Changing harness starts on its own sign-in and first model. */
export const changedHarnessOf = (harnesses: HarnessList | null, value: Runner, harness: HarnessName): Runner => {
  if (value.harness === harness) return value;
  const info = harnessOfAccount(
    harnesses?.harnesses.find((candidate) => candidate.name === harness),
    null,
  );
  return companionOf(harnesses, value, harness, null, info?.models[0]?.id ?? "default");
};

/** A removed choice remains visible, so the picker still names the runner in use. */
export const keptOptionsOf = <Value>(options: ReadonlyArray<Value>, value: Value): ReadonlyArray<Value> =>
  options.includes(value) ? options : [...options, value];
