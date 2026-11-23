import type { Settings, Tier, WorkspaceChoice, WorkspaceId } from "@outlore/contracts";
import { isSameStack, presetChangeOf, presetsOf } from "../editors/presets";
import type { Runner } from "../editors/runners";
import { realmLabelOf } from "../realms/realmLabels";

/** One Companion the proposal card offers: the owner's default, or a tier the owner set in the Workshop. */
export type CompanionChoice = {
  readonly label: string;
  readonly runner: Tier;
};

/**
 * The Companions Chronicler's proposal card offers, in order: the default, then each tier set in the Workshop, labelled by
 * the name the tier's model has (quest coordination, CHG-0179). A tier left unset is not offered.
 */
export const companionChoicesOf = (
  settings: Pick<
    Settings,
    "backups" | "defaultEffort" | "defaultHarness" | "defaultModel" | "tiers" | "companionPresets"
  >,
  labelOf: (runner: Runner) => string,
): ReadonlyArray<CompanionChoice> => [
  {
    label: "Default",
    runner: {
      accountId: null,
      backups: settings.backups,
      effort: settings.defaultEffort,
      harness: settings.defaultHarness,
      model: settings.defaultModel,
    },
  },
  ...presetsOf(settings.tiers, settings.companionPresets).map((preset) => ({
    label: `${preset.name} · ${labelOf(preset.runner)}`,
    runner: presetChangeOf(preset),
  })),
];

/** The first choice whose complete stack matches, or none for a customized one. */
export const selectedChoiceOf = (choices: ReadonlyArray<CompanionChoice>, runner: Tier) =>
  choices.find((choice) => isSameStack(choice.runner, runner)) ?? null;

/** Whether the owner has set any tier (the default always comes first); with none, the card offers no Companion row. */
export const hasTiers = (choices: ReadonlyArray<CompanionChoice>) => choices.length > 1;

/** One realm the proposal card offers: the folder a new quest is placed by, and its label. */
export type RealmOption = {
  readonly id: WorkspaceId;
  readonly label: string;
  readonly path: string | null;
};

/**
 * The realms the proposal card offers, every active realm, labelled by the shared rule that adds the parent folder
 * when two active realms share a name (mission-tracking, Realm names).
 */
export const realmOptionsOf = (realms: ReadonlyArray<WorkspaceChoice>): ReadonlyArray<RealmOption> =>
  realms
    .map((realm) => ({ id: realm.id, label: realmLabelOf(realm, realms), path: realm.path }))
    // Realms sharing a name are told apart, and ordered, by their labels.
    .sort((current, next) => current.label.localeCompare(next.label));
