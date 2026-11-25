import type { AccountId, EffortChoice, HarnessList, HarnessName, ModelChoice } from "@outlore/contracts";
import type { ComponentProps, ReactElement } from "react";
import { Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { effortName, harnessLabels, modelLabelOf } from "../foundation/formatting";
import { styles } from "../foundation/styles";
import { Choice, Menu, Steps } from "../ui/pickers";
import { harnessNames, harnessOfAccount } from "./accountModels";
import { CompanionBody } from "./companionBody";
import { CompanionPanel, CompanionPicker } from "./companionPicker";
import type { PresetChoice } from "./presets";
import type { Runner } from "./runner";
import { changedHarnessOf, companionOf, keptOptionsOf } from "./runnerChoices";
import { effortsOf, useModelEfforts } from "./useModelEfforts";

// The runner type and the harness list hook are defined in their own files; they are re-exported so other folders keep importing them from here.
export type { Runner } from "./runner";
export { useHarnesses } from "./useHarnesses";

/**
 * Pickers for a runner: harness, account when the harness has more than one, model, and effort. Choosing
 * another harness takes its own sign-in and default model, as the service does when they are left out.
 */
export function RunnerPickers({
  client,
  dockRank,
  extra,
  harnesses,
  isAccountShown = true,
  isCompact,
  isFullPanel = false,
  isChronicler = false,
  isPanel = false,
  isTabOpen = false,
  onChange,
  onOpenTab,
  panel,
  presetChoice,
  trigger,
  value,
}: {
  /** Asks the provider for a model's effort levels when its model list does not give them (OpenCode); without it, none are offered there. */
  client?: ServiceClient;
  /** Which Companion button the window's Companion tab shows when none was pressed: the lowest rank, else the latest. */
  dockRank?: number;
  /** The Companions tab's fold for what belongs to the thread alone; see `CompanionPickerProps`. */
  extra?: ReactElement;
  harnesses: HarnessList | null;
  /** Whether the account can be chosen; Settings' defaults have none. */
  isAccountShown?: boolean;
  /** Compact underlined words, as in a composer; named fields otherwise. */
  isCompact: boolean;
  /** Chronicler's own Companion: the Companions tab marks it with ✦. */
  isChronicler?: boolean;
  /** The picker's own content, as drawn in a fold of the Companions tab; `isCompact` is then ignored. */
  isPanel?: boolean;
  /** Shows the full Companions panel inside a conversation pane. */
  isFullPanel?: boolean;
  /** Whether the pane's Companions tab is shown, so the runner button is selected. */
  isTabOpen?: boolean;
  onOpenTab?: (() => void) | undefined;
  onChange: (runner: Runner) => void;
  /** The Companions tab's own content in place of its folds; see `CompanionPickerProps`. */
  panel?: ReactElement;
  /** The presets the Companions tab offers in a card above the Companion; see `CompanionPickerProps`. */
  presetChoice?: PresetChoice | null;
  /** Another control in place of a composer's runner button; see `CompanionPicker`. */
  trigger?: ComponentProps<typeof CompanionPicker>["trigger"];
  value: Runner;
}) {
  const harnessInfo = harnesses?.harnesses.find((candidate) => candidate.name === value.harness);
  // The harness as the chosen account sees it: its models are that account's own.
  const harness = harnessOfAccount(harnessInfo, value.accountId);
  const models = harness?.models ?? [];
  const accounts = harnessInfo?.accounts ?? [];
  const accountIds = accounts.map((account) => account.id);
  const harnessLabel = (name: HarnessName) => {
    const problem = harnesses?.harnesses.find((candidate) => candidate.name === name)?.problem ?? null;
    return problem === null ? harnessLabels[name] : `${harnessLabels[name]} (not installed)`;
  };
  const chooseHarness = (harness: HarnessName) => onChange(changedHarnessOf(harnesses, value, harness));
  const chooseCompanion = (harness: HarnessName, accountId: AccountId | null, model: ModelChoice) =>
    onChange(companionOf(harnesses, value, harness, accountId, model));
  const chooseModel = (model: ModelChoice) => chooseCompanion(value.harness, value.accountId, model);
  const effortOptions = effortsOf(useModelEfforts(client, harness, value), value.effort);
  // A model that offers no level of effort has nothing to choose.
  const isEffortChosen = effortOptions.length > 1;
  const accountLabel = (id: AccountId | null) => {
    const account = accounts.find((candidate) => candidate.id === id);
    return account === undefined
      ? "Removed account"
      : account.signIn === "SignedOut"
        ? `${account.label} (signed out)`
        : account.label;
  };
  const accountOptions = keptOptionsOf(accountIds, value.accountId);
  const isAccountChosen = isAccountShown && accountIds.length > 1;
  const modelOptions = keptOptionsOf(
    models.map((model) => model.id),
    value.model,
  );
  if (isCompact || isPanel || isFullPanel) {
    const picker = {
      accountId: value.accountId,
      effort: value.effort,
      effortOptions,
      harness: value.harness,
      harnesses,
      isAccountShown,
      model: value.model,
      onEffort: (effort: EffortChoice) => onChange({ ...value, effort }),
      onModel: chooseCompanion,
      // A preset must never fall back to a primary-only change.
      ...(presetChoice == null ? {} : { presetChoice }),
    };
    // In a fold of the Companions tab, the picker's own content; in a composer, one button for the whole runner,
    // which opens that tab with harness tabs, a model search, and effort.
    if (isPanel) return <CompanionBody {...picker} />;
    const content = {
      ...picker,
      ...(extra === undefined ? {} : { extra }),
      ...(panel === undefined ? {} : { panel }),
      ...(isChronicler ? { isChronicler } : {}),
    };
    if (isFullPanel) return <CompanionPanel {...content} />;
    return (
      <CompanionPicker
        {...(dockRank === undefined ? {} : { rank: dockRank })}
        isTabOpen={isTabOpen}
        onOpenTab={onOpenTab}
        {...(trigger === undefined ? {} : { trigger })}
        {...content}
      />
    );
  }
  // In a form, each picker is a named field; effort is an ordered scale, so it is a line of stops.
  return (
    <View style={styles.fields}>
      <View style={styles.field}>
        <Text style={styles.fieldName}>Harness</Text>
        <Choice
          accessibilityLabel="Harness"
          label={harnessLabel}
          onChange={chooseHarness}
          options={harnessNames}
          value={value.harness}
        />
      </View>
      {isAccountChosen && (
        <View style={styles.field}>
          <Text style={styles.fieldName}>Account</Text>
          <Menu
            accessibilityLabel="Account"
            isField
            label={accountLabel}
            onChange={(accountId: AccountId | null) => onChange({ ...value, accountId })}
            options={accountOptions}
            value={value.accountId}
          />
        </View>
      )}
      <View style={[styles.field, styles.raised]}>
        <Text style={styles.fieldName}>Companion (model)</Text>
        <Menu
          accessibilityLabel="Companion (model)"
          isField
          label={(id: ModelChoice) => modelLabelOf(id, models)}
          onChange={chooseModel}
          options={modelOptions}
          value={value.model}
        />
      </View>
      {isEffortChosen && (
        <View style={styles.field}>
          <Text style={styles.fieldName}>Effort</Text>
          <Steps
            accessibilityLabel="Effort"
            label={effortName}
            onChange={(effort: EffortChoice) => onChange({ ...value, effort })}
            options={effortOptions}
            value={value.effort}
          />
        </View>
      )}
    </View>
  );
}
