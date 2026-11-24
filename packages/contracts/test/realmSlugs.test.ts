import { describe, expect, it } from "vitest";
import { mentionReferencesOf, mentionTokenOf, realmSlugOf, realmTokensOf } from "../src/index.ts";

describe("a realm's name written like a Slack channel", () => {
  it("lowercases, joins words with single hyphens, and drops accents and edge hyphens", () => {
    expect(realmSlugOf("My Project")).toBe("my-project");
    expect(realmSlugOf("  OUTLORE  ")).toBe("outlore");
    expect(realmSlugOf("Café_du  Monde!!")).toBe("cafe-du-monde");
    expect(realmSlugOf("--already-kebab--")).toBe("already-kebab");
  });

  it("is empty when nothing is a letter or a digit, and stays within 80 characters", () => {
    expect(realmSlugOf("  --- !! ")).toBe("");
    expect(realmSlugOf(`${"a".repeat(79)} b`)).toBe("a".repeat(79));
    expect(realmSlugOf("x".repeat(120))).toHaveLength(80);
  });

  it("changes nothing when applied twice", () => {
    for (const name of ["My Project", "Café_du  Monde!!", "a-b--c", "X".repeat(90)])
      expect(realmSlugOf(realmSlugOf(name))).toBe(realmSlugOf(name));
  });
});

describe("naming a realm with # in a message", () => {
  it("writes a realm with # and a quest or errand with @", () => {
    expect(mentionTokenOf({ id: "r1", kind: "realm" })).toBe("#realm:r1");
    expect(mentionTokenOf({ id: "q1", kind: "quest" })).toBe("@quest:q1");
    expect(mentionTokenOf({ id: "t1", kind: "side-quest" })).toBe("@side-quest:t1");
  });

  it("finds #realm words that start a word, with their position, and nothing else with a #", () => {
    const text = "Use #realm:4d-e, not issue #12 or a#realm:x or # realm:y.";
    expect(realmTokensOf(text)).toEqual([{ end: 15, path: "realm:4d-e", start: 4 }]);
  });

  it("reads # and the older @realm: references in order, each once", () => {
    expect(mentionReferencesOf("#realm:a then @quest:b, @realm:a again, #realm:c.")).toEqual([
      { id: "a", kind: "realm" },
      { id: "b", kind: "quest" },
      { id: "c", kind: "realm" },
    ]);
  });
});
