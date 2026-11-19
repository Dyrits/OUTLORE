import { describe, expect, it } from "vitest";
import { appUpdateSettingsOf, defaultAppUpdateSettings } from "../src/index.ts";

describe("reading saved update settings", () => {
  it("keeps what was saved", () => {
    expect(appUpdateSettingsOf({ isEnabled: false, lastCheckedAt: 1234 })).toEqual({
      isEnabled: false,
      lastCheckedAt: 1234,
    });
  });

  it("falls back to the defaults for anything that is not an object", () => {
    for (const saved of [null, undefined, "text", 7, ["isEnabled"]]) {
      expect(appUpdateSettingsOf(saved)).toEqual(defaultAppUpdateSettings);
    }
  });

  it("falls back field by field, so checking stays on when the switch was never saved", () => {
    expect(appUpdateSettingsOf({ lastCheckedAt: 99 })).toEqual({ isEnabled: true, lastCheckedAt: 99 });
    expect(appUpdateSettingsOf({ isEnabled: "no", lastCheckedAt: "yesterday" })).toEqual(defaultAppUpdateSettings);
  });
});
