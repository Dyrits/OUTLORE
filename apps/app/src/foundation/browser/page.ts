import { directSettingsOfPage, type PageSettings } from "@outlore/controller/browser";
import { Platform } from "react-native";
import { version } from "../../../package.json";
import { directSettingsOfPhone } from "../native/phoneDirect";

/** The release of this app, the same as the desktop app's when both are built from one tag. */
export const appRelease: string = version;

/** Whether the app runs on the phone. */
export const isMobileApp = Platform.OS !== "web";

/**
 * Whether the app has no local service and only uses a host: a plain browser (no desktop bridge) or the mobile app. It
 * keeps its own pairings and opens the encrypted link to a host itself.
 */
export const isRemoteOnly = () => isMobileApp || (typeof window !== "undefined" && window.outlore === undefined);

const directOf = (direct: PageSettings["direct"]) => (direct === void 0 ? {} : { direct });

/** What the page tells the link: its release, whether it is served from this computer (a local relay is for those), and its kind. */
export const pageSettings = (): PageSettings =>
  isMobileApp
    ? // The phone's JavaScript runtime has no WebRTC of its own: its native module makes the direct channels, and a
      // build without that module stays on the relay.
      { shouldAllowLocalRelay: false, ...directOf(directSettingsOfPhone()), kind: "phone", release: appRelease }
    : {
        shouldAllowLocalRelay: ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname),
        // A browser has WebRTC of its own.
        ...directOf(directSettingsOfPage()),
        kind: "browser",
        release: appRelease,
      };
