import { Schema } from "effect";

// Words and parsing Chronicler's tools and its authorization questions share, so the owner reads one phrasing for one thing.

/** The text parsed as JSON: a success holding the value (JSON `null` is a value), or a failure when it is not JSON. */
export const parseJson = Schema.decodeUnknownExit(Schema.fromJsonString(Schema.Unknown));

/** The text cut to the length with an ellipsis, or whole when it fits. */
export const clip = (text: string, length: number) => (text.length <= length ? text : `${text.slice(0, length - 1)}…`);

/** A count of threads in words. */
export const threadsLineOf = (count: number) => (count === 1 ? "1 thread" : `${count} threads`);

/** Where a quest or a Ritual Chronicler made is, in the words it is told. */
export const placeOf = (realm: { readonly name: string } | null) =>
  realm === null ? "with no realm" : `in the realm ${realm.name}`;
