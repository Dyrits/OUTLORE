import { Schema } from "effect";
import { markedWordOf, mentionKinds, referenceTokensOf } from "./marks.ts";

// What a typed `#` in a message can name: a realm, a quest, or an errand (thread-messaging, Who can message whom;
// CHG-0181, and CHG-0777 for the move from `@` to `#`). A mention is context only: the receiving thread decides from the
// owner's words whether to read the item or message it.

/** The kinds of thing a reference names; an errand is a thread beneath a quest's top thread. */
export const MentionKind = Schema.Literals(mentionKinds);
export type MentionKind = typeof MentionKind.Type;

/** One quest, errand, or realm the `#` menu offers; archived quests and their errands are never offered. */
export const Mentionable = Schema.Struct({
  /** What the chip and the menu add after the name: a quest's realm, or a realm's folder; null for neither. */
  detail: Schema.NullOr(Schema.String),
  /** The quest's id, the errand's thread id, or the realm's id. */
  id: Schema.String,
  kind: MentionKind,
  /** The titles from the quest down to the errand itself, or the realm's name alone; the chip joins them with ›. */
  trail: Schema.Array(Schema.String),
});
export type Mentionable = typeof Mentionable.Type;

/** A reference to a quest, errand, or realm as the message holds it, without its leading `#`. */
export type MentionReference = {
  readonly id: string;
  readonly kind: MentionKind;
};

/**
 * The token a reference is written as in the message: `#quest:<id>`, `#side-quest:<thread id>`, or `#realm:<id>`. It is
 * one word, and it carries the id, since titles have spaces and change. Messages written before CHG-0777 held `@quest:`
 * and `@side-quest:` words and `@`-paths; they are no longer read as mentions.
 */
export const mentionTokenOf = (reference: MentionReference) =>
  markedWordOf("mention", `${reference.kind}:${reference.id}`);

const referencePattern = /^(quest|side-quest|realm):([A-Za-z0-9-]+)$/;

/** The reference a word stands for, without its `#`, or null for any other word. */
export const referenceOf = (path: string): MentionReference | null => {
  const match = referencePattern.exec(path);
  const kind = mentionKinds.find((each) => each === match?.[1]);
  if (match === null || kind === undefined) return null;
  return { id: match[2] ?? "", kind };
};

/** The quest, errand, and realm references in a message, in order, each once. */
export const mentionReferencesOf = (text: string): ReadonlyArray<MentionReference> => {
  const seen = new Set<string>();
  return referenceTokensOf(text).flatMap((token) => {
    const reference = referenceOf(token.path);
    if (reference === null || seen.has(token.path)) return [];
    seen.add(token.path);
    return [reference];
  });
};

/** The label a chip shows: the realm's name, the quest's title, or `Quest › Errand`. */
export const mentionLabelOf = (mentionable: Pick<Mentionable, "trail">) => mentionable.trail.join(" › ");
