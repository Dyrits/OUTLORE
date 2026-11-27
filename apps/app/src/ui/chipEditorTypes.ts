import { isMarkCharacter, type MarkCharacter, typedMarkPattern } from "@outlore/contracts";
import type { Ref } from "react";
import type { ChipKind } from "./chips";

// What the message box's text field offers the composer, whether it can draw chips inside its text (web) or not.

/** A skill, workspace path, quest, errand, or realm chosen from a list: how it reads in the message and how it shows as a chip. */
export type Chip = {
  readonly kind: ChipKind;
  readonly label: string;
  /** What the message holds in its place, such as `$architect`, `+src/`, or `#realm:<id>`. */
  readonly token: string;
};

/** The mark that opens a list: the character of one of the message marks (`$`, `+`, `#`, `@`), as the contracts define them. */
export type TriggerMark = MarkCharacter;

/** The mark the owner typed at the start of a word just before the caret, with the text after it, as the field reports it. */
export type Trigger = {
  readonly character: TriggerMark;
  readonly query: string;
};

/** What the owner of the field can ask of it from outside: clear it, or put a chip or words in it. */
export interface ChipEditorHandle {
  clear: () => void;
  /** Puts a chip where the trigger is, in place of it. */
  insertChip: (chip: Chip) => void;
  /** Puts dictated words at the caret, kept apart from the text around them by spaces. */
  insertText: (spoken: string) => void;
}

export type ChipEditorProps = {
  /** Text the field starts with, such as what the owner left unsent; read once, when the field opens. */
  initialText?: string;
  /** Opens the terminal when the caret is at an empty line. */
  onBang?: () => void;
  /** Hears the message as plain text, each chip as its token, and the trigger at the caret. */
  onChange: (text: string, trigger: Trigger | null) => void;
  /** Hears the files pasted or dropped on the field, where files can be; text pasted with files stays text. */
  onFiles?: (files: ReadonlyArray<File>) => void;
  /** Hears a key before the field does; answering true says it was handled. */
  onKeyDown: (key: { readonly key: string; readonly shiftKey: boolean }) => boolean;
  placeholder: string;
  ref?: Ref<ChipEditorHandle>;
};

/** How many characters of the text the trigger takes: its mark and what follows it. */
export const triggerLengthOf = (trigger: Trigger) => trigger.character.length + trigger.query.length;

/** The trigger a text ends with, or the text before a caret; null when the last word starts with no mark. */
export const triggerOfEnd = (text: string): Trigger | null => {
  const match = typedMarkPattern.exec(text);
  const character = match?.[2];
  if (character === undefined || !isMarkCharacter(character)) return null;
  return { character, query: match?.[3] ?? "" };
};
