import {
  type HarnessInfo,
  type HarnessName,
  type KeyProviderName,
  keyProviderNames,
  keyProviders,
} from "@outlore/contracts";

/** Whether the Workshop offers "+ Add account" on a harness: yes unless its host says it takes only the computer's own sign-in (an older host says nothing). */
export const canAddAccount = (harness: Pick<HarnessInfo, "supportsAddedAccounts">) =>
  harness.supportsAddedAccounts !== false;

/** A harness-reported version reduced to its number, retaining unknown reports and absence. */
export const versionOf = (harness: Pick<HarnessInfo, "version">) =>
  harness.version?.match(/\bv?\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?/)?.[0] ?? harness.version;

/** The providers an API key account can be added for on a harness, in the order the owner reads them. */
export const keyProvidersOf = (harness: HarnessName): ReadonlyArray<KeyProviderName> =>
  keyProviderNames.filter((name) => keyProviders[name].harness === harness);

/** Splits a comma- or newline-separated model list into trimmed non-empty model names. */
export const namedModelsOf = (models: string): ReadonlyArray<string> =>
  models
    .split(/[,\n]/u)
    .map((model) => model.trim())
    .filter((model) => model !== "");

/** Whether a key provider lists no default models, so the owner must name at least one. */
export const isModelListRequired = (provider: KeyProviderName): boolean => keyProviders[provider].models.length === 0;

/** The label sent when adding a key account: the owner's input, or the provider's name when blank. */
export const keyAccountLabelOf = (provider: KeyProviderName, label: string): string =>
  label.trim() === "" ? keyProviders[provider].label : label;

/** The placeholder shown in the models input for a key provider. */
export const modelsPlaceholderOf = (provider: KeyProviderName): string =>
  isModelListRequired(provider)
    ? "Model names, separated by commas"
    : `Model names, separated by commas (blank: ${keyProviders[provider].models.map((model) => model.id).join(", ")})`;

/** Whether the Add API key account form can be submitted. */
export const canSubmitNewKeyAccount = ({
  isBusy,
  key,
  models,
  provider,
}: {
  readonly isBusy: boolean;
  readonly key: string;
  readonly models: string;
  readonly provider: KeyProviderName;
}): boolean => !isBusy && key.length > 0 && (!isModelListRequired(provider) || namedModelsOf(models).length > 0);

/** Whether the Replace API key form can be submitted. */
export const canSubmitReplacementKey = ({ isBusy, key }: { readonly isBusy: boolean; readonly key: string }): boolean =>
  !isBusy && key.length > 0;
