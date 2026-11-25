import type { Settings } from "@outlore/contracts";

// Who may write each setting: one table, so a new setting cannot be added without saying (conversation-terminal, ADR 0020).

/**
 * Who writes settings, from the narrowest authority to the widest: the owner in the host's own window, the owner from
 * any app (a paired device included), Chronicler on the owner's authorization, and a Ritual's run inside its scope.
 */
export type SettingWriter = "HostOwner" | "Owner" | "Chronicler" | "Ritual";

/** The writers in order, narrowest first: a setting open to a writer is open to every writer before it. */
const writersInOrder: ReadonlyArray<SettingWriter> = ["HostOwner", "Owner", "Chronicler", "Ritual"];

/**
 * The widest writer each setting is open to. A setting added to `Settings` without an entry here fails to compile,
 * which a deny list could not: it failed open for both settings added after it was written.
 */
export const settingAuthority = {
  autoArchiveDays: "Ritual",
  // What agents may do unasked and what they may spend stay with the owner: a quest's text could talk Chronicler into widening them.
  backgroundCheckIns: "Owner",
  backups: "Ritual",
  briefingLimit: "Ritual",
  chatterThreshold: "Ritual",
  companionPresets: "Owner",
  defaultEffort: "Ritual",
  defaultHarness: "Ritual",
  defaultMissionBudget: "Owner",
  defaultModel: "Ritual",
  defaultPermissionMode: "Owner",
  endedQuestMatchDays: "Ritual",
  globalBudget: "Owner",
  globalBudgetPeriod: "Owner",
  intelHalfLives: "Ritual",
  intelWarningPercent: "Ritual",
  // Only the host's own window: a paired device must never open its own terminals (conversation-terminal).
  shouldAllowRemoteTerminals: "HostOwner",
  shouldAutoArchive: "Ritual",
  shouldFetchPrices: "Owner",
  shouldOpenOffTopicMissions: "Ritual",
  shouldShowAgentThreads: "Ritual",
  shouldShowFinishedQuests: "Ritual",
  shouldStreamReplies: "Ritual",
  shouldUseCodeMode: "Ritual",
  tiers: "Ritual",
} as const satisfies Record<keyof Settings, SettingWriter>;

/** Whether the text names a setting. */
export const isSettingName = (name: string): name is keyof Settings => Object.hasOwn(settingAuthority, name);

/** Whether the writer may change the setting. */
export const mayWriteSetting = (writer: SettingWriter, name: keyof Settings) =>
  writersInOrder.indexOf(writer) <= writersInOrder.indexOf(settingAuthority[name]);

/** The names of the settings the writer may not change, in the order of the settings. */
export const settingsKeptFrom = (writer: SettingWriter) =>
  (Object.keys(settingAuthority) as ReadonlyArray<keyof Settings>).filter((name) => !mayWriteSetting(writer, name));

/** The names of the settings the writer may change, in the order of the settings. */
export const settingsOpenTo = (writer: SettingWriter) =>
  (Object.keys(settingAuthority) as ReadonlyArray<keyof Settings>).filter((name) => mayWriteSetting(writer, name));
