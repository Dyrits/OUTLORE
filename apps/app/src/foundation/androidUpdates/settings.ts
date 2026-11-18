import type { UpdateSettings } from "./controller";

/** The phone's choice about updates: looking is on until the owner turns it off. */
export const defaultUpdateSettings: UpdateSettings = { isEnabled: true, lastCheckedAt: null };

/** Reads the saved settings; missing, unreadable or odd text means the defaults, so checking starts on. */
export const updateSettingsOf = (saved: string | null): UpdateSettings => {
  if (saved === null) return defaultUpdateSettings;
  try {
    const value: unknown = JSON.parse(saved);
    if (typeof value !== "object" || value === null) return defaultUpdateSettings;
    const isEnabled = "isEnabled" in value ? value.isEnabled : null;
    const lastCheckedAt = "lastCheckedAt" in value ? value.lastCheckedAt : null;
    return {
      isEnabled: typeof isEnabled === "boolean" ? isEnabled : defaultUpdateSettings.isEnabled,
      lastCheckedAt: typeof lastCheckedAt === "number" ? lastCheckedAt : null,
    };
  } catch {
    return defaultUpdateSettings;
  }
};

/** The text to keep for the settings. */
export const textOfUpdateSettings = (settings: UpdateSettings): string => JSON.stringify(settings);
