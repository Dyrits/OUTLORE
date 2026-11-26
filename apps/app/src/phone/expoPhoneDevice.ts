import { isOpenableLink, phoneAppNames, phoneAppOpeningOf } from "./phoneApps";
import type { PhoneDevice } from "./phoneDeviceTypes";
import { phoneDone, phoneRefused } from "./phoneDeviceTypes";

/**
 * The part of each Expo module the phone uses, written as what is read and not as the module's own types: the native
 * file hands the real modules in, a test hands stand-ins in, and a module is loaded when first used, not at startup.
 */
export type ExpoPhoneModules = {
  readonly battery: () => Promise<{
    readonly BatteryState: { readonly CHARGING: number; readonly FULL: number };
    readonly getBatteryLevelAsync: () => Promise<number>;
    readonly getBatteryStateAsync: () => Promise<number>;
  }>;
  readonly clipboard: () => Promise<{
    readonly getStringAsync: () => Promise<string>;
    readonly setStringAsync: (text: string) => Promise<boolean>;
  }>;
  readonly device: () => Promise<{ readonly manufacturer: string | null; readonly modelName: string | null }>;
  readonly linking: {
    readonly openURL: (url: string) => Promise<unknown>;
    readonly sendIntent: (action: string) => Promise<unknown>;
  };
  readonly location: () => Promise<{
    readonly Accuracy: { readonly Balanced: number };
    readonly getCurrentPositionAsync: (options: { accuracy: number }) => Promise<{
      readonly coords: { readonly accuracy: number | null; readonly latitude: number; readonly longitude: number };
    }>;
    readonly requestForegroundPermissionsAsync: () => Promise<{ readonly granted: boolean }>;
  }>;
  readonly network: () => Promise<{
    readonly getNetworkStateAsync: () => Promise<{ readonly type?: string }>;
  }>;
  readonly notifications: () => Promise<{
    readonly AndroidImportance: { readonly DEFAULT: number };
    readonly getPermissionsAsync: () => Promise<{ readonly granted: boolean }>;
    readonly requestPermissionsAsync: () => Promise<{ readonly granted: boolean }>;
    readonly scheduleNotificationAsync: (request: {
      content: { body: string; title: string };
      trigger: { channelId: string };
    }) => Promise<unknown>;
    readonly setNotificationChannelAsync: (
      id: string,
      channel: { importance: number; name: string },
    ) => Promise<unknown>;
    readonly setNotificationHandler: (handler: {
      handleNotification: () => Promise<{
        shouldPlaySound: boolean;
        shouldSetBadge: boolean;
        shouldShowBanner: boolean;
        shouldShowList: boolean;
      }>;
    }) => void;
  }>;
  readonly timeZone: () => string;
};

const networkNames: Record<string, string> = {
  BLUETOOTH: "bluetooth",
  CELLULAR: "cellular",
  ETHERNET: "ethernet",
  NONE: "none",
  OTHER: "other",
  UNKNOWN: "unknown",
  VPN: "vpn",
  WIFI: "wifi",
  WIMAX: "wimax",
};

/** The channel a thread's notifications arrive in; Android needs one before it shows a notification. */
const notificationChannel = "threads";

/**
 * The phone's device on Expo: battery, network, location, clipboard, links and notifications of the Android phone this
 * app runs on. Android's permission prompts (location, notifications) appear at first use; a refusal answers one sentence.
 */
export const expoPhoneDevice = (modules: ExpoPhoneModules): PhoneDevice => {
  let hasSetNotificationHandler = false;
  return {
    info: async () => {
      const battery = await modules.battery();
      const level = await battery.getBatteryLevelAsync();
      const state = await battery.getBatteryStateAsync();
      const network = await (await modules.network()).getNetworkStateAsync();
      const device = await modules.device();
      return phoneDone({
        // Expo answers -1 when the phone gives no level.
        batteryPercent: level < 0 ? null : Math.round(level * 100),
        // A full battery on the charger still reports as full, not as charging.
        isCharging: state === battery.BatteryState.CHARGING || state === battery.BatteryState.FULL,
        model: [device.manufacturer, device.modelName].filter((part) => part !== null).join(" ") || "unknown",
        network: networkNames[network.type ?? "UNKNOWN"] ?? "unknown",
        timeZone: modules.timeZone(),
      });
    },
    location: async () => {
      const location = await modules.location();
      const permission = await location.requestForegroundPermissionsAsync();
      if (!permission.granted)
        return phoneRefused(
          "Android has not allowed Outlore to read the phone's location. The owner can allow it in the phone's settings.",
        );
      const { coords } = await location.getCurrentPositionAsync({ accuracy: location.Accuracy.Balanced });
      return phoneDone({
        accuracyMeters: coords.accuracy === null ? null : Math.round(coords.accuracy),
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
    },
    notify: async ({ text, title }) => {
      const notifications = await modules.notifications();
      // The app is open while a call runs, and Android shows no notification of an open app unless it says to.
      if (!hasSetNotificationHandler) {
        notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldPlaySound: false,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });
        hasSetNotificationHandler = true;
      }
      // Android 13 shows its permission prompt only once a channel exists.
      await notifications.setNotificationChannelAsync(notificationChannel, {
        importance: notifications.AndroidImportance.DEFAULT,
        name: "Threads",
      });
      const granted =
        (await notifications.getPermissionsAsync()).granted || (await notifications.requestPermissionsAsync()).granted;
      if (!granted)
        return phoneRefused(
          "Android has not allowed Outlore to show notifications. The owner can allow them in the phone's settings.",
        );
      await notifications.scheduleNotificationAsync({
        content: { body: text, title },
        trigger: { channelId: notificationChannel },
      });
      return phoneDone("The notification is shown.");
    },
    open: async (target) => {
      const opening =
        target._tag === "Link"
          ? isOpenableLink(target.url)
            ? ({ _tag: "Url", url: target.url.trim() } as const)
            : null
          : phoneAppOpeningOf(target.name);
      if (opening === null)
        return phoneRefused(
          target._tag === "Link"
            ? "Only links that start with https://, http://, mailto:, tel:, sms: or geo: can be opened."
            : `The phone does not know an app called "${target.name}". Known apps: ${phoneAppNames}.`,
        );
      try {
        await (opening._tag === "Url"
          ? modules.linking.openURL(opening.url)
          : modules.linking.sendIntent(opening.action));
      } catch {
        return phoneRefused("No app on the phone could open this.");
      }
      return phoneDone("Opened.");
    },
    readClipboard: async () => phoneDone(await (await modules.clipboard()).getStringAsync()),
    writeClipboard: async (text) => {
      await (await modules.clipboard()).setStringAsync(text);
      return phoneDone("The text is on the clipboard.");
    },
  };
};
