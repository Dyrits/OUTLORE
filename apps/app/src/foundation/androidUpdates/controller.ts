import {
  type AppUpdateSettings,
  checksumsOf,
  chooseReleaseFor,
  type FoundRelease,
  listingsOf,
  plainNotesOf,
} from "@outlore/contracts";
import { messageOf } from "../client";
import type { UpdateState, UpdateStatus } from "../updateState";

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

const hostOf = (url: string) => /^https?:\/\/([^/]+)/.exec(url)?.[1] ?? url;

/** A request to GitHub that failed, in words for the Updates section. */
class RequestFailure extends Error {}

/**
 * Owns what the phone's app knows about its updates: whether checking is on, when it last checked, and where an update
 * stands. As on the desktop it checks at start and every six hours and never installs until asked; unlike it, a
 * release found on mobile data waits for the owner before it downloads (app-updates, The Android app).
 */
export class AndroidUpdateController {
  private readonly listeners = new Set<(state: UpdateState) => void>();
  private found: FoundRelease | null = null;
  private requestAbort: AbortController | null = null;
  /** Why a newer release could not be used, from the last check. */
  private note: string | null = null;
  private running: Promise<void> | null = null;
  private settings: AppUpdateSettings;
  private status: UpdateStatus;
  private stopRepeating: (() => void) | null = null;

  constructor(private readonly options: AndroidUpdateOptions) {
    try {
      this.settings = options.settings.read();
    } catch (reason) {
      this.settings = { isEnabled: false, lastCheckedAt: null };
      this.status = { _tag: "Unsupported", reason: `Could not read update settings: ${messageOf(reason)}` };
      return;
    }
    this.status = options.isDevelopment
      ? { _tag: "Unsupported", reason: "A development build does not update itself." }
      : options.installer.isStoreInstall()
        ? { _tag: "Unsupported", reason: "A store installed Outlore, so the store updates it." }
        : { _tag: "Idle", note: null };
  }

  /** The current state, as the screens show it. */
  state(): UpdateState {
    return {
      currentVersion: this.options.currentVersion,
      isEnabled: this.settings.isEnabled,
      lastCheckedAt: this.settings.lastCheckedAt,
      status: this.status,
    };
  }

  /** Calls the listener with every new state; returns what stops it. */
  subscribe(listener: (state: UpdateState) => void) {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  /** Starts the schedule: a check now, then every six hours. Nothing while checking is off or the build cannot update. */
  start() {
    if (this.status._tag === "Unsupported" || !this.settings.isEnabled) return;
    this.stopRepeating ??= this.options.repeat(() => void this.check(), checkIntervalMilliseconds);
    void this.check();
  }

  /** Checks on return to the foreground if the app was suspended when the next check was due. */
  checkIfDue() {
    const lastCheck = this.settings.lastCheckedAt;
    if (lastCheck === null || this.options.now() - lastCheck >= checkIntervalMilliseconds) void this.check();
  }

  /**
   * Looks for a newer release now. Does nothing, and asks no one, while checking is off or an update is under way or
   * ready. A release offered on mobile data is looked at again, so it downloads once the phone is on Wi-Fi.
   */
  check(): Promise<UpdateState> {
    const { _tag: tag } = this.status;
    const canCheck = tag === "Idle" || tag === "Failed" || tag === "Available";
    if (!this.settings.isEnabled) return Promise.resolve(this.state());
    if (this.running !== null) return this.running.then(() => this.state());
    if (!canCheck) return Promise.resolve(this.state());
    this.running ??= this.run().finally(() => {
      this.running = null;
    });
    return this.running.then(() => this.state());
  }

  /** Turns checking on or off, and keeps it for the next start. Turning it on checks at once. */
  async setEnabled(isEnabled: boolean): Promise<UpdateState> {
    const next = { ...this.settings, isEnabled };
    this.options.settings.write(next);
    this.settings = next;
    if (!isEnabled) {
      this.requestAbort?.abort();
      this.stopRepeating?.();
      this.stopRepeating = null;
      this.publish();
      return this.state();
    }
    if (this.status._tag !== "Unsupported")
      this.stopRepeating ??= this.options.repeat(() => void this.check(), checkIntervalMilliseconds);
    this.publish();
    await this.running;
    return this.check();
  }

  /** Downloads the release that waits on mobile data. Refused when nothing was offered. */
  async download(): Promise<UpdateState> {
    if (!this.settings.isEnabled || this.status._tag !== "Available" || this.found === null)
      throw new Error("There is nothing to download.");
    await this.fetchApk(this.found, true);
    return this.state();
  }

  /** Whether Android already lets this app install updates. */
  canInstall(): Promise<boolean> {
    return Promise.resolve(this.options.installer.canInstallPackages());
  }

  /** Opens Android's setting where the owner allows this app to install updates. */
  allowInstalling(): Promise<void> {
    return this.options.installer.allowInstalling();
  }

  /** Opens Android's confirmation for the downloaded update. Refused unless one is ready and Android allows it. */
  async install(): Promise<void> {
    if (this.status._tag !== "Ready" || this.found === null) throw new Error("There is no update ready to install.");
    const ready = this.status;
    if (!this.options.installer.canInstallPackages())
      throw new Error("Android has not been told to allow Outlore to install updates yet.");
    await this.options.installer.install(this.found.installer.name).catch((reason: unknown) => {
      this.status = { _tag: "Failed", message: messageOf(reason), pageUrl: ready.pageUrl };
      this.publish();
      throw reason;
    });
  }

  private async run() {
    this.status = { _tag: "Checking" };
    this.publish();
    try {
      this.found = null;
      const found = await this.find();
      if (found === null) {
        this.status = { _tag: "Idle", note: this.note };
      } else {
        this.found = found;
        if (!this.settings.isEnabled || this.options.installer.isNetworkMetered()) this.status = availableOf(found);
        else await this.fetchApk(found, false);
      }
    } catch (reason) {
      this.status = this.settings.isEnabled
        ? { _tag: "Failed", message: messageOf(reason), pageUrl: null }
        : { _tag: "Idle", note: null };
    }
    this.settings = { ...this.settings, lastCheckedAt: this.options.now() };
    try {
      this.options.settings.write(this.settings);
    } catch {
      // A failed timestamp save does not change the result, and the switch is saved independently before changing.
    }
    this.publish();
  }

  /** The newest newer release with an APK and checksums, or null with the reason in `note`. */
  private async find(): Promise<FoundRelease | null> {
    const { currentVersion, releasesUrl } = this.options;
    const listings = listingsOf(
      await this.request(releasesUrl, { Accept: "application/vnd.github+json" }, (response) => response.json()),
    );
    const choice = chooseReleaseFor(listings, currentVersion, (number) => `Outlore-${number}-android.apk`);
    this.note = choice._tag === "None" ? choice.reason : null;
    if (choice._tag === "None") return null;
    return { ...choice.release, notes: plainNotesOf(choice.release.notes) };
  }

  private async request<Result>(
    url: string,
    headers: Record<string, string>,
    read: (response: Response) => Promise<Result>,
  ) {
    const abort = new AbortController();
    this.requestAbort = abort;
    const timeout = setTimeout(() => abort.abort(), 30_000);
    try {
      const response = await this.options.fetch(url, {
        credentials: "omit",
        headers: { ...headers, "User-Agent": `Outlore/${this.options.currentVersion}` },
        signal: abort.signal,
      });
      if (!response.ok) throw new RequestFailure(`GitHub answered ${response.status} for ${hostOf(url)}.`);
      return await read(response);
    } catch (reason) {
      if (reason instanceof RequestFailure) throw reason;
      throw new RequestFailure(`Could not read ${hostOf(url)}: ${messageOf(reason)}`);
    } finally {
      clearTimeout(timeout);
      this.requestAbort = null;
    }
  }

  /** Downloads the APK and keeps it only when its hash is the one the release lists. */
  private async fetchApk(release: FoundRelease, allowsMetered: boolean) {
    const { installer } = this.options;
    const fileName = release.installer.name;
    this.status = { _tag: "Downloading", percent: 0, version: release.version };
    this.publish();
    try {
      const sums = checksumsOf(await this.request(release.sumsUrl, {}, (response) => response.text()));
      if (!this.settings.isEnabled) {
        this.status = availableOf(release);
        return;
      }
      const sha512 = sums.get(fileName);
      if (sha512 === undefined)
        throw new RequestFailure(`The checksums of release ${release.version} list no ${fileName}.`);
      const hash = await installer.download(
        { allowsMetered, fileName, url: release.installer.url, userAgent: `Outlore/${this.options.currentVersion}` },
        (percent) => {
          this.status = { _tag: "Downloading", percent, version: release.version };
          this.publish();
        },
      );
      if (hash.toLowerCase() !== sha512) {
        throw new RequestFailure(
          `The downloaded ${fileName} does not match the checksum of release ${release.version}, so it was deleted.`,
        );
      }
      this.status = { _tag: "Ready", notes: release.notes, pageUrl: release.pageUrl, version: release.version };
    } catch (reason) {
      await installer.discard(fileName).catch(() => void 0);
      const isMeteredError =
        reason instanceof Error &&
        Object.hasOwn(reason, "code") &&
        (reason as { code?: unknown }).code === "ERR_METERED";
      this.status =
        !this.settings.isEnabled || isMeteredError
          ? availableOf(release)
          : { _tag: "Failed", message: messageOf(reason), pageUrl: release.pageUrl };
    } finally {
      this.publish();
    }
  }

  private publish() {
    const state = this.state();
    for (const listener of this.listeners) listener(state);
  }
}

const availableOf = (release: FoundRelease): UpdateStatus => ({
  _tag: "Available",
  notes: release.notes,
  pageUrl: release.pageUrl,
  sizeBytes: release.installer.size,
  version: release.version,
});
