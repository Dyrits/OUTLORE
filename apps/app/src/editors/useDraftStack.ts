import type { Tier } from "@outlore/contracts";
import { useState } from "react";
import { isSameStack } from "./presets";

/** A draft and the saved stack it was begun from. */
export type OwnDraft = { readonly editedFrom: Tier; readonly value: Tier };

/** The stack to show: the draft while the saved stack is still the one it began from, else the saved one, as when it was saved or another device changed it. */
export const shownStackOf = (own: OwnDraft | null, saved: Tier): Tier =>
  own !== null && isSameStack(own.editedFrom, saved) ? own.value : saved;

/**
 * A stack the owner edits against the saved one; nothing is saved by editing.
 * The caller saves `shown` or calls `discard`.
 */
export function useDraftStack(saved: Tier, initial: Tier | null = null) {
  const [own, setOwn] = useState<OwnDraft | null>(initial === null ? null : { editedFrom: saved, value: initial });
  const shown = shownStackOf(own, saved);
  return {
    discard: () => setOwn(null),
    edit: (value: Tier) => setOwn({ editedFrom: saved, value }),
    isChanged: !isSameStack(shown, saved),
    shown,
  };
}

/** Drafts kept by preset, each with the saved stack it began from. */
export type KeptDrafts = Readonly<Record<string, OwnDraft>>;

/** The drafts with the one of `key` set to `next` against `saved`, or dropped when `next` is null or is the saved stack itself. */
export const keptWith = (drafts: KeptDrafts, key: string, saved: Tier, next: Tier | null): KeptDrafts => {
  const { [key]: _dropped, ...others } = drafts;
  return next === null || isSameStack(next, saved) ? others : { ...others, [key]: { editedFrom: saved, value: next } };
};

/** The kept drafts that still hold: those whose preset is still the saved stack they began from, by preset. */
export const liveDraftsOf = (
  drafts: KeptDrafts,
  savedOf: (key: string) => Tier | null,
): Readonly<Record<string, Tier>> =>
  Object.fromEntries(
    Object.entries(drafts).flatMap(([key, own]) => {
      const saved = savedOf(key);
      return saved !== null && isSameStack(own.editedFrom, saved) ? [[key, own.value]] : [];
    }),
  );

/** The drafts with the one of `from` moved to `to`, as when its preset is renamed: it follows the preset instead of staying under the old name. */
export const keptRenamed = (drafts: KeptDrafts, from: string, to: string): KeptDrafts => {
  const { [from]: moved, ...others } = drafts;
  return moved === undefined ? drafts : { ...others, [to]: moved };
};

/** The drafts without the one of `key`, as when its preset is deleted: a later preset of the same name starts clean. */
export const keptWithout = (drafts: KeptDrafts, key: string): KeptDrafts => {
  const { [key]: _dropped, ...others } = drafts;
  return others;
};
