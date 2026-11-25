import type { AppUpdateSettings } from "@outlore/contracts";

/** How often a running app looks for a new release, as on the desktop. */
export const checkIntervalMilliseconds = 6 * 60 * 60 * 1000;

/** What the phone's own system does for the updater; the native module answers it, and tests supply their own. */
export type AndroidInstaller = {
  /** Opens Android's setting where the owner allows this app to install updates. */
  readonly allowInstalling: () => Promise<void>;
  readonly canInstallPackages: () => boolean;
  /** Deletes a downloaded file. */
  readonly discard: (fileName: string) => Promise<void>;
  /** Downloads a file into the app's private folder and returns its SHA-512 as hex, reporting how much has arrived. */
  readonly download: (
    request: {
      readonly allowsMetered: boolean;
      readonly fileName: string;
      readonly url: string;
      readonly userAgent: string;
    },
    onProgress: (percent: number) => void,
  ) => Promise<string>;
  /** Checks the file is an update of this app signed with the same key, and opens Android's install confirmation. */
  readonly install: (fileName: string) => Promise<void>;
  /** Whether the network in use is metered, as mobile data is. */
  readonly isNetworkMetered: () => boolean;
  /** Whether a store installed this app, which then updates it. */
  readonly isStoreInstall: () => boolean;
};

/** What the controller needs from the app and the clock; tests supply their own. */
export type AndroidUpdateOptions = {
  readonly currentVersion: string;
  readonly fetch: typeof fetch;
  readonly installer: AndroidInstaller;
  /** A development build never checks. */
  readonly isDevelopment: boolean;
  readonly now: () => number;
  readonly releasesUrl: string;
  /** Runs `run` every `milliseconds` until the returned function is called. */
  readonly repeat: (run: () => void, milliseconds: number) => () => void;
  readonly settings: { readonly read: () => AppUpdateSettings; readonly write: (settings: AppUpdateSettings) => void };
};
