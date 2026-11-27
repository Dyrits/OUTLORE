import { describe, expect, it } from "vitest";
import {
  hasMark,
  isMarkCharacter,
  markCharacters,
  markedWordOf,
  markNameOf,
  messageMarks,
  pathTokensOf,
  referenceTokensOf,
  skillTokensOf,
  typedMarkPattern,
  withoutReachMarks,
} from "../src/index.ts";

const marks = Object.entries(messageMarks);

describe("the table of message marks", () => {
  it("gives every mark one character that no other mark shares", () => {
    const characters = marks.map(([, mark]) => mark.character);
    expect(new Set(characters).size).toBe(marks.length);
    for (const character of characters) expect(character).toHaveLength(1);
    expect(markCharacters).toEqual(characters);
  });

  it("reserves @ for a Companion, with no chips and no words read yet", () => {
    expect(messageMarks.companion).toMatchObject({ character: "@", chipKinds: [], deliveryHeading: null });
    expect(markNameOf("@")).toBe("companion");
  });

  it("names the mark of a character, and none for a character that is no mark", () => {
    expect(markNameOf("#")).toBe("mention");
    expect(markNameOf("+")).toBe("path");
    expect(markNameOf("$")).toBe("skill");
    expect(markNameOf("/")).toBeNull();
    expect(isMarkCharacter("/")).toBe(false);
    expect(isMarkCharacter("$")).toBe(true);
  });

  it("opens a trigger at the end of a text for every mark's character, and for no other", () => {
    for (const [, mark] of marks) {
      expect(typedMarkPattern.exec(`write ${mark.character}wor`)?.slice(2)).toEqual([mark.character, "wor"]);
      expect(typedMarkPattern.exec(`${mark.character}`)?.slice(2)).toEqual([mark.character, ""]);
    }
    expect(typedMarkPattern.exec("a/path")).toBeNull();
    expect(typedMarkPattern.exec("mid#word")).toBeNull();
  });

  it("writes a word with its mark's character", () => {
    expect(markedWordOf("skill", "architect")).toBe("$architect");
    expect(markedWordOf("path", "src/")).toBe("+src/");
    expect(markedWordOf("mention", "realm:r1")).toBe("#realm:r1");
    expect(hasMark("pay $5", "skill")).toBe(true);
    expect(hasMark("pay 5", "skill")).toBe(false);
  });

  it("gives every mark that draws chips kinds no other mark draws", () => {
    const kinds = marks.flatMap(([, mark]) => mark.chipKinds);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it("tells the thread what each mark that has words delivers, naming the mark's own character", () => {
    for (const name of ["mention", "path", "skill"] as const) {
      expect(messageMarks[name].deliveryHeading).not.toBeNull();
    }
    expect(messageMarks.mention.deliveryHeading).toContain("with #");
    expect(messageMarks.path.deliveryHeading).toContain("with +");
  });

  it("grants reach only to the mention mark, and names the words that make its token", () => {
    expect(marks.filter(([, mark]) => mark.grantsReach).map(([name]) => name)).toEqual(["mention"]);
    for (const [, mark] of marks.filter(([, each]) => each.grantsReach))
      expect(mark.reachHeads.length).toBeGreaterThan(0);
  });
});

describe("the words each mark forms", () => {
  it("reads a mark's word only at the start of a word, from its own character", () => {
    expect(referenceTokensOf("see #quest:q-1, then #realm:r1.")).toEqual([
      { end: 14, path: "quest:q-1", start: 4 },
      { end: 30, path: "realm:r1", start: 21 },
    ]);
    expect(pathTokensOf("open +src/index.ts.")).toEqual([{ end: 18, path: "src/index.ts", start: 5 }]);
    expect(skillTokensOf("use $architect, please")).toEqual([{ end: 14, name: "architect", start: 4 }]);
    expect(referenceTokensOf("a#quest:q1 @quest:q1 +quest:q1")).toEqual([]);
    expect(skillTokensOf("a/$skill and x$skill")).toEqual([]);
  });

  it("reads no word of a mark from another mark's character", () => {
    expect(skillTokensOf("#architect +architect @architect")).toEqual([]);
    expect(pathTokensOf("$src/index.ts #src/index.ts")).toEqual([]);
  });
});

describe("the filter on words a thread wrote", () => {
  it("drops the mark of a reference token so it cannot grant reach", () => {
    expect(withoutReachMarks("try #quest:q1 and #side-quest:t1, #realm:r1 and #errand:e1")).toBe(
      "try quest:q1 and side-quest:t1, realm:r1 and errand:e1",
    );
  });

  it("leaves the marks that grant no reach, and a # that is no token, as written", () => {
    expect(withoutReachMarks("use $architect on +src/ for #12 and @someone")).toBe(
      "use $architect on +src/ for #12 and @someone",
    );
  });
});
