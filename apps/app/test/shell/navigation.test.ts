import { describe, expect, it } from "vitest";
import { archiveParentOf, detailsModeOf } from "../../src/shell/navigation";

const view = { hasListedRealm: false, openMission: null, place: "Realms" as const, selectedMission: null };

describe("returning after a quest archive", () => {
  it("returns to the quest's containing realm instead of the last visited screen", () => {
    expect(archiveParentOf({ workspaceId: "garden", workspaceName: "Garden" })).toEqual({
      listing: { id: "garden", name: "Garden" },
      place: "RealmQuests",
    });
    expect(archiveParentOf({ workspaceId: null, workspaceName: null })).toEqual({
      listing: null,
      place: "Realms",
    });
  });
});

describe("the side panel's mode", () => {
  it("has no details to open on the Realms overview until a quest is selected", () => {
    expect(detailsModeOf(view)).toBe("none");
  });
  it("is a toggle when a quest is open, even from the Realms overview", () => {
    expect(detailsModeOf({ ...view, openMission: "m" })).toBe("toggle");
  });
  it("is a toggle when a quest is chosen without opening it", () => {
    expect(detailsModeOf({ ...view, selectedMission: "m" })).toBe("toggle");
  });
  it("is a toggle on a listed realm's page only", () => {
    expect(detailsModeOf({ ...view, hasListedRealm: true, place: "RealmQuests" })).toBe("toggle");
    expect(detailsModeOf({ ...view, place: "RealmQuests" })).toBe("none");
  });
  it("is none elsewhere", () => {
    expect(detailsModeOf(view)).toBe("none");
  });
});
