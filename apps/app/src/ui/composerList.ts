import {
  type MarkName,
  type Mentionable,
  markedWordOf,
  markNameOf,
  type Skill,
  type WorkspaceEntry,
} from "@outlore/contracts";
import type { Chip, Trigger } from "./chipEditorTypes";
import {
  type MentionCategory,
  type MenuKeyAction,
  type MenuRow,
  mentionMenuOf,
  menuKeyActionOf,
  pathMenuOf,
  selectableRowsOf,
} from "./mentionMenu";

// The list above the message box and the state it keeps between keystrokes (CHG-0181, CHG-0777): a `$` offers skills,
// a `+` the files and folders of the workspace, and a `#` offers categories, a category's items, or the matches of
// every category. An `@` offers nothing yet. Kept apart from the screen so a sequence of typing and keys can be checked
// without one.

/** What the list remembers: the category opened from a bare `#`, and the line the owner moved to. */
export type ListState = {
  readonly category: MentionCategory | null;
  readonly chosen: number;
};

export const initialListState: ListState = { category: null, chosen: 0 };

/** What the list is built from. `mentions` is null where a `#` or a `+` offers nothing; `hasFolder` is whether the message is written in a realm with a folder. */
export type ListSource = {
  readonly entries: ReadonlyArray<WorkspaceEntry>;
  readonly mentionables: ReadonlyArray<Mentionable>;
  readonly mentions: { readonly hasFolder: boolean } | null;
  readonly skills: ReadonlyArray<Skill>;
  readonly trigger: Trigger | null;
};

/** The lines shown, the one the owner is on, and whether the list is a category's items under a bare `#`. */
type ComposerList = {
  readonly highlighted: MenuRow | undefined;
  readonly isInCategory: boolean;
  readonly rows: ReadonlyArray<MenuRow>;
};

const SKILL_LIMIT = 6;

/** The skills a typed `$word` can turn into a chip, with the exact match first. */
const skillRowsOf = (skills: ReadonlyArray<Skill>, partial: string): ReadonlyArray<MenuRow> => {
  const query = partial.toLowerCase();
  const isExact = (skill: Skill) => skill.name.toLowerCase() === query;
  return skills
    .filter((skill) => skill.name.toLowerCase().startsWith(query))
    .sort((current, next) => Number(isExact(next)) - Number(isExact(current)))
    .slice(0, SKILL_LIMIT)
    .map(
      (skill): MenuRow => ({
        chip: { kind: "skill", label: skill.name, token: markedWordOf("skill", skill.name) },
        description: skill.description,
        key: skill.name,
        type: "option",
      }),
    );
};

/** What each mark offers for what follows it; a mark added to the table must be given its list here, or none. */
const rowsByMark = {
  // Reserved: no Companion can be chosen yet (thread-messaging, Mentioning a Companion with @).
  companion: () => [],
  mention: (source, state, query) =>
    source.mentions === null
      ? []
      : mentionMenuOf({ category: state.category, mentionables: source.mentionables, query }),
  path: (source, _state, query) =>
    source.mentions?.hasFolder === true ? pathMenuOf({ entries: source.entries, query }) : [],
  skill: (source, _state, query) => skillRowsOf(source.skills, query),
} satisfies Record<MarkName, (source: ListSource, state: ListState, query: string) => ReadonlyArray<MenuRow>>;

/** The lines a trigger offers: skills for `$`, the workspace's paths for `+`, quests, errands, and realms for `#`, nothing for `@`. */
const rowsOf = (source: ListSource, state: ListState): ReadonlyArray<MenuRow> => {
  const { trigger } = source;
  const mark = trigger === null ? null : markNameOf(trigger.character);
  if (trigger === null || mark === null) return [];
  return rowsByMark[mark](source, state, trigger.query);
};

/** The list for the trigger at the caret, in the state it is in. */
export const composerListOf = (source: ListSource, state: ListState): ComposerList => {
  const { trigger } = source;
  const rows = rowsOf(source, state);
  const selectable = selectableRowsOf(rows);
  return {
    highlighted: selectable[Math.min(state.chosen, selectable.length - 1)],
    isInCategory:
      state.category !== null &&
      trigger !== null &&
      markNameOf(trigger.character) === "mention" &&
      trigger.query === "",
    rows,
  };
};

/** The state after the field reports a new text: the first line is on, and a category stays only under a bare `#`. */
export const listAfterTyping = (state: ListState, trigger: Trigger | null): ListState => ({
  category:
    trigger === null || markNameOf(trigger.character) !== "mention" || trigger.query !== "" ? null : state.category,
  chosen: 0,
});

/** What choosing a line does: a category opens, an item becomes a chip in the message. */
export const listAfterChoosing = (
  state: ListState,
  row: MenuRow,
): { readonly state: ListState; readonly chip: Chip | null } => {
  if (row.type === "option") return { chip: row.chip, state };
  if (row.type === "category") return { chip: null, state: { category: row.category, chosen: 0 } };
  return { chip: null, state };
};

/** What a key does to the list; `handled` says the field must not see it, `chip` is an item to put in the message. */
export const listAfterKey = (
  state: ListState,
  list: ComposerList,
  key: { readonly key: string; readonly shiftKey: boolean },
): { readonly state: ListState; readonly handled: boolean; readonly chip: Chip | null } => {
  const action: MenuKeyAction | null = menuKeyActionOf(key, {
    hasRows: list.highlighted !== undefined,
    isInCategory: list.isInCategory,
  });
  if (action === null) return { chip: null, handled: false, state };
  if (action.type === "back") return { chip: null, handled: true, state: { category: null, chosen: 0 } };
  if (action.type === "choose") {
    const choice = list.highlighted === undefined ? null : listAfterChoosing(state, list.highlighted);
    return { chip: choice?.chip ?? null, handled: true, state: choice?.state ?? state };
  }
  const count = selectableRowsOf(list.rows).length;
  const at = Math.min(state.chosen, count - 1);
  return {
    chip: null,
    handled: true,
    state: { ...state, chosen: (at + action.by + count) % count },
  };
};
