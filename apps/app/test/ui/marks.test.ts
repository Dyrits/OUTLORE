import { companionTokenOf, markCharacters, messageMarks } from "@outlore/contracts";
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

  it("draws a Companion as the chip kind its mark declares, with the model's name", () => {
    const choice = {
      accountId: null,
      accountLabel: "This computer",
      harness: "codex" as const,
      model: "gpt-5",
      modelLabel: "GPT 5",
    };
    const token = companionTokenOf(choice);
    const placed = chipsOf(`ask ${token} now`, {
      companions: [choice],
      entries: new Map(),
      mentionables: [],
      skills: [],
    });
    expect(placed.map((place) => [place.kind, place.label])).toEqual([[messageMarks.companion.chipKinds[0], "GPT 5"]]);
    expect(chipsOf(`ask ${token}`, { entries: new Map(), mentionables: [], skills: [] })[0]?.label).toBe("gpt-5");
  });

  it("offers a list after @ only where a Companion can be asked", () => {
    const source = {
      companions: [
        {
          accountId: null,
          accountLabel: "This computer",
          harness: "codex" as const,
          model: "gpt-5",
          modelLabel: "GPT 5",
        },
      ],
      entries: [],
      mentionables: [],
      mentions: { canAskCompanions: true, hasFolder: true },
      skills: [],
    };
    for (const query of ["", "gp"]) {
      const list = composerListOf({ ...source, trigger: { character: "@", query } }, initialListState);
      expect(list.rows.length).toBeGreaterThan(0);
    }
    const closed = composerListOf(
      { ...source, mentions: { canAskCompanions: false, hasFolder: true }, trigger: { character: "@", query: "gp" } },
      initialListState,
    );
    expect(closed.rows).toEqual([]);
  });
});
