import type { ChronicleItem } from "@outlore/contracts";
import { recencyHeadingOf } from "./questRecency";

/** What an entry says about its conversation, in the words the owner reads. */
export const chroniclePhrases = {
  Archived: "Quest archived",
  Failed: "Failed",
  Finished: "Quest finished",
  QuestOpened: "Quest started",
  RealmOpened: "Realm opened",
  Waiting: "Waiting for your answer",
} satisfies Record<ChronicleItem["kind"], string>;

/** How strongly an entry asks for the owner: a failure first, a waiting request next, routine events not at all. */
export const chronicleUrgencies = {
  Archived: "Routine",
  Failed: "Failure",
  Finished: "Routine",
  QuestOpened: "Routine",
  RealmOpened: "Routine",
  Waiting: "Request",
} as const satisfies Record<ChronicleItem["kind"], "Failure" | "Request" | "Routine">;

export type ChronicleUrgency = (typeof chronicleUrgencies)[ChronicleItem["kind"]];

export const urgencyOf = (item: ChronicleItem): ChronicleUrgency => chronicleUrgencies[item.kind];

const rank = { Failure: 0, Request: 1, Routine: 2 } as const satisfies Record<ChronicleUrgency, number>;

/** The entries that need the owner: failures first, then requests, each group latest first. */
export const attentionOf = (items: ReadonlyArray<ChronicleItem>): ReadonlyArray<ChronicleItem> =>
  items
    .filter((item) => urgencyOf(item) !== "Routine")
    .sort((current, next) => rank[urgencyOf(current)] - rank[urgencyOf(next)] || next.at - current.at);

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
