import { describe, expect, it } from "vitest";
import { settingsSectionOf, settingsSections } from "../../src/settings/settingsSections";

describe("the Settings sections", () => {
  it("holds the Connectors section, where the Charter's Code Mode switch went", () => {
    expect(settingsSections.map((section) => section.id)).toContain("connectors");
  });
});

describe("resuming the Workshop after an appearance change", () => {
  it("keeps Look and feel open when a theme or look reload returns to Settings", () => {
    expect(settingsSectionOf("Settings")).toBe("defaults");
  });

  it("keeps Permissions as the initial section on an ordinary start", () => {
    expect(settingsSectionOf(null)).toBe("permissions");
    expect(settingsSectionOf("Realms")).toBe("permissions");
    expect(settingsSectionOf("unknown")).toBe("permissions");
  });
});
