import { isSamePicker } from "../editors/pickerState";
import type { CompanionPickerProps } from "../foundation/companionPickerProps";
import type { PanelContent } from "../foundation/panelState";
import { isCompanionOffered } from "./companionScope";

type Entry = { picker: CompanionPickerProps | null; rank: number; sequence: number };

/** Owns mounted pickers, their ordering and live action routing independently of React. */
export const createCompanionRegistry = () => {
  const entries = new Map<string, Entry>();
  let sequence = 0;
  const register = (id: string) => {
    sequence += 1;
    entries.set(id, { picker: null, rank: 0, sequence });
  };
  const publish = (id: string, picker: CompanionPickerProps, rank: number) => {
    const entry = entries.get(id);
    if (entry === undefined) return false;
    const hasChanged = entry.rank !== rank || !isSamePicker(entry.picker, picker);
    entry.picker = picker;
    entry.rank = rank;
    return hasChanged;
  };
  const unregister = (id: string) => entries.delete(id);
  const choose = (id: string): PanelContent | null => {
    const picker = entries.get(id)?.picker;
    return picker == null ? null : { id, isChronicler: picker.isChronicler === true, tab: "companion" };
  };
  const selected = (content: PanelContent | null, isFull: boolean, isChroniclerOpen: boolean) => {
    const offered = [...entries].filter(
      ([, entry]) =>
        entry.picker !== null && isCompanionOffered(entry.picker.isChronicler === true, isFull, isChroniclerOpen),
    );
    offered.sort((current, next) => current[1].rank - next[1].rank || next[1].sequence - current[1].sequence);
    const selection = content?.tab === "companion" ? content : null;
    const id =
      selection === null
        ? (offered[0]?.[0] ?? null)
        : (offered.find(([id]) => id === selection.id)?.[0] ??
          (selection.isChronicler ? offered.find(([, entry]) => entry.picker?.isChronicler === true)?.[0] : null) ??
          null);
    const picker = id === null ? null : (entries.get(id)?.picker ?? null);
    const companionPicker =
      picker === null
        ? null
        : {
            ...picker,
            // Data can stay drawn while a render publishes fresh closures; actions always reach the live owner.
            onEffort: (...args: Parameters<CompanionPickerProps["onEffort"]>) =>
              entries.get(id ?? "")?.picker?.onEffort(...args),
            onModel: (...args: Parameters<CompanionPickerProps["onModel"]>) =>
              entries.get(id ?? "")?.picker?.onModel(...args),
          };
    return {
      companionPicker,
      hasCompanion: offered.length > 0,
      isCompanionShown: selection !== null && picker !== null,
      otherPillId:
        offered.find(([, entry]) => (entry.picker?.isChronicler === true) !== (picker?.isChronicler === true))?.[0] ??
        null,
      pillId: id,
    };
  };
  return { choose, publish, register, selected, unregister };
};
