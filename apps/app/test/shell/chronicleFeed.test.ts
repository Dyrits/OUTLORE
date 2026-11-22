import { type ChronicleItem, ThreadId } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import {
  attentionOf,
  chronicleTitleOf,
  conversationsOf,
  historyOf,
  needsAttentionOf,
  unreadCountOf,
  urgencyOf,
} from "../../src/shell/chronicleFeed";

const now = new Date(2026, 10, 20, 15).getTime();
const hour = 60 * 60 * 1000;

/** One entry of the feed, complete as the contract reads it; every field the tests do not place holds its default. */
const entry = (
  id: string,
  kind: ChronicleItem["kind"],
  at: number,
  over: Partial<ChronicleItem> = {},
): ChronicleItem => ({
  at,
  count: 1,
  id,
  isUnread: false,
  kind,
  messageId: null,
  missionId: null,
  questionId: null,
  realmId: null,
  threadId: null,
  title: id,
  ...over,
});

describe("the Chronicle's feed", () => {
  it("puts failures before requests, unread replies last, and each latest first, leaving routine events out", () => {
    const items = [
      entry("old request", "Waiting", now - 5 * hour),
      entry("started", "QuestOpened", now - hour),
      entry("new request", "Waiting", now - hour),
      entry("old failure", "Failed", now - 9 * hour),
      entry("new failure", "Failed", now - 2 * hour),
      entry("old replies", "Replies", now - 8 * hour, { count: 3, isUnread: true }),
      entry("new replies", "Replies", now - 20, { isUnread: true }),
    ];
    expect(attentionOf(items).map((item) => item.id)).toEqual([
      "new failure",
      "old failure",
      "new request",
      "old request",
      "new replies",
      "old replies",
    ]);
  });

  it("keeps a read request needing attention, and counts only what is unread", () => {
    const items = [
      entry("unread request", "Waiting", now - hour, { isUnread: true, threadId: ThreadId.make("thread-1") }),
      entry("read request", "Waiting", now - 2 * hour, { threadId: ThreadId.make("thread-2") }),
      entry("failure", "Failed", now - 20),
      entry("replies", "Replies", now - 30, { isUnread: true }),
    ];
    expect(needsAttentionOf(items).map((item) => item.id)).toEqual(["failure", "unread request", "read request"]);
    expect(needsAttentionOf([entry("started", "QuestOpened", now)])).toEqual([]);
    // The Unread filter holds the unread request and the unread replies, each latest first, not the read failure.
    expect(unreadCountOf([...items, entry("routine", "Finished", now)])).toBe(2);
    expect(unreadCountOf([...items, entry("start", "RealmOpened", now)])).toBe(2);
  });

  it("groups attention updates by conversation, ranked by their most urgent entry", () => {
    const items = [
      entry("A: request", "Waiting", now - hour, { source: "Quest", threadId: ThreadId.make("a"), title: "Palace" }),
      entry("A: replies", "Replies", now - 30, {
        isUnread: true,
        source: "Quest",
        threadId: ThreadId.make("a"),
        title: "Palace",
      }),
      entry("B: failure", "Failed", now - 2 * hour, {
        source: "Errand",
        threadId: ThreadId.make("b"),
        title: "Palace",
      }),
    ];
    expect(conversationsOf(attentionOf(items)).map((group) => [group.heading, group.key])).toEqual([
      ["Errand · Palace", "b"],
      ["Quest · Palace", "a"],
    ]);
    const questA = conversationsOf(attentionOf(items)).find((group) => group.key === "a");
    expect(questA?.items.map((item) => item.id)).toEqual(["A: request", "A: replies"]);
  });

  it("labels older events whose type is clear from their data", () => {
    expect(chronicleTitleOf(entry("Palace", "RealmOpened", now))).toBe("Realm · Palace");
    expect(chronicleTitleOf(entry("Hello", "QuestOpened", now))).toBe("Quest · Hello");
    expect(chronicleTitleOf(entry("Hello", "Replies", now, { threadId: ThreadId.make("thread") }))).toBe("Hello");
  });

  it("groups routine events by day, latest first, leaving what needs the owner out", () => {
    const items = [
      entry("yesterday", "Finished", now - 20 * hour),
      entry("today early", "QuestOpened", now - 2 * hour),
      entry("moved", "Moved", now - 90 * 60 * 1000),
      entry("failure", "Failed", now - hour),
    ];
    expect(historyOf(items, now).map((day) => [day.heading, day.items.map((item) => item.id)])).toEqual([
      ["Today", ["moved", "today early"]],
      ["Yesterday", ["yesterday"]],
    ]);
  });

  it("does not reorder the list it was given", () => {
    const items = [entry("a", "Waiting", now - 2 * hour), entry("b", "Waiting", now - hour)];
    attentionOf(items);
    needsAttentionOf(items);
    conversationsOf(items);
    historyOf(items, now);
    expect(items.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("tells each kind's urgency", () => {
    expect(urgencyOf(entry("x", "Failed", now))).toBe("Failure");
    expect(urgencyOf(entry("x", "Waiting", now))).toBe("Request");
    expect(urgencyOf(entry("x", "Replies", now, { isUnread: true }))).toBe("Unread");
    expect(urgencyOf(entry("x", "Moved", now))).toBe("Routine");
    expect(urgencyOf(entry("x", "RealmOpened", now))).toBe("Routine");
  });
});
