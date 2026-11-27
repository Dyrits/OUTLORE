// The marks the owner types in a message to name something: `#` a realm, quest, or errand, `+` a file or folder, `$` a
// skill, and `@` a Companion (thread-messaging, CHG-0777). Each mark is described once here: its character, the words
// it forms, what its chips draw, what delivery tells the thread, and whether it opens reach. The composer's trigger, the
// chips, the delivery notes, and the filter on words a thread wrote all read this table, so a change to a mark is made
// and tested here.

/** A word of a message that names something by what follows its mark: the position of the mark, and the rest without it. */
export type MentionToken = {
  readonly end: number;
  readonly path: string;
  readonly start: number;
};

/** The kinds of thing a `#` reference names; an errand is a thread beneath a quest's top thread. */
export const mentionKinds = ["quest", "side-quest", "realm"] as const;

/** The kinds of chip the marks draw, each a key of the app's chip icons. */
export type MarkChipKind = "quest" | "errand" | "realm" | "file" | "folder" | "skill";

/** What one mark is, as every reader sees it. */
type MessageMark = {
  /** The one character that starts a word naming something, and opens the composer's list. */
  readonly character: string;
  /** The kinds of chip its words draw; empty where no chip exists yet. */
  readonly chipKinds: ReadonlyArray<MarkChipKind>;
  /** The first line of the note delivery appends after the owner's words, or null where delivery tells nothing. */
  readonly deliveryHeading: string | null;
  /** Whether a word of this mark opens a quest's journal or a thread to the turn it reaches (audit SA-06). */
  readonly grantsReach: boolean;
  /** The words that follow a reach-granting mark in its token, such as `quest` in `#quest:<id>`; empty for the others. */
  readonly reachHeads: ReadonlyArray<string>;
};

const characters = { companion: "@", mention: "#", path: "+", skill: "$" } as const;

/** The marks, by what they name: a mention is a quest, errand, or realm; a path a file or folder; a skill; a Companion. */
export const messageMarks = {
  // Reserved: typing `@` offers nothing yet, and no word of it is read (thread-messaging, Mentioning a Companion with @).
  companion: {
    character: characters.companion,
    chipKinds: [],
    deliveryHeading: null,
    grantsReach: false,
    reachHeads: [],
  },
  mention: {
    character: characters.mention,
    chipKinds: ["quest", "errand", "realm"],
    deliveryHeading: `The owner mentioned these with ${characters.mention}, as context: decide from their words whether to look at each or write to it.`,
    grantsReach: true,
    // `errand` is the owner's word for `side-quest`: dropped from a thread's text as well, though it is no token.
    reachHeads: [...mentionKinds, "errand"],
  },
  path: {
    character: characters.path,
    chipKinds: ["file", "folder"],
    deliveryHeading: `The owner named these files or folders with ${characters.path}, relative to your working folder:`,
    grantsReach: false,
    reachHeads: [],
  },
  skill: {
    character: characters.skill,
    chipKinds: ["skill"],
    deliveryHeading: "The message names these skills:",
    grantsReach: false,
    reachHeads: [],
  },
} as const satisfies Record<string, MessageMark>;

/** The name of a mark: the key of the table. */
export type MarkName = keyof typeof messageMarks;

/** The character of a mark. */
export type MarkCharacter = (typeof messageMarks)[MarkName]["character"];

const isMarkName = (key: string): key is MarkName => Object.hasOwn(messageMarks, key);

const markNames: ReadonlyArray<MarkName> = Object.keys(messageMarks).filter(isMarkName);

/** Every mark's character, in the table's order. */
export const markCharacters: ReadonlyArray<MarkCharacter> = markNames.map((name) => messageMarks[name].character);

/** Whether a character is the character of a mark. */
export const isMarkCharacter = (character: string): character is MarkCharacter => markNameOf(character) !== null;

/** The mark a character opens, or null for a character that is no mark. */
export const markNameOf = (character: string): MarkName | null =>
  markNames.find((name) => messageMarks[name].character === character) ?? null;

/** Whether the text holds the mark's character anywhere; a cheap test before reading its words. */
export const hasMark = (text: string, name: MarkName) => text.includes(messageMarks[name].character);

/** A word as the message holds it: the mark's character before it. */
export const markedWordOf = (name: MarkName, word: string) => `${messageMarks[name].character}${word}`;

/** The characters of a pattern that mean something else are written out, so a mark such as `$` or `+` matches itself. */
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The mark's character as a pattern. */
const markPattern = (name: MarkName) => escaped(messageMarks[name].character);

/**
 * Reads the words that start with a mark and have the given body: the position of the mark, and the body without it.
 * `ending` is a lookahead the word must be followed by, outside the body.
 */
const wordsOf = (text: string, name: MarkName, body: string, ending = ""): ReadonlyArray<MentionToken> =>
  Array.from(text.matchAll(new RegExp(`(^|\\s)${markPattern(name)}(${body})${ending}`, "g")), (match) => {
    const path = match[2] ?? "";
    const start = (match.index ?? 0) + (match[1] ?? "").length;
    return { end: start + 1 + path.length, path, start };
  });

/** The word a `#` token holds: a kind, a colon, and the id; titles have spaces and change, so the id is what it carries. */
const referenceBody = `(?:${mentionKinds.join("|")}):[A-Za-z0-9-]+`;

/** The word the owner is typing at the end of a text: a mark starting the word, then what follows it up to the caret. */
export const typedMarkPattern = new RegExp(`(^|\\s)(${markCharacters.map(escaped).join("|")})(\\S*)$`);

/** The `#quest:<id>`, `#side-quest:<id>`, and `#realm:<id>` words in a message: the position of each `#`, and the word without it. */
export const referenceTokensOf = (text: string) => wordsOf(text, "mention", referenceBody);

/**
 * The `+`-paths in a message: a `+` starting a word, then a path up to a space; punctuation closing a sentence is not
 * part of it. A path written `@src/index.ts` before CHG-0777 is no longer read; `+` alone names nothing, and `+1` names
 * a file only where the workspace holds one called `1`.
 */
export const pathTokensOf = (text: string) => wordsOf(text, "path", String.raw`\S*[^\s.,;:!?)\]'"]`);

/** The `$`-words in a message: a `$` starting a word, then a name that ends the word, so an amount such as $5.50 is not a skill. */
export const skillWordsOf = (text: string) =>
  wordsOf(text, "skill", String.raw`[A-Za-z0-9][\w:.-]*?`, String.raw`(?=[.,;:!?]*(?:\s|$))`);

/**
 * A thread's own words with the `#` of every reference token dropped: thread-written text is later stored as the
 * owner's own, and a mention in it must not grant reach as the owner's would (audit SA-06). Every mark that grants
 * reach is read from the table, so a new one is covered by being declared.
 */
export const withoutReachMarks = (text: string) =>
  markNames
    .filter((name) => messageMarks[name].grantsReach && messageMarks[name].reachHeads.length > 0)
    .reduce(
      (current, name) =>
        current.replace(new RegExp(`${markPattern(name)}(?=(?:${messageMarks[name].reachHeads.join("|")}):)`, "g"), ""),
      text,
    );
