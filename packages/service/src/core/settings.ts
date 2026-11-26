import {
  type BudgetLimits,
  SavedTier,
  Settings,
  type SettingsChange,
  StartChoices,
  startingModel,
} from "@outlore/contracts";
import { Effect, Exit, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, ServiceFailure } from "./errors.ts";
import { fieldOf } from "./records.ts";
import { mayWriteSetting, type SettingWriter, settingAuthority } from "./settingAuthority.ts";

// Stored and wire names keep `intel` so existing data and agents still work: settings keys (`intelHalfLives`, `intelWarningPercent`).

/** A minute in milliseconds. */
export const minuteMillis = 60 * 1000;

/** An hour in milliseconds. */
export const hourMillis = 60 * 60 * 1000;

/** A day in milliseconds, the unit of the Settings durations. */
export const dayMillis = 24 * hourMillis;

/** A budget with neither limit. */
export const noLimits: BudgetLimits = { cost: null, tokens: null };

/** The settings before the owner changes any. */
export const defaultSettings: Settings = {
  autoArchiveDays: 30,
  backgroundCheckIns: null,
  backups: [],
  briefingLimit: 2000,
  chatterThreshold: 20,
  companionPresets: { custom: [], tierNames: {} },
  defaultEffort: "default",
  defaultHarness: "claude",
  defaultMissionBudget: noLimits,
  defaultModel: startingModel,
  defaultPermissionMode: "Auto",
  endedQuestMatchDays: 14,
  globalBudget: noLimits,
  globalBudgetPeriod: "Month",
  intelHalfLives: { decision: 45, fact: 45, preference: 90, temporary: 3 },
  intelWarningPercent: 10,
  shouldAllowRemoteTerminals: false,
  shouldAutoArchive: false,
  shouldFetchPrices: true,
  shouldOpenOffTopicMissions: false,
  shouldShowAgentThreads: true,
  shouldShowFinishedQuests: false,
  shouldStreamReplies: true,
  shouldUseCodeMode: false,
  tiers: { Balanced: null, Heavy: null, Light: null },
};

/** The settings as stored, whose presets saved before presets had backups read with none. */
const SavedSettings = Settings.mapFields((fields) => ({
  ...fields,
  tiers: Schema.Struct({
    Balanced: Schema.NullOr(SavedTier),
    Heavy: Schema.NullOr(SavedTier),
    Light: Schema.NullOr(SavedTier),
  }),
}));
const decodeExit = Schema.decodeUnknownExit(SavedSettings);

/** The saved settings with a change merged in; of the tiers only those the change names are replaced, so a tier changed elsewhere meanwhile is kept. */
export const mergedSettings = (saved: Settings, change: SettingsChange): Settings => ({
  ...saved,
  ...change,
  tiers: { ...saved.tiers, ...change.tiers },
});

/** The mode a setting that no longer decodes falls back to: the strictest one, so a lost choice never asks less. */
const strictestMode: Settings["defaultPermissionMode"] = "Supervised";

/** The saved JSON as an object, or null when it is not one. */
const savedObjectOf = (text: string): Record<string, unknown> | null => {
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? { ...parsed } : null;
  } catch {
    return null;
  }
};

/**
 * The settings decoded field by field: a field that no longer decodes takes its default, except the default
 * permission mode, which takes the strictest mode (SP-A-07), and a row that is not an object counts as every field invalid.
 */
const settingsOf = (saved: Record<string, unknown> | null): Settings => {
  const defaults: Record<string, unknown> = defaultSettings;
  const merged = { ...defaults, ...saved };
  const whole = decodeExit(merged);
  if (saved !== null && Exit.isSuccess(whole)) return whole.value;
  const kept = Object.fromEntries(
    Object.entries(SavedSettings.fields).map(([key, field]) => {
      const isValid = saved !== null && Exit.isSuccess(Schema.decodeUnknownExit(field)(merged[key]));
      if (isValid) return [key, merged[key]];
      return [key, key === "defaultPermissionMode" ? strictestMode : defaults[key]];
    }),
  );
  const decoded = decodeExit(kept);
  return Exit.isSuccess(decoded) ? decoded.value : { ...defaultSettings, defaultPermissionMode: strictestMode };
};

/**
 * Reads the owner's settings, or the defaults when none are stored. A setting added after the owner last saved takes
 * its default and the saved choices stay; one that no longer decodes takes its default alone, never dragging the others
 * back, and an invalid default permission mode takes the strictest mode.
 */
export const readSettings = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{ value: string }>`SELECT value FROM settings WHERE key = 'settings'`;
  if (row === undefined) return defaultSettings;
  return settingsOf(savedObjectOf(row.value));
});

/** Stores one row of the settings table, replacing any value the key held. */
const putSetting = (sql: SqlClient.SqlClient, key: string, value: string) =>
  sql`INSERT INTO settings (key, value) VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = excluded.value`;

/** A value as JSON with its keys in order, so two settings that differ only in key order compare equal. */
const canonicalOf = (value: unknown): string =>
  JSON.stringify(value, (_key, inner: unknown) =>
    typeof inner === "object" && inner !== null && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner).sort(([left], [right]) => left.localeCompare(right)))
      : inner,
  );

/** Whether a name is one of the settings' fields. */
const isSettingKey = (key: string): key is keyof Settings => Object.hasOwn(Settings.fields, key);

/** The fields of the saved settings that the writer changes but may not (settingAuthority.ts). */
const refusedFieldsOf = (writer: SettingWriter, saved: Settings, next: Readonly<Record<string, unknown>>) =>
  Object.keys(Settings.fields)
    .filter(isSettingKey)
    .filter(
      (key) =>
        Object.hasOwn(saved, key) &&
        !mayWriteSetting(writer, key) &&
        canonicalOf(saved[key]) !== canonicalOf(next[key]),
    );

/**
 * Stores the owner's settings, refusing any that do not decode and any change to a setting the writer may not change
 * (settingAuthority.ts), whichever door the write came in by. A field the writer omits keeps its saved value, so an
 * older client's save does not erase a setting it does not know.
 */
export const writeSettings = Effect.fnUntraced(function* (writer: SettingWriter, settings: Settings) {
  const saved = yield* readSettings;
  const omitted = Object.fromEntries(
    Object.keys(Settings.fields)
      .filter((key) => fieldOf(settings, key) === void 0)
      .map((key) => [key, fieldOf(saved, key)]),
  );
  const complete = {
    ...settings,
    ...omitted,
    backgroundCheckIns:
      settings.backgroundCheckIns === undefined ? (saved.backgroundCheckIns ?? null) : settings.backgroundCheckIns,
    companionPresets: settings.companionPresets ?? saved.companionPresets ?? { custom: [], tierNames: {} },
  };
  const refused = refusedFieldsOf(writer, saved, complete);
  if (refused.length > 0)
    return yield* new ServiceFailure({
      kind: "AccessRefused",
      message: refused.some((name) => settingAuthority[name] === "HostOwner")
        ? "Only the host itself can change whether terminals from paired devices are allowed."
        : `Not allowed from here: ${refused.join(", ")}.`,
    });
  const parsed = yield* Schema.decodeUnknownEffect(Settings)(complete).pipe(
    Effect.catch(() =>
      invalid(
        "Invalid settings: the chatter threshold must be a whole number of at least 2; the briefing limit, the auto-archive days, and the lore half-lives at least 1; budget limits above 0, tokens in whole numbers.",
      ),
    ),
  );
  const sql = yield* SqlClient.SqlClient;
  yield* putSetting(sql, "settings", JSON.stringify(parsed));
  return parsed;
});

const decodeChoices = Schema.decodeUnknownExit(StartChoices);

/** Saved choices as JSON, with the harness fields older saves lack: Claude Code on the computer's own sign-in. */
const choicesOf = (text: string) => {
  try {
    return decodeChoices({ accountId: null, harness: "claude", ...JSON.parse(text) });
  } catch {
    return null;
  }
};

/**
 * A new mission's choices: always the Workshop's default Companion (harness, model, and effort, on the computer's own
 * sign-in), with the folder of the last mission started, or none before any (mission-tracking).
 */
export const readStartChoices = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{ value: string }>`SELECT value FROM settings WHERE key = 'start_choices'`;
  // A value no longer valid leaves no folder.
  const decoded = row === undefined ? null : choicesOf(row.value);
  const workspacePath = decoded !== null && Exit.isSuccess(decoded) ? decoded.value.workspacePath : null;
  const settings = yield* readSettings;
  return {
    accountId: null,
    effort: settings.defaultEffort,
    harness: settings.defaultHarness,
    model: settings.defaultModel,
    workspacePath,
  } satisfies StartChoices;
});

/** Remembers a started mission's choices; the next mission takes its folder. Callers run it in a transaction. */
export const saveStartChoices = Effect.fnUntraced(function* (choices: StartChoices) {
  const sql = yield* SqlClient.SqlClient;
  yield* putSetting(sql, "start_choices", JSON.stringify(choices));
});
