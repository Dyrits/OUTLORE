import { markCharacters, messageMarks } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import { triggerOfEnd } from "../../src/ui/chipEditorTypes";
import { chipOfMentionable, chipsOf } from "../../src/ui/chipPlaces";
import { composerListOf, initialListState } from "../../src/ui/composerList";

describe("the message marks as the composer reads them", () => {
  it("opens a trigger for every mark's character", () => {
    for (const character of markCharacters) {
      expect(triggerOfEnd(`say ${character}wor`)).toEqual({ character, query: "wor" });
    }
    expect(triggerOfEnd("say /wor")).toBeNull();
  });

  it("draws only the chip kinds its marks declare", () => {
    const mentionKinds = (["quest", "side-quest", "realm"] as const).map(
      (kind) => chipOfMentionable({ detail: null, id: "x1", kind, trail: ["T"] }).kind,
    );
    for (const kind of mentionKinds) expect(messageMarks.mention.chipKinds).toContain(kind);
    expect(new Set(mentionKinds)).toEqual(new Set(messageMarks.mention.chipKinds));
    const placed = chipsOf("$architect +src/", {
      entries: new Map([["src/", "folder" as const]]),
      mentionables: [],
      skills: [{ description: "", name: "architect", path: "/x/SKILL.md" }],
    }).map((place) => place.kind);
    expect(placed).toEqual([...messageMarks.skill.chipKinds, "folder"]);
    expect(messageMarks.path.chipKinds).toContain("folder");
  });

  it("offers no rows after the reserved @ yet, whatever follows it", () => {
    const source = {
      entries: [],
      mentionables: [{ detail: null, id: "q1", kind: "quest" as const, trail: ["Fix login"] }],
      mentions: { hasFolder: true },
      skills: [{ description: "Design", name: "architect", path: "/x/SKILL.md" }],
    };
    for (const query of ["", "arch", "gpt"]) {
      const list = composerListOf({ ...source, trigger: { character: "@", query } }, initialListState);
      expect(list.rows).toEqual([]);
    }
  });
});
