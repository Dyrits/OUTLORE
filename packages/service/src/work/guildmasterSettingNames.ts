import { Settings } from "@outlore/contracts";

// Which settings Chronicler may change: a leaf, so the settings tools and the authorization questions share one list.

/**
 * The settings Chronicler never changes: what agents may do without asking and what they may spend. The owner sets them in
 * the Workshop, because a quest's text could otherwise talk Chronicler into widening them.
 */
export const settingsKeptFromChronicler = [
  "defaultPermissionMode",
  "defaultMissionBudget",
  "globalBudget",
  "globalBudgetPeriod",
  "shouldFetchPrices",
] as const satisfies ReadonlyArray<keyof Settings>;

/** Whether the name is one of the settings. */
const isSettingName = (key: string): key is keyof Settings => Object.hasOwn(Settings.fields, key);

/** Whether the setting is one the owner alone changes. */
export const isKeptFromChronicler = (key: string) => settingsKeptFromChronicler.some((kept) => kept === key);

/** The settings' names, which `change_setting` takes: every setting Chronicler may change. */
export const changeableSettings = Object.keys(Settings.fields)
  .filter(isSettingName)
  .filter((key) => !isKeptFromChronicler(key));

/** Whether the name is a setting Chronicler may change. */
export const isChangeableSetting = (key: string): key is (typeof changeableSettings)[number] =>
  changeableSettings.some((changeable) => changeable === key);
