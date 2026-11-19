import { type AppUpdateSettings, appUpdateSettingsOf, defaultAppUpdateSettings } from "@outlore/contracts";

/** Reads the saved settings; missing, unreadable or odd text means the defaults, so checking starts on. */
export const appUpdateSettingsOfText = (saved: string | null): AppUpdateSettings => {
  if (saved === null) return defaultAppUpdateSettings;
  try {
    return appUpdateSettingsOf(JSON.parse(saved));
  } catch {
    return defaultAppUpdateSettings;
  }
};

/** The text to keep for the settings. */
export const textOfAppUpdateSettings = (settings: AppUpdateSettings): string => JSON.stringify(settings);
