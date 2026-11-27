import { Schema } from "effect";
import { HarnessName } from "./harnesses.ts";
import { AccountId } from "./ids.ts";
import { companionWordsOf, markedWordOf } from "./marks.ts";

// A model the owner asks with `@` (thread-messaging, Mentioning a Companion with @; CHG-0781): the choices the `@` menu
// lists, and the token a chosen one is written as in the message.

/** At most this many Companions answer one message; a mention past it stays plain text. */
export const maxCompanionMentions = 5;

/** One model of a signed-in account the `@` menu offers: the thread's harness, account, and model, with the names the owner reads. */
export const CompanionChoice = Schema.Struct({
  /** The provider account, or null for the harness's own sign-in on this computer. */
  accountId: Schema.NullOr(AccountId),
  /** The account's label as Settings shows it. */
  accountLabel: Schema.String,
  harness: HarnessName,
  /** The model's identifier, as the harness takes it. */
  model: Schema.String,
  /** The model as the harness names it for the owner. */
  modelLabel: Schema.String,
});
export type CompanionChoice = typeof CompanionChoice.Type;

/** A Companion as a message holds it: its harness, account (null for the harness's own sign-in), and model. */
export type CompanionReference = {
  readonly accountId: string | null;
  readonly harness: string;
  readonly model: string;
};

/** The model written so that only letters, digits, `_`, `-` and `%XX` remain: `encodeURIComponent` also leaves `.!~*'()`. */
const encodedModelOf = (model: string) =>
  encodeURIComponent(model).replace(
    /[.!~*'()]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

const decodedModelOf = (encoded: string): string | null => {
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
};

/** The token a Companion is written as: `@companion:<harness>:<account or ->:<model>`; one word, with the ids in it. */
export const companionTokenOf = (reference: CompanionReference) =>
  markedWordOf(
    "companion",
    `companion:${reference.harness}:${reference.accountId ?? "-"}:${encodedModelOf(reference.model)}`,
  );

/** The Companion a word stands for, without its `@`, or null for any other word. */
export const companionReferenceOf = (path: string): CompanionReference | null => {
  const [head, harness, account, encoded] = path.split(":");
  if (head !== "companion" || harness === undefined || account === undefined || encoded === undefined) return null;
  const model = decodedModelOf(encoded);
  return model === null || model === "" ? null : { accountId: account === "-" ? null : account, harness, model };
};

/** Where a Companion's token sits in a message, and whom it names. */
export type CompanionToken = CompanionReference & { readonly end: number; readonly start: number };

/**
 * The Companions a message names, in the order of their tokens, each once and no more than `maxCompanionMentions`: a
 * token past the limit, a repeated one, and a word that names no Companion stay plain text.
 */
export const companionTokensOf = (text: string): ReadonlyArray<CompanionToken> => {
  const seen = new Set<string>();
  return companionWordsOf(text)
    .flatMap((word) => {
      const reference = companionReferenceOf(word.path);
      return reference === null ? [] : [{ ...reference, end: word.end, start: word.start }];
    })
    .filter((token) => {
      const key = `${token.harness}:${token.accountId ?? "-"}:${token.model}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxCompanionMentions);
};

/** The owner's words with the Companion tokens taken out, spaces tidied, for the model that answers them. */
export const withoutCompanionTokens = (text: string) =>
  companionWordsOf(text)
    .toReversed()
    .reduce((current, word) => `${current.slice(0, word.start)}${current.slice(word.end)}`, text)
    .replace(/[ \t]{2,}/g, " ")
    .trim();
