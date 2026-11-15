import { describe, expect, it } from "vitest";
import { appVersionFrom } from "../src/appVersion.ts";

// A development run starts Electron on `dist/main.js`, where Electron finds no package.json and reports its own version
// (45.x). That number must never be told to a browser as Outlore's release (browser access, CHG-0286).

describe("the version of Outlore", () => {
  it("is the installed app's own version when packaged", () => {
    expect(
      appVersionFrom({ electronReports: "0.1.4-Prototype", isPackaged: true, readPackageVersion: () => "9.9.9" }),
    ).toBe("0.1.4-Prototype");
  });

  it("is the desktop package's version in a development run, not Electron's", () => {
    expect(
      appVersionFrom({ electronReports: "45.3.1", isPackaged: false, readPackageVersion: () => "0.1.3-Prototype" }),
    ).toBe("0.1.3-Prototype");
  });

  it("falls back to what Electron reports when the package file cannot be read or has no version", () => {
    const electronReports = "45.3.1";
    expect(
      appVersionFrom({
        electronReports,
        isPackaged: false,
        readPackageVersion: () => {
          throw new Error("no such file");
        },
      }),
    ).toBe(electronReports);
    expect(appVersionFrom({ electronReports, isPackaged: false, readPackageVersion: () => undefined })).toBe(
      electronReports,
    );
  });
});
