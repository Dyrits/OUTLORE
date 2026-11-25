import { defaultReleasesUrl } from "@outlore/contracts";
import { requireOptionalNativeModule } from "expo";
import { getItem, setItem } from "expo-secure-store";
import { AppState, Linking, Platform } from "react-native";
import { version } from "../../../package.json";
import type { AndroidUpdatesBridge } from "../updateState";
import { androidBridgeOf } from "./bridge";
import { type AndroidInstaller, AndroidUpdateController } from "./controller";
import { appUpdateSettingsOfText, textOfAppUpdateSettings } from "./settings";

/** What the app's native module (modules/outlore-installer) offers; absent in a build that does not carry it. */
type InstallerModule = {
  addListener(
    event: "onDownloadProgress",
    listener: (event: { fileName: string; percent: number }) => void,
  ): {
    remove(): void;
  };
  canInstallPackages(): boolean;
  discard(fileName: string): Promise<void>;
  download(url: string, fileName: string, userAgent: string, allowsMetered: boolean): Promise<string>;
  install(fileName: string): Promise<void>;
  isNetworkMetered(): boolean;
  isStoreInstall(): boolean;
  openInstallSettings(): Promise<void>;
};

const settingsKey = "outlore.updateSettings";

const installerOf = (native: InstallerModule): AndroidInstaller => ({
  allowInstalling: () => native.openInstallSettings(),
  canInstallPackages: () => native.canInstallPackages(),
  discard: (fileName) => native.discard(fileName),
  download: async ({ allowsMetered, fileName, url, userAgent }, onProgress) => {
    const subscription = native.addListener("onDownloadProgress", (event) => {
      if (event.fileName === fileName) onProgress(event.percent);
    });
    try {
      return await native.download(url, fileName, userAgent, allowsMetered);
    } finally {
      subscription.remove();
    }
  },
  install: (fileName) => native.install(fileName),
  isNetworkMetered: () => native.isNetworkMetered(),
  isStoreInstall: () => native.isStoreInstall(),
});

let current: { bridge: AndroidUpdatesBridge; controller: AndroidUpdateController } | null = null;
// Whether `current` was decided, since null is the decision for a build that cannot update.
let isResolved = false;
let hasStarted = false;

/** The one updater of this phone's app, made on first use; null off Android or in a build without the native module. */
const updater = () => {
  if (isResolved) return current;
  isResolved = true;
  const native = Platform.OS === "android" ? requireOptionalNativeModule<InstallerModule>("OutloreInstaller") : null;
  if (native === null) return current;
  const controller = new AndroidUpdateController({
    currentVersion: version,
    fetch: (url, init) => fetch(url, init),
    installer: installerOf(native),
    isDevelopment: __DEV__,
    now: () => Date.now(),
    releasesUrl: defaultReleasesUrl,
    repeat: (run, milliseconds) => {
      const timer = setInterval(() => {
        if (AppState.currentState === "active") run();
      }, milliseconds);
      return () => clearInterval(timer);
    },
    settings: {
      read: () => appUpdateSettingsOfText(getItem(settingsKey)),
      write: (settings) => setItem(settingsKey, textOfAppUpdateSettings(settings)),
    },
  });
  current = { bridge: androidBridgeOf(controller, (url) => Linking.openURL(url)), controller };
  return current;
};

/** The updates of the phone's app, or null where this app cannot update itself. */
export const androidUpdatesBridge = (): AndroidUpdatesBridge | null => updater()?.bridge ?? null;

/** Starts looking for a newer release: once at start, then every six hours, as long as the owner has not turned it off. */
export const startAndroidUpdates = (): void => {
  if (hasStarted) return;
  hasStarted = true;
  const controller = updater()?.controller;
  if (controller === undefined) return;
  controller.start();
  AppState.addEventListener("change", (state) => {
    if (state === "active") controller.checkIfDue();
  });
};
