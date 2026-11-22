import type { ChronicleItem } from "@outlore/contracts";
import { recencyHeadingOf } from "./questRecency";

/** Names the conversation with its source type when the host provides one. */
export const chronicleTitleOf = (item: ChronicleItem): string => {
  const source = item.source ?? (item.kind === "RealmOpened" ? "Realm" : item.threadId === null ? "Quest" : null);
  return source === null ? item.title : `${source} · ${item.title}`;
};

/** What an entry says about its conversation, in the words the owner reads. */
export const chroniclePhrases = {
  Archived: "Quest archived",
  Failed: "Failed",
  Finished: "Quest finished",
  Moved: "Quest moved",
  QuestOpened: "Quest started",
  RealmOpened: "Realm opened",
  Replies: "New replies",
  Waiting: "Waiting for your answer",
} satisfies Record<ChronicleItem["kind"], string>;

/** How strongly an entry asks for the owner: a failure first, an open request next, an unread reply last, routine not at all. */
export const chronicleUrgencies = {
  Archived: "Routine",
  Failed: "Failure",
  Finished: "Routine",
  Moved: "Routine",
  QuestOpened: "Routine",
  RealmOpened: "Routine",
  Replies: "Unread",
  Waiting: "Request",
} as const satisfies Record<ChronicleItem["kind"], "Failure" | "Request" | "Unread" | "Routine">;

export type ChronicleUrgency = (typeof chronicleUrgencies)[ChronicleItem["kind"]];

export const urgencyOf = (item: ChronicleItem): ChronicleUrgency => chronicleUrgencies[item.kind];

const rank = {
  Failure: 0,
  Request: 1,
  Routine: 3,
  Unread: 2,
} as const satisfies Record<ChronicleUrgency, number>;

const byUrgencyThenLatest = (current: ChronicleItem, next: ChronicleItem) =>
  rank[urgencyOf(current)] - rank[urgencyOf(next)] || next.at - current.at;

/** The entries that ask for the owner: failures first, open requests next, unread replies last, each latest first. */
export const attentionOf = (items: ReadonlyArray<ChronicleItem>): ReadonlyArray<ChronicleItem> =>
  items.filter((item) => urgencyOf(item) !== "Routine").sort(byUrgencyThenLatest);

/**
 * The entries that wait on the owner's answer or failed: a request read is not answered, so it stays here until it is
 * answered or withdrawn (CHG-0569).
 */
export const needsAttentionOf = (items: ReadonlyArray<ChronicleItem>): ReadonlyArray<ChronicleItem> =>
  items.filter((item) => urgencyOf(item) === "Failure" || urgencyOf(item) === "Request").sort(byUrgencyThenLatest);

/** The entries the owner has not read yet, latest first; reading clears an entry, an answer clears a request (CHG-0569). */
export const unreadOf = (items: ReadonlyArray<ChronicleItem>): ReadonlyArray<ChronicleItem> =>
  items.filter((item) => item.isUnread).sort((current, next) => next.at - current.at);

/** What the sidebar's Chronicle badge counts: the updates the owner has not read. */
export const unreadCountOf = (items: ReadonlyArray<ChronicleItem>): number => unreadOf(items).length;

/** The updates of one conversation, in the order the feed shows them. */
export type ChronicleConversation = {
  /** The source type and title of the conversation's first entry. */
  readonly heading: string;
  readonly items: ReadonlyArray<ChronicleItem>;
  readonly key: string;
};

/** The entries grouped by the conversation they belong to (CHG-0569): conversations ranked by their most urgent entry. */
export const conversationsOf = (items: ReadonlyArray<ChronicleItem>): ReadonlyArray<ChronicleConversation> => {
  const groups = new Map<string, { heading: string; items: ChronicleItem[] }>();
  for (const item of items) {
    const key = item.threadId ?? item.id;
    const group = groups.get(key);
    if (group === undefined) groups.set(key, { heading: chronicleTitleOf(item), items: [item] });
    else group.items.push(item);
  }
  return [...groups.entries()]
    .map(([key, group]) => ({ ...group, items: [...group.items].sort(byUrgencyThenLatest), key }))
    .sort((current, next) => byUrgencyThenLatest(current.items[0], next.items[0]));
};

/** A run of routine entries from the same stretch of time, under one heading. */
export type ChronicleDay = { readonly heading: string; readonly items: ReadonlyArray<ChronicleItem> };

/** The routine entries, latest first, under Today, Yesterday, This week and the months, as the quest pages group theirs. */
export const historyOf = (items: ReadonlyArray<ChronicleItem>, now: number): ReadonlyArray<ChronicleDay> => {
  const days: Array<{ heading: string; items: ChronicleItem[] }> = [];
  for (const item of [...items]
    .filter((each) => urgencyOf(each) === "Routine")
    .sort((current, next) => next.at - current.at)) {
    const heading = recencyHeadingOf(item.at, now);
    const last = days[days.length - 1];
    if (last?.heading === heading) last.items.push(item);
    else days.push({ heading, items: [item] });
  }
  return days;
};
