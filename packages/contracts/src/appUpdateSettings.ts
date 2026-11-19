import { isRecord } from "./objects.ts";

/** What an app keeps about updating itself: the owner's switch and when it last looked for a release. */
export type AppUpdateSettings = { readonly isEnabled: boolean; readonly lastCheckedAt: number | null };

/** The choice before the owner makes one: looking is on until the owner turns it off. */
export const defaultAppUpdateSettings: AppUpdateSettings = { isEnabled: true, lastCheckedAt: null };

/** Reads saved settings; anything missing or odd falls back field by field, so checking starts on. */
export const appUpdateSettingsOf = (saved: unknown): AppUpdateSettings => {
  if (!isRecord(saved)) return defaultAppUpdateSettings;
  const { isEnabled, lastCheckedAt } = saved;
  return {
    isEnabled: typeof isEnabled === "boolean" ? isEnabled : defaultAppUpdateSettings.isEnabled,
    lastCheckedAt: typeof lastCheckedAt === "number" ? lastCheckedAt : null,
  };
};
