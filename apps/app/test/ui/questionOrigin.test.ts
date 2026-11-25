import { describe, expect, it } from "vitest";
import history from "../../src/editors/permissions.tsx?raw";
import { questionOriginOf } from "../../src/ui/questionOrigin";
import cards from "../../src/ui/questions.tsx?raw";

describe("a question outside its thread", () => {
  it("names both its quest and its source errand", () => {
    expect(questionOriginOf({ missionTitle: "Release", threadTitle: "Check Linux" })).toEqual([
      { key: "quest", title: "Release" },
      { key: "thread", title: "Check Linux" },
    ]);
  });
});

describe("question origin rendering", () => {
  it("gives each title its own text line in both cards and permission history", () => {
    // Both cards draw the origin through one component, which gives each title its own line.
    expect(cards.match(/questionOriginOf\(question\)\.map/g)).toHaveLength(1);
    expect(cards.match(/<OriginLink /g)).toHaveLength(2);
    expect(history.match(/questionOriginOf\(question\)\.map/g)).toHaveLength(1);
    const long = "Long quest title ".repeat(30);
    expect(questionOriginOf({ missionTitle: long, threadTitle: "Check Linux" })).toEqual([
      { key: "quest", title: long },
      { key: "thread", title: "Check Linux" },
    ]);
  });
});
