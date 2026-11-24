import { describe, expect, it } from "vitest";
import { archiveParentOf, detailsModeOf } from "../../src/shell/navigation";

const view = { openMission: null, selectedMission: null };

describe("returning after a quest archive", () => {
  it("returns to the quest's realm channel instead of the last visited screen", () => {
    expect(archiveParentOf({ workspaceId: "garden", workspaceName: "Garden" })).toEqual({
      listing: { id: "garden", name: "Garden" },
      place: "Channel",
    });
    expect(archiveParentOf({ workspaceId: null, workspaceName: null })).toEqual({
      listing: null,
      place: "Home",
    });
  });
});

describe("the side panel's mode", () => {
  it("has no details to open on the home screen until a quest is selected", () => {
    expect(detailsModeOf(view)).toBe("none");
  });
  it("is a toggle when a quest is open, even from the home screen", () => {
    expect(detailsModeOf({ ...view, openMission: "m" })).toBe("toggle");
  });
  it("is a toggle when a quest is chosen without opening it", () => {
    expect(detailsModeOf({ ...view, selectedMission: "m" })).toBe("toggle");
  });
});
