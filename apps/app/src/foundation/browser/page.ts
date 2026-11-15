import type { PageSettings } from "@outlore/controller";
import { Platform } from "react-native";
import { version } from "../../../package.json";

/** The release of this app, the same as the desktop app's when both are built from one tag. */
export const appRelease: string = version;

/** Whether this is the mobile app (a native build) rather than a page in a browser or the desktop window. */
export const isNativeApp = Platform.OS !== "web";

/**
 * Whether the app has no local service and only uses a host: a plain browser (no desktop bridge) or the mobile app. It
 * keeps its own pairings and opens the encrypted link to a host itself.
 */
export const isBrowserPage = () => isNativeApp || (typeof window !== "undefined" && window.outlore === undefined);

/** What this device is called in the pairing dialog and the host menu. */
export const remoteDeviceNoun: "browser" | "phone" = isNativeApp ? "phone" : "browser";

/** What the page tells the link: its release, whether it is served from this computer (a local relay is for those), and its kind. */
export const pageSettings = (): PageSettings =>
  isNativeApp
    ? { allowLocalRelay: false, deviceKind: "phone", release: appRelease }
    : {
        allowLocalRelay: ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname),
        release: appRelease,
      };
