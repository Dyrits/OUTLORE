import { describe, expect, it } from "@effect/vitest";
import { loreInstructions, scopeLabelOf } from "../../src/lore/lore.ts";

describe("naming lore scopes", () => {
  it("uses the glossary for the owner and explains the tool scope values to threads", () => {
    const row = { isTopThread: false, missionTitle: "Release", threadTitle: "Tests", workspaceName: "Studio" };
    expect(scopeLabelOf({ ...row, scope: "Thread" })).toBe('Side-quest "Tests"');
    expect(scopeLabelOf({ ...row, isTopThread: true, scope: "Thread" })).toBe('Quest "Release"');
    expect(scopeLabelOf({ ...row, scope: "Workspace" })).toBe("Realm Studio");
    expect(scopeLabelOf({ ...row, scope: "Global" })).toBe("Global");
    expect(loreInstructions).toContain("workspace (the realm, with or without a folder");
    expect(loreInstructions).toContain("mission (the quest");
    expect(loreInstructions).toContain("thread (the side-quest");
  });
});
