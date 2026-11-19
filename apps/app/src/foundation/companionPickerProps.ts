import type {
  AccountId,
  BackupCompanion,
  EffortChoice,
  HarnessList,
  HarnessName,
  ModelChoice,
  Tier,
  TierName,
} from "@outlore/contracts";
import type { ReactElement } from "react";

/**
 * A Companion preset: one of the Workshop's three tiers that the owner has set, a Companion and the backup Companions that go with it, which choosing it puts in place together (companion-presets).
 */
export type Preset = {
  readonly backups: Tier["backups"];
  readonly name: TierName;
  readonly runner: Omit<Tier, "backups">;
};

/** What a Companion picker needs to offer the presets: those the owner set, the backups of the stack in use (null while unread, so none is marked chosen too early), and what choosing one does. */
export type PresetChoice = {
  readonly backups: ReadonlyArray<BackupCompanion> | null;
  readonly onPreset: (preset: Preset) => void;
  readonly presets: ReadonlyArray<Preset>;
};

/** What the picker shows and can change; `RunnerPickers` owns the rules for each change. */
export type CompanionPickerProps = {
  accountId: AccountId | null;
  effort: EffortChoice;
  effortOptions: ReadonlyArray<EffortChoice>;
  /** A fold at the foot of the panel for what belongs to the thread alone: its backup Companions. Keyed by the thread. */
  extra?: ReactElement;
  harness: HarnessName;
  harnesses: HarnessList | null;
  /** Whether each harness has a tab for every account; the Workshop's default Companion has its own sign-in only. */
  isAccountShown: boolean;
  /** Whether this is Chronicler's own Companion, which the Companions tab marks with Chronicler's ✦. */
  isChronicler?: boolean;
  model: ModelChoice;
  onEffort: (effort: EffortChoice) => void;
  onModel: (harness: HarnessName, accountId: AccountId | null, model: ModelChoice) => void;
  /** Replaces the tab's own folds altogether, for a page whose Companions are several (the Workshop's). Keyed by what it shows. */
  panel?: ReactElement;
  /** The presets the owner has set, offered in their own card above the thread's Companion; none, and the tab has no such card. */
  presetChoice?: PresetChoice | null;
};
