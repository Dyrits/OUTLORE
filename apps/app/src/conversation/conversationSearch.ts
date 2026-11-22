import { type Entry, newestFirstOf } from "./entries";

/** A matching message and its position in the inverted feed. */
export type MessageMatch = { key: string; index: number };

/** Searches the conversation's message text in the same order as its inverted feed. */
export function matchingMessages(entries: ReadonlyArray<Entry>, query: string): ReadonlyArray<MessageMatch> {
  const term = query.trim().toLowerCase();
  if (term === "") return [];
  return newestFirstOf(entries).flatMap((entry, index) =>
    entry._tag === "Message" && entry.message.text.toLowerCase().includes(term) ? [{ index, key: entry.key }] : [],
  );
}

/** Moves through matches in feed order, wrapping at either end. */
export function nextMatchOf(
  matches: ReadonlyArray<MessageMatch>,
  selected: number,
  direction: -1 | 1,
): MessageMatch | null {
  if (matches.length === 0) return null;
  const next = selected < 0 ? 0 : (selected + direction + matches.length) % matches.length;
  return matches[next] ?? null;
}
