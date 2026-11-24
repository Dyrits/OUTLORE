import type { MissionId } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import { viewingOf } from "../../src/shell/viewing";

describe("where Chronicler is told the owner is", () => {
  it("names the quest that is open, whatever the place", () => {
    const id = "q1" as MissionId;
    expect(viewingOf("Home", id)).toEqual({ missionId: id, screen: "Quest" });
    expect(viewingOf("Settings", id)).toEqual({ missionId: id, screen: "Quest" });
  });

  it("names the screen otherwise, as the owner knows it", () => {
    expect(viewingOf("Home", null)).toEqual({ screen: "Home" });
    expect(viewingOf("Settings", null)).toEqual({ screen: "Settings" });
    expect(viewingOf("Archived", null)).toEqual({ screen: "Archive" });
  });
});
