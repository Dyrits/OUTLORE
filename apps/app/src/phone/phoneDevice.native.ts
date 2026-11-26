import { Linking } from "react-native";
import { type ExpoPhoneModules, expoPhoneDevice } from "./expoPhoneDevice";
import type { PhoneDevice } from "./phoneDeviceTypes";

// Each module is loaded when a tool first needs it, not when the app starts: a phone that never lets a thread use it
// never loads them, and a build without one of them fails only that tool, with one sentence.
const modules: ExpoPhoneModules = {
  battery: () => import("expo-battery"),
  clipboard: () => import("expo-clipboard"),
  device: () => import("expo-device"),
  linking: Linking,
  location: () => import("expo-location"),
  network: () => import("expo-network"),
  notifications: () => import("expo-notifications"),
  timeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
};

/** The device of the phone app: Expo's modules for the Android phone it runs on. */
export const phoneDevice = (): PhoneDevice => expoPhoneDevice(modules);
