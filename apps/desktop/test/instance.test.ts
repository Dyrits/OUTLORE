import { describe, expect, it } from "vitest";
import { instanceOf } from "../src/instance.ts";

const appData = "/Users/owner/Library/Application Support";

describe("instanceOf", () => {
  it("makes the installed app the one Outlore, on the default profile and data folder", () => {
    expect(instanceOf({ appData, dataDirectory: undefined, hasProfileSwitch: false, isPackaged: true })).toEqual({
      name: "Outlore",
      profileFolder: null,
    });
  });

  it("gives a development run its own Outlore Dev folder, apart from the installed app's", () => {
    expect(instanceOf({ appData, dataDirectory: undefined, hasProfileSwitch: false, isPackaged: false })).toEqual({
      name: "Outlore Dev",
      profileFolder: `${appData}/Outlore Dev`,
    });
  });

  it("keeps the profile of a throwaway instance inside its data folder, packaged or not", () => {
    for (const isPackaged of [false, true]) {
      expect(instanceOf({ appData, dataDirectory: "/tmp/check", hasProfileSwitch: false, isPackaged })).toEqual({
        name: "Outlore Dev",
        profileFolder: "/tmp/check/profile",
      });
    }
  });

  it("treats an empty data folder as none", () => {
    expect(instanceOf({ appData, dataDirectory: "", hasProfileSwitch: false, isPackaged: true }).name).toBe("Outlore");
  });

  it("leaves an explicit --user-data-dir alone", () => {
    expect(instanceOf({ appData, dataDirectory: "/tmp/check", hasProfileSwitch: true, isPackaged: false })).toEqual({
      name: "Outlore Dev",
      profileFolder: null,
    });
  });
});
