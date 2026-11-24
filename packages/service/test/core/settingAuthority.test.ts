import { Settings } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import { mayWriteSetting, type SettingWriter, settingAuthority, settingsKeptFrom } from "../../src/core/index.ts";
import { defaultSettings } from "../../src/core/settings.ts";

// The table says who may write each setting (settingAuthority.ts); the requests that write are checked in settingsAuthority.test.ts.

const writers: ReadonlyArray<SettingWriter> = ["HostOwner", "Owner", "Chronicler", "Ritual"];
const names = Object.keys(Settings.fields).sort();

describe("the settings authority table", () => {
  it("names every setting, and nothing else", () => {
    expect(Object.keys(settingAuthority).sort()).toEqual(names);
    expect(Object.keys(defaultSettings).sort()).toEqual(names);
  });

  it("opens a setting to every narrower writer than the widest it names", () => {
    for (const name of Object.keys(settingAuthority) as ReadonlyArray<keyof typeof settingAuthority>)
      for (const [index, writer] of writers.entries())
        if (mayWriteSetting(writer, name))
          for (const narrower of writers.slice(0, index)) expect(mayWriteSetting(narrower, name)).toBe(true);
  });

  it("keeps what an agent may do unasked and what it may spend to the owner", () => {
    for (const name of [
      "backgroundCheckIns",
      "companionPresets",
      "defaultMissionBudget",
      "defaultPermissionMode",
      "globalBudget",
      "globalBudgetPeriod",
      "shouldFetchPrices",
    ] as const) {
      expect(mayWriteSetting("Owner", name)).toBe(true);
      expect(mayWriteSetting("Chronicler", name)).toBe(false);
      expect(mayWriteSetting("Ritual", name)).toBe(false);
    }
  });

  it("keeps the terminals switch to the host's own window", () => {
    expect(mayWriteSetting("HostOwner", "shouldAllowRemoteTerminals")).toBe(true);
    for (const writer of ["Owner", "Chronicler", "Ritual"] as const)
      expect(mayWriteSetting(writer, "shouldAllowRemoteTerminals")).toBe(false);
    expect(settingsKeptFrom("Chronicler")).toContain("shouldAllowRemoteTerminals");
  });
});
