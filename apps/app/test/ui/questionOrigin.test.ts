import { describe, expect, it } from "vitest";
import { questionOriginOf } from "../../src/ui/questionOrigin";

describe("a question outside its thread", () => {
  it("names both its quest and its source side-quest", () => {
    expect(questionOriginOf({ missionTitle: "Release", threadTitle: "Check Linux" })).toBe("Release · Check Linux");
  });
});
