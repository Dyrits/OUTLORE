import { directSettingsOfLoader, type PageSettings } from "@outlore/controller/browser";
import { NativeModules } from "react-native";

/**
 * How the phone app makes direct channels to a host: through the native WebRTC module of `react-native-webrtc`. Hermes
 * has no `RTCPeerConnection` of its own, so the class is taken from the library, which is loaded at the first try and
 * not at startup (it sets up its native event listeners when it loads). A build without the native module, such as
 * Expo Go, makes none, and every link stays on the relay.
 */
export const directSettingsOfPhone = (): PageSettings["direct"] =>
  // The library throws when its module is null, and the new architecture may give undefined for a missing one: both
  // read as absent, so a build that can never load it does not try on every retry.
  (NativeModules.WebRTCModule ?? null) === null
    ? void 0
    : directSettingsOfLoader(async () => (await import("react-native-webrtc")).RTCPeerConnection);
