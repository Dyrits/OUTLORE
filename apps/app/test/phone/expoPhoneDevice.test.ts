import { describe, expect, it } from "vitest";
import { type ExpoPhoneModules, expoPhoneDevice } from "../../src/phone/expoPhoneDevice";

/** Stand-ins for the Expo modules, recording what they were asked. */
const fakeModules = (overrides: Partial<ExpoPhoneModules> = {}) => {
  const log: Array<string> = [];
  let clipboard = "";
  let isNotificationAllowed = true;
  let isLocationAllowed = true;
  const modules: ExpoPhoneModules = {
    battery: async () => ({
      BatteryState: { CHARGING: 2, FULL: 3 },
      getBatteryLevelAsync: async () => 0.8,
      getBatteryStateAsync: async () => 2,
    }),
    clipboard: async () => ({
      getStringAsync: async () => clipboard,
      setStringAsync: async (text) => {
        clipboard = text;
        return true;
      },
    }),
    device: async () => ({ manufacturer: "Google", modelName: "Pixel 8" }),
    linking: {
      openURL: async (url) => void log.push(`url:${url}`),
      sendIntent: async (action) => void log.push(`intent:${action}`),
    },
    location: async () => ({
      Accuracy: { Balanced: 3 },
      getCurrentPositionAsync: async () => ({ coords: { accuracy: 12.4, latitude: 52.37, longitude: 4.89 } }),
      requestForegroundPermissionsAsync: async () => ({ granted: isLocationAllowed }),
    }),
    network: async () => ({ getNetworkStateAsync: async () => ({ type: "WIFI" }) }),
    notifications: async () => ({
      AndroidImportance: { DEFAULT: 5 },
      getPermissionsAsync: async () => ({ granted: isNotificationAllowed }),
      requestPermissionsAsync: async () => {
        log.push("asked");
        return { granted: isNotificationAllowed };
      },
      scheduleNotificationAsync: async (request) => {
        log.push(`notify:${request.content.title}:${request.content.body}:${request.trigger.channelId}`);
        return "id";
      },
      setNotificationChannelAsync: async (id) => void log.push(`channel:${id}`),
      setNotificationHandler: () => void log.push("handler"),
    }),
    timeZone: () => "Europe/Amsterdam",
    ...overrides,
  };
  return {
    denyLocation: () => {
      isLocationAllowed = false;
    },
    denyNotifications: () => {
      isNotificationAllowed = false;
    },
    log,
    modules,
  };
};

describe("Expo phone device information", () => {
  it("reports battery, charging, network, model and time zone", async () => {
    const device = expoPhoneDevice(fakeModules().modules);
    expect(await device.info()).toEqual({
      _tag: "Done",
      value: {
        batteryPercent: 80,
        isCharging: true,
        model: "Google Pixel 8",
        network: "wifi",
        timeZone: "Europe/Amsterdam",
      },
    });
  });

  it("reports an unknown battery level as null and a full battery on power as charging", async () => {
    const device = expoPhoneDevice(
      fakeModules({
        battery: async () => ({
          BatteryState: { CHARGING: 2, FULL: 3 },
          getBatteryLevelAsync: async () => -1,
          getBatteryStateAsync: async () => 3,
        }),
      }).modules,
    );
    expect(await device.info()).toMatchObject({ value: { batteryPercent: null, isCharging: true } });
  });

  it("names a phone whose model is unknown as unknown", async () => {
    const device = expoPhoneDevice(
      fakeModules({ device: async () => ({ manufacturer: null, modelName: null }) }).modules,
    );
    expect(await device.info()).toMatchObject({ value: { model: "unknown" } });
  });
});

describe("Expo phone device location", () => {
  it("returns the position and its accuracy in meters", async () => {
    const device = expoPhoneDevice(fakeModules().modules);
    expect(await device.location()).toEqual({
      _tag: "Done",
      value: { accuracyMeters: 12, latitude: 52.37, longitude: 4.89 },
    });
  });

  it("refuses with one sentence when Android's permission is refused", async () => {
    const fake = fakeModules();
    fake.denyLocation();
    expect(await expoPhoneDevice(fake.modules).location()).toEqual({
      _tag: "Refused",
      reason:
        "Android has not allowed Outlore to read the phone's location. The owner can allow it in the phone's settings.",
    });
  });
});

describe("Expo phone device clipboard", () => {
  it("writes the text and reads it back", async () => {
    const device = expoPhoneDevice(fakeModules().modules);
    await device.writeClipboard("Gate code 4412");
    expect(await device.readClipboard()).toEqual({ _tag: "Done", value: "Gate code 4412" });
  });
});

describe("Expo phone device opening", () => {
  it.each(["https://outlore.app/a?b=1", "http://example.org", "mailto:a@b.c", "tel:+31612345678", "geo:52.3,4.9"])(
    "opens the link %s",
    async (url) => {
      const fake = fakeModules();
      expect(await expoPhoneDevice(fake.modules).open({ _tag: "Link", url })).toMatchObject({ _tag: "Done" });
      expect(fake.log).toEqual([`url:${url}`]);
    },
  );

  it.each(["intent://x#Intent;end", "javascript:alert(1)", "file:///etc/hosts", "content://contacts", "outlore.app"])(
    "refuses the link %s and opens nothing",
    async (url) => {
      const fake = fakeModules();
      expect(await expoPhoneDevice(fake.modules).open({ _tag: "Link", url })).toMatchObject({ _tag: "Refused" });
      expect(fake.log).toEqual([]);
    },
  );

  it("opens a known app by name, whatever its case", async () => {
    const fake = fakeModules();
    expect(await expoPhoneDevice(fake.modules).open({ _tag: "App", name: " Maps " })).toMatchObject({ _tag: "Done" });
    expect(fake.log).toEqual(["url:geo:0,0"]);
  });

  it("opens the phone's settings through its intent", async () => {
    const fake = fakeModules();
    await expoPhoneDevice(fake.modules).open({ _tag: "App", name: "settings" });
    expect(fake.log).toEqual(["intent:android.settings.SETTINGS"]);
  });

  it("refuses an app it does not know, listing the names it does", async () => {
    const fake = fakeModules();
    const outcome = await expoPhoneDevice(fake.modules).open({ _tag: "App", name: "Tetris" });
    expect(outcome).toMatchObject({ _tag: "Refused", reason: expect.stringContaining("maps") });
    expect(fake.log).toEqual([]);
  });

  it("refuses with one sentence when no app on the phone takes the link", async () => {
    const device = expoPhoneDevice(
      fakeModules({
        linking: {
          openURL: async () => {
            throw new Error("Could not open URL");
          },
          sendIntent: async () => {},
        },
      }).modules,
    );
    expect(await device.open({ _tag: "App", name: "telegram" })).toEqual({
      _tag: "Refused",
      reason: "No app on the phone could open this.",
    });
  });
});

describe("Expo phone device notifications", () => {
  it("sets up a channel and shows the notification", async () => {
    const fake = fakeModules();
    expect(await expoPhoneDevice(fake.modules).notify({ text: "Build done", title: "Quest" })).toMatchObject({
      _tag: "Done",
    });
    expect(fake.log).toEqual(["handler", "channel:threads", "notify:Quest:Build done:threads"]);
  });

  it("asks Android for permission first and shows nothing when it is refused", async () => {
    const fake = fakeModules();
    fake.denyNotifications();
    expect(await expoPhoneDevice(fake.modules).notify({ text: "x", title: "y" })).toEqual({
      _tag: "Refused",
      reason:
        "Android has not allowed Outlore to show notifications. The owner can allow them in the phone's settings.",
    });
    expect(fake.log).toEqual(["handler", "channel:threads", "asked"]);
  });
});
