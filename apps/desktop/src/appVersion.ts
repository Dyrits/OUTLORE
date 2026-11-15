import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { app } from "electron";

/**
 * The version of Outlore. A development run starts Electron on `dist/main.js`, where it finds no `package.json` and
 * reports its own version (45.x), so that run reads the desktop app's file instead.
 */
export const appVersionFrom = (options: {
  readonly electronReports: string;
  readonly isPackaged: boolean;
  readonly readPackageVersion: () => unknown;
}): string => {
  if (options.isPackaged) return options.electronReports;
  try {
    const version = options.readPackageVersion();
    return typeof version === "string" ? version : options.electronReports;
  } catch {
    return options.electronReports;
  }
};

/** The version of this running Outlore: the installed app's, or the desktop package's in a development run. */
export const appVersionOf = (): string =>
  appVersionFrom({
    electronReports: app.getVersion(),
    isPackaged: app.isPackaged,
    readPackageVersion: () =>
      JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8")).version,
  });
