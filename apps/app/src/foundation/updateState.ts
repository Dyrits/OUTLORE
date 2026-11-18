/** Where an app update stands, as the desktop shell reports it to the Updates section and the notice. */
export type UpdateStatus =
  | { readonly _tag: "Unsupported"; readonly reason: string }
  /** Nothing newer, or the reason a newer release could not be used. */
  | { readonly _tag: "Idle"; readonly note: string | null }
  | { readonly _tag: "Checking" }
  /** A newer release found but not downloaded: the phone is on mobile data, so the owner chooses to download it. */
  | {
      readonly _tag: "Available";
      readonly notes: string;
      readonly pageUrl: string;
      readonly sizeBytes: number;
      readonly version: string;
    }
  | { readonly _tag: "Downloading"; readonly percent: number; readonly version: string }
  | { readonly _tag: "Ready"; readonly notes: string; readonly pageUrl: string; readonly version: string }
  | { readonly _tag: "Failed"; readonly message: string; readonly pageUrl: string | null };

/** The installed version, the owner's switch, the last check, and the status of an update. */
export type UpdateState = {
  readonly currentVersion: string;
  readonly isEnabled: boolean;
  /** When the last check ended, in milliseconds since the epoch; null before the first. */
  readonly lastCheckedAt: number | null;
  readonly status: UpdateStatus;
};

/** What the desktop window may do about updates; the shell decides, the screens only ask. */
export interface UpdatesBridge {
  check(): Promise<UpdateState>;
  /** Quits and starts the downloaded version; refused unless an update is ready. */
  install(): Promise<void>;
  /** Calls the listener with every new state; returns what stops it. */
  listen(onState: (state: UpdateState) => void): () => void;
  openReleasePage(url: string): Promise<void>;
  readonly platform?: "desktop";
  setEnabled(isEnabled: boolean): Promise<UpdateState>;
  state(): Promise<UpdateState>;
}

/**
 * What the phone's app may do about its own updates (app-updates, The Android app). It differs from the desktop's in
 * three ways: a release found on mobile data waits for **Download anyway**, installing opens Android's confirmation
 * instead of restarting, and Android needs a one-time allowance before an app may install another.
 */
export interface AndroidUpdatesBridge extends Omit<UpdatesBridge, "platform"> {
  /** Opens Android's setting where the owner allows this app to install updates. */
  allowInstalling(): Promise<void>;
  /** Whether Android already lets this app install updates. */
  canInstall(): Promise<boolean>;
  /** Downloads the release found, as when the owner chooses it on mobile data. */
  download(): Promise<UpdateState>;
  readonly platform: "android";
}

/** The updates of whichever app the screen runs in: the desktop window's or the phone's. */
export type AppUpdatesBridge = UpdatesBridge | AndroidUpdatesBridge;
