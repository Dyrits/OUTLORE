import { describe, expect, it } from "vitest";
import { menuPlaces, phonePlaces, resumablePlaces, screenNames } from "../../src/shell/placeCatalog";

describe("the menu of places (CHG-0449)", () => {
  it("opens Rituals, Lore, Archive, Reserves, and Settings, in that order", () => {
    expect(menuPlaces.map((entry) => entry.label)).toEqual(["Rituals", "Lore", "Archive", "Reserves", "Settings"]);
    expect(menuPlaces.map((entry) => entry.place)).toEqual(["Rituals", "Lore", "Archived", "Reserves", "Settings"]);
  });
  it("is the phone's menu too, which also leads with Realms because a phone has no sidebar of quests", () => {
    expect(phonePlaces.map((entry) => entry.place)).toEqual(["Realms", ...menuPlaces.map((entry) => entry.place)]);
  });
  it("names every place Chronicler may be told about, and resumes only those that need no selection", () => {
    for (const place of resumablePlaces) expect(screenNames[place]).toBeDefined();
    expect(resumablePlaces).not.toContain("RealmQuests");
  });
});
