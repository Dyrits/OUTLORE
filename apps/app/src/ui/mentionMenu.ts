import { type Mentionable, markedWordOf, mentionLabelOf, type WorkspaceEntry } from "@outlore/contracts";
import type { Chip } from "./chipEditorTypes";
import { chipOfMentionable } from "./chipPlaces";
import type { ChipKind } from "./chips";

// What the list above the message box offers after a typed `#` or `+` (CHG-0181, CHG-0777): a bare `#` shows the
// categories (realms, quests, errands), a chosen category its items, and any text after the `#` the matches of every
// category under its heading; a `+` shows the files and folders of the workspace, narrowed by what follows it.

/** The groups a `#` names things from. */
export type MentionCategory = "realms" | "quests" | "errands";

/** Each category's heading, the icon it shows, and the kind of reference it lists. */
export const mentionCategories = {
  errands: { kind: "errand", label: "Errands", mention: "side-quest" },
  quests: { kind: "quest", label: "Quests", mention: "quest" },
  realms: { kind: "realm", label: "Realms", mention: "realm" },
} as const satisfies Record<
  MentionCategory,
  { readonly kind: ChipKind; readonly label: string; readonly mention: Mentionable["kind"] }
>;

const categories: ReadonlyArray<MentionCategory> = ["realms", "quests", "errands"];

/** One line of the list: a category to open, a heading over a category's matches, or an item to put in the message. */
export type MenuRow =
  | { readonly type: "category"; readonly key: string; readonly category: MentionCategory }
  | { readonly type: "heading"; readonly key: string; readonly category: MentionCategory }
  | { readonly type: "option"; readonly key: string; readonly chip: Chip; readonly description: string };

/** Lines the owner can move to and choose; headings are skipped. */
export const selectableRowsOf = (rows: ReadonlyArray<MenuRow>) => rows.filter((row) => row.type !== "heading");

/** How many items a chosen category shows, and how many each category shows among mixed matches. */
const CATEGORY_LIMIT = 12;
const MIXED_LIMIT = 5;

const mentionableOptionOf = (mentionable: Mentionable): MenuRow => ({
  chip: chipOfMentionable(mentionable),
  description: mentionable.detail ?? (mentionable.kind === "realm" ? "Tied to no folder" : "No realm"),
  key: `${mentionable.kind}:${mentionable.id}`,
  type: "option",
});

const entryOptionOf = (entry: WorkspaceEntry): MenuRow => ({
  chip: { kind: entry.kind, label: entry.path, token: markedWordOf("path", entry.path) },
  description: "",
  key: `path:${entry.path}`,
  type: "option",
});

/**
 * The list for what follows a typed `#`. With nothing typed after it: the categories, or the chosen category's items.
 * With text: each category's matches under its heading, a quest or realm matching on its name and an errand on its path
 * (`Quest › Errand`).
 */
export const mentionMenuOf = (given: {
  readonly query: string;
  readonly category: MentionCategory | null;
  readonly mentionables: ReadonlyArray<Mentionable>;
}): ReadonlyArray<MenuRow> => {
  const needle = given.query.toLowerCase();
  const itemsOf = (category: MentionCategory, limit: number): ReadonlyArray<MenuRow> =>
    given.mentionables
      .filter((each) => each.kind === mentionCategories[category].mention)
      .filter((each) => mentionLabelOf(each).toLowerCase().includes(needle))
      .slice(0, limit)
      .map(mentionableOptionOf);
  if (given.query === "") {
    if (given.category === null)
      return categories.map((category) => ({ category, key: `category:${category}`, type: "category" }));
    return itemsOf(given.category, CATEGORY_LIMIT);
  }
  return categories.flatMap((category) => {
    const items = itemsOf(category, MIXED_LIMIT);
    return items.length === 0 ? [] : [{ category, key: `heading:${category}`, type: "heading" } as const, ...items];
  });
};

/** The list for what follows a typed `+`: the workspace's files and folders as the service found them, but not the path already typed. */
export const pathMenuOf = (given: {
  readonly query: string;
  readonly entries: ReadonlyArray<WorkspaceEntry>;
}): ReadonlyArray<MenuRow> =>
  given.entries
    .filter((entry) => entry.path !== given.query)
    .slice(0, CATEGORY_LIMIT)
    .map(entryOptionOf);

/** What a key does to the open list, or null when the key is the field's own. */
export type MenuKeyAction =
  | { readonly type: "move"; readonly by: 1 | -1 }
  | { readonly type: "choose" }
  | { readonly type: "back" };

/**
 * The list's keys: arrows move, Enter or Tab chooses (opening a category, or putting an item in the message), and
 * Backspace right after a bare `#` in a category returns to the categories instead of erasing the `#`.
 */
export const menuKeyActionOf = (
  key: { readonly key: string; readonly shiftKey: boolean },
  state: { readonly hasRows: boolean; readonly isInCategory: boolean },
): MenuKeyAction | null => {
  if (key.key === "Backspace" && state.isInCategory) return { type: "back" };
  if (!state.hasRows) return null;
  if (key.key === "ArrowDown") return { by: 1, type: "move" };
  if (key.key === "ArrowUp") return { by: -1, type: "move" };
  if (key.key === "Tab" || (key.key === "Enter" && !key.shiftKey)) return { type: "choose" };
  return null;
};
