import { describe, expect, it } from "vitest";
import { menuPlaces, resumablePlaces, screenNames } from "../../src/shell/placeCatalog";

// A Ritual is one of its realm's things, drawn beside the quests where its realm lists them: it is no place of its own
// (CHG-0616), so the menu opens only the places that remain.

describe("the menu of places (CHG-0449)", () => {
  it("opens Lore, Archive, Reserves, and Settings, in that order, and no Rituals place", () => {
    expect(menuPlaces.map((entry) => entry.label)).toEqual(["Lore", "Archive", "Reserves", "Settings"]);
    expect(menuPlaces.map((entry) => entry.place)).toEqual(["Lore", "Archived", "Reserves", "Settings"]);
    expect(menuPlaces.map((entry) => entry.place)).not.toContain("Rituals");
  });
  it("names every place Chronicler may be told about, and resumes only those that need no selection", () => {
    for (const place of resumablePlaces) expect(screenNames[place]).toBeDefined();
    expect(resumablePlaces).not.toContain("Rituals");
  });
});
