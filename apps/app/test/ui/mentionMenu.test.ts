import type { Mentionable, WorkspaceEntry } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import { chipsOf } from "../../src/ui/chipPlaces";
import { type MenuRow, mentionMenuOf, menuKeyActionOf, pathMenuOf, selectableRowsOf } from "../../src/ui/mentionMenu";

const mentionables: ReadonlyArray<Mentionable> = [
  { detail: "Outlore", id: "q1", kind: "quest", trail: ["Fix login"] },
  { detail: "Outlore", id: "t1", kind: "side-quest", trail: ["Fix login", "Write tests"] },
  { detail: null, id: "q2", kind: "quest", trail: ["Read my emails"] },
  { detail: "/code/iskios", id: "r1", kind: "realm", trail: ["outlore"] },
  { detail: null, id: "r2", kind: "realm", trail: ["no-folder"] },
];
const entries: ReadonlyArray<WorkspaceEntry> = [
  { kind: "folder", path: "src/" },
  { kind: "file", path: "login.ts" },
];

const labelsOf = (rows: ReadonlyArray<MenuRow>) =>
  rows.map((row) => (row.type === "option" ? row.chip.label : `${row.type}:${row.category}`));

describe("offering what a # names", () => {
  it("shows the three categories for a bare #", () => {
    expect(labelsOf(mentionMenuOf({ category: null, mentionables, query: "" }))).toEqual([
      "category:realms",
      "category:quests",
      "category:errands",
    ]);
  });

  it("lists a chosen category's items, errands as Quest › Errand", () => {
    expect(labelsOf(mentionMenuOf({ category: "realms", mentionables, query: "" }))).toEqual(["outlore", "no-folder"]);
    expect(labelsOf(mentionMenuOf({ category: "quests", mentionables, query: "" }))).toEqual([
      "Fix login",
      "Read my emails",
    ]);
    expect(labelsOf(mentionMenuOf({ category: "errands", mentionables, query: "" }))).toEqual([
      "Fix login › Write tests",
    ]);
  });

  it("mixes every category's matches under its heading once text follows the #", () => {
    const rows = mentionMenuOf({ category: null, mentionables, query: "log" });
    expect(labelsOf(rows)).toEqual(["heading:quests", "Fix login", "heading:errands", "Fix login › Write tests"]);
    expect(selectableRowsOf(rows).every((row) => row.type === "option")).toBe(true);
    expect(labelsOf(mentionMenuOf({ category: null, mentionables, query: "OUT" }))).toEqual([
      "heading:realms",
      "outlore",
    ]);
    expect(labelsOf(mentionMenuOf({ category: null, mentionables, query: "zzz" }))).toEqual([]);
  });

  it("writes each kind as a one-word # token with its id and shows its name", () => {
    const chips = mentionMenuOf({ category: null, mentionables, query: "e" }).flatMap((row) =>
      row.type === "option" ? [row.chip] : [],
    );
    expect(chips).toContainEqual({ kind: "realm", label: "outlore", token: "#realm:r1" });
    expect(chips).toContainEqual({ kind: "quest", label: "Read my emails", token: "#quest:q2" });
    const [errand] = mentionMenuOf({ category: "errands", mentionables, query: "" });
    expect(errand?.type === "option" ? errand.chip : null).toEqual({
      kind: "errand",
      label: "Fix login › Write tests",
      token: "#side-quest:t1",
    });
  });
});

describe("offering what a + names", () => {
  it("lists the workspace's entries as + tokens, without the path already typed", () => {
    const rows = pathMenuOf({ entries, query: "" });
    expect(rows.flatMap((row) => (row.type === "option" ? [row.chip] : []))).toEqual([
      { kind: "folder", label: "src/", token: "+src/" },
      { kind: "file", label: "login.ts", token: "+login.ts" },
    ]);
    expect(labelsOf(pathMenuOf({ entries, query: "src/" }))).toEqual(["login.ts"]);
  });
});

describe("moving through the # list with the keys", () => {
  it("returns to the categories on Backspace right after a bare # in a category", () => {
    expect(menuKeyActionOf({ key: "Backspace", shiftKey: false }, { hasRows: true, isInCategory: true })).toEqual({
      type: "back",
    });
    expect(menuKeyActionOf({ key: "Backspace", shiftKey: false }, { hasRows: true, isInCategory: false })).toBeNull();
  });

  it("moves with the arrows and chooses with Enter or Tab, leaving Shift+Enter to the field", () => {
    const state = { hasRows: true, isInCategory: false };
    expect(menuKeyActionOf({ key: "ArrowDown", shiftKey: false }, state)).toEqual({ by: 1, type: "move" });
    expect(menuKeyActionOf({ key: "ArrowUp", shiftKey: false }, state)).toEqual({ by: -1, type: "move" });
    expect(menuKeyActionOf({ key: "Enter", shiftKey: false }, state)).toEqual({ type: "choose" });
    expect(menuKeyActionOf({ key: "Tab", shiftKey: false }, state)).toEqual({ type: "choose" });
    expect(menuKeyActionOf({ key: "Enter", shiftKey: true }, state)).toBeNull();
    expect(menuKeyActionOf({ key: "Enter", shiftKey: false }, { hasRows: false, isInCategory: false })).toBeNull();
  });
});

describe("drawing the references of a sent message as chips", () => {
  it("shows a quest, errand, and realm by name and a + path by its entry", () => {
    const text = "See #quest:q1, #side-quest:t1 in #realm:r1 and +src/";
    const chips = chipsOf(text, { entries: new Map([["src/", "folder"]]), mentionables, skills: [] });
    expect(chips.map((chip) => [chip.kind, chip.label])).toEqual([
      ["quest", "Fix login"],
      ["errand", "Fix login › Write tests"],
      ["realm", "outlore"],
      ["folder", "src/"],
    ]);
    expect(text.slice(chips[0]?.start, chips[0]?.end)).toBe("#quest:q1");
  });

  it("shows a $ skill and ignores a $ word that names none", () => {
    const skills = [{ description: "", name: "iterate", path: "/s/iterate/SKILL.md" }];
    const text = "Run $iterate for $5 and $unknown";
    const chips = chipsOf(text, { entries: new Map(), mentionables, skills });
    expect(chips.map((chip) => [chip.kind, chip.label])).toEqual([["skill", "iterate"]]);
  });

  it("no longer reads the words written before # named quests, errands, and realms", () => {
    const old = "@quest:q1 @side-quest:t1 @realm:r1 @src/";
    expect(chipsOf(old, { entries: new Map([["src/", "folder"]]), mentionables, skills: [] })).toEqual([]);
  });

  it("says a quest no longer open is gone, and only its kind while the list loads", () => {
    expect(chipsOf("#quest:gone", { entries: new Map(), mentionables, skills: [] }).map((chip) => chip.label)).toEqual([
      "quest no longer open",
    ]);
    expect(
      chipsOf("#quest:q1", { entries: new Map(), mentionables: null, skills: [] }).map((chip) => chip.label),
    ).toEqual(["quest"]);
  });
});
