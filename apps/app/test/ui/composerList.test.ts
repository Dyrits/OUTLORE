import type { AccountId, CompanionChoice, Mentionable, Skill, WorkspaceEntry } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import {
  composerListOf,
  initialListState,
  type ListSource,
  type ListState,
  listAfterKey,
  listAfterTyping,
} from "../../src/ui/composerList";

const skills: ReadonlyArray<Skill> = [
  { description: "Design a module", name: "architect" } as Skill,
  { description: "Review a change", name: "review" } as Skill,
  { description: "Architecture audit", name: "architecture" } as Skill,
];
const mentionables: ReadonlyArray<Mentionable> = [
  { detail: "Outlore", id: "q1", kind: "quest", trail: ["Fix login"] },
  { detail: "/code/iskios", id: "r1", kind: "realm", trail: ["outlore"] },
];
const companions: ReadonlyArray<CompanionChoice> = [
  { accountId: null, accountLabel: "This computer", harness: "codex", model: "gpt-6.1-sol", modelLabel: "GPT 6.1 Sol" },
  {
    accountId: "acc-w" as AccountId,
    accountLabel: "Work",
    harness: "claude",
    model: "claude-opus-5-5",
    modelLabel: "Opus 5.5",
  },
  {
    accountId: null,
    accountLabel: "This computer",
    harness: "claude",
    model: "claude-opus-5-5",
    modelLabel: "Opus 5.5",
  },
];
const entries: ReadonlyArray<WorkspaceEntry> = [{ kind: "folder", path: "src/" }];

const source = (trigger: ListSource["trigger"], hasMentions = true): ListSource => ({
  companions,
  entries,
  mentionables,
  mentions: hasMentions ? { canAskCompanions: true, hasFolder: true } : null,
  skills,
  trigger,
});
const typed = (character: "$" | "+" | "#" | "@", query = ""): ListSource["trigger"] => ({ character, query });
const labelsOf = (rows: ReturnType<typeof composerListOf>["rows"]) =>
  rows.map((row) => (row.type === "option" ? row.chip.label : `${row.type}:${row.category}`));
const press = (state: ListState, list: ReturnType<typeof composerListOf>, key: string, shiftKey = false) =>
  listAfterKey(state, list, { key, shiftKey });

describe("the $ list", () => {
  it("offers the skills a typed word can be completed to, at most six", () => {
    expect(labelsOf(composerListOf(source(typed("$", "arch")), initialListState).rows)).toEqual([
      "architect",
      "architecture",
    ]);
    expect(composerListOf(source(typed("$")), initialListState).rows).toHaveLength(3);
  });

  it("turns a fully typed skill name into a chip with Tab, even without # mentions", () => {
    const list = composerListOf(source(typed("$", "review"), false), initialListState);
    expect(press(initialListState, list, "Tab")).toMatchObject({
      chip: { kind: "skill", label: "review", token: "$review" },
      handled: true,
    });
    expect(composerListOf(source(typed("$", "rev"), false), initialListState).rows).toHaveLength(1);
  });

  it("highlights the exact skill before a longer name with the same prefix", () => {
    const list = composerListOf(
      { ...source(typed("$", "ARCHITECT")), skills: [...skills].reverse() },
      initialListState,
    );
    expect(labelsOf(list.rows)).toEqual(["architect", "architecture"]);
    expect(press(initialListState, list, "Tab").chip).toEqual({
      kind: "skill",
      label: "architect",
      token: "$architect",
    });
  });

  it("offers nothing with no trigger", () => {
    expect(composerListOf(source(null), initialListState).rows).toEqual([]);
  });
});

describe("the + list", () => {
  it("offers the workspace's entries and hands back a + chip with Tab", () => {
    const list = composerListOf(source(typed("+", "s")), initialListState);
    expect(labelsOf(list.rows)).toEqual(["src/"]);
    expect(press(initialListState, list, "Tab").chip).toEqual({ kind: "folder", label: "src/", token: "+src/" });
  });

  it("offers nothing without a folder or where mentions are not offered", () => {
    expect(
      composerListOf(
        { ...source(typed("+")), mentions: { canAskCompanions: true, hasFolder: false } },
        initialListState,
      ).rows,
    ).toEqual([]);
    expect(composerListOf(source(typed("+"), false), initialListState).rows).toEqual([]);
  });
});

describe("the # list", () => {
  it("offers the three categories for a bare #, with nothing inside a category yet", () => {
    const list = composerListOf(source(typed("#")), initialListState);
    expect(labelsOf(list.rows)).toEqual(["category:realms", "category:quests", "category:errands"]);
    expect(list.isInCategory).toBe(false);
  });

  it("offers nothing for a # where mentions are not offered", () => {
    expect(composerListOf(source(typed("#"), false), initialListState).rows).toEqual([]);
  });

  it("drops a category opened under a # once the owner types a $", () => {
    expect(listAfterTyping({ category: "quests", chosen: 1 }, typed("$"))).toEqual({ category: null, chosen: 0 });
  });
});

describe("the # list across keystrokes", () => {
  it("opens a category with Enter, shows its items, and returns on Backspace", () => {
    const bare = source(typed("#"));
    const categories = composerListOf(bare, initialListState);
    expect(labelsOf(categories.rows)).toEqual(["category:realms", "category:quests", "category:errands"]);
    const opened = press(initialListState, categories, "ArrowDown");
    expect(opened.state.chosen).toBe(1);
    const inQuests = press(opened.state, composerListOf(bare, opened.state), "Enter");
    expect(inQuests.handled).toBe(true);
    expect(inQuests.chip).toBeNull();
    expect(inQuests.state).toEqual({ category: "quests", chosen: 0 });
    const inside = composerListOf(bare, inQuests.state);
    expect(inside.isInCategory).toBe(true);
    expect(labelsOf(inside.rows)).toEqual(["Fix login"]);
    const back = press(inQuests.state, inside, "Backspace");
    expect(back).toMatchObject({ chip: null, handled: true, state: { category: null, chosen: 0 } });
  });

  it("chooses an item with Tab and hands back its chip", () => {
    const state: ListState = { category: "quests", chosen: 0 };
    const chosen = press(state, composerListOf(source(typed("#")), state), "Tab");
    expect(chosen.chip).toEqual({ kind: "quest", label: "Fix login", token: "#quest:q1" });
    expect(chosen.handled).toBe(true);
  });

  it("moves with the arrows, wrapping at both ends", () => {
    const list = composerListOf(source(typed("#")), initialListState);
    const down = press(initialListState, list, "ArrowDown").state;
    expect(down.chosen).toBe(1);
    expect(press({ ...down, chosen: 2 }, list, "ArrowDown").state.chosen).toBe(0);
    expect(press(initialListState, list, "ArrowUp").state.chosen).toBe(2);
  });

  it("keeps the category only under a bare #, and goes back to the first line on any typing", () => {
    const inside: ListState = { category: "realms", chosen: 2 };
    expect(listAfterTyping(inside, typed("#"))).toEqual({ category: "realms", chosen: 0 });
    expect(listAfterTyping(inside, typed("#", "s"))).toEqual({ category: null, chosen: 0 });
    expect(listAfterTyping(inside, typed("$"))).toEqual({ category: null, chosen: 0 });
    expect(listAfterTyping(inside, null)).toEqual({ category: null, chosen: 0 });
  });

  it("leaves Enter to the field when there is no list, and Shift+Enter always", () => {
    const none = composerListOf(source(null), initialListState);
    expect(press(initialListState, none, "Enter")).toMatchObject({ chip: null, handled: false });
    const list = composerListOf(source(typed("#")), initialListState);
    expect(press(initialListState, list, "Enter", true).handled).toBe(false);
  });
});

describe("the @ list", () => {
  it("offers the Companion category for a bare @, and the models of every signed-in account inside it", () => {
    const bare = composerListOf(source(typed("@")), initialListState);
    expect(labelsOf(bare.rows)).toEqual(["category:companions"]);
    const opened = press(initialListState, bare, "Enter");
    expect(opened.state.category).toBe("companions");
    const inside = composerListOf(source(typed("@")), opened.state);
    expect(inside.isInCategory).toBe(true);
    expect(labelsOf(inside.rows)).toEqual(["GPT 6.1 Sol", "Opus 5.5", "Opus 5.5"]);
  });

  it("names the harness and the account in each row's description, so two accounts of one model differ", () => {
    const rows = composerListOf(source(typed("@", "opus")), initialListState).rows;
    expect(rows.map((row) => (row.type === "option" ? row.description : row.type))).toEqual([
      "heading",
      "Claude Code · Work",
      "Claude Code · This computer",
    ]);
  });

  it("searches what follows the @ by model, harness, or account, under the Companions heading", () => {
    expect(labelsOf(composerListOf(source(typed("@", "gpt")), initialListState).rows)).toEqual([
      "heading:companions",
      "GPT 6.1 Sol",
    ]);
    expect(labelsOf(composerListOf(source(typed("@", "work")), initialListState).rows)).toEqual([
      "heading:companions",
      "Opus 5.5",
    ]);
    expect(composerListOf(source(typed("@", "nothing-like-this")), initialListState).rows).toEqual([]);
  });

  it("hands back a chip holding harness, account and model, with Tab", () => {
    const list = composerListOf(source(typed("@", "gpt")), initialListState);
    expect(press(initialListState, list, "Tab").chip).toEqual({
      kind: "companion",
      label: "GPT 6.1 Sol",
      token: "@companion:codex:-:gpt-6%2E1-sol",
    });
  });

  it("offers nothing where no Companion can be asked, such as Chronicler's box", () => {
    const where = { ...source(typed("@")), mentions: { canAskCompanions: false, hasFolder: true } };
    expect(composerListOf(where, initialListState).rows).toEqual([]);
    expect(composerListOf(source(typed("@"), false), initialListState).rows).toEqual([]);
  });

  it("returns to the categories with Backspace right after a bare @ in the category, as # does", () => {
    const opened: ListState = { category: "companions", chosen: 0 };
    const list = composerListOf(source(typed("@")), opened);
    expect(press(opened, list, "Backspace")).toMatchObject({ handled: true, state: { category: null } });
    expect(listAfterTyping(opened, typed("@", "g")).category).toBeNull();
    expect(listAfterTyping(opened, typed("@")).category).toBe("companions");
  });
});
