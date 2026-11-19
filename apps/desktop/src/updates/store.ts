import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  type AppUpdateSettings,
  appUpdateSettingsOf,
  defaultAppUpdateSettings,
} from "../../../../packages/contracts/src/appUpdateSettings.ts";

/** Reads the saved settings; a missing or unreadable file means the defaults, so checking starts on. */
export const readUpdateSettings = (file: string): AppUpdateSettings => {
  try {
    return appUpdateSettingsOf(JSON.parse(readFileSync(file, "utf8")));
  } catch {
    return defaultAppUpdateSettings;
  }
};

/** Saves the settings beside the app's data. */
export const writeUpdateSettings = (file: string, settings: AppUpdateSettings) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(settings));
};
