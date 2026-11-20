import type { ChronicleItem } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import { attentionOf, historyOf, urgencyOf } from "../../src/shell/chronicleFeed";

const now = new Date(2026, 10, 20, 15).getTime();
const hour = 60 * 60 * 1000;

const entry = (id: string, kind: ChronicleItem["kind"], at: number): ChronicleItem =>
  ({ at, id, kind, missionId: null, realmId: null, threadId: null, title: id }) as ChronicleItem;

describe("the Chronicle's feed", () => {
  it("puts failures before requests and each latest first, leaving routine events out", () => {
    const items = [
      entry("old request", "Waiting", now - 5 * hour),
      entry("started", "QuestOpened", now - hour),
      entry("new request", "Waiting", now - hour),
      entry("old failure", "Failed", now - 9 * hour),
      entry("new failure", "Failed", now - 2 * hour),
    ];
    expect(attentionOf(items).map((item) => item.id)).toEqual([
      "new failure",
      "old failure",
      "new request",
      "old request",
    ]);
  });

  it("groups routine events by day, latest first, leaving what needs the owner out", () => {
    const items = [
      entry("yesterday", "Finished", now - 20 * hour),
      entry("today early", "QuestOpened", now - 2 * hour),
      entry("today late", "Archived", now - hour),
      entry("failure", "Failed", now - hour),
    ];
    expect(historyOf(items, now).map((day) => [day.heading, day.items.map((item) => item.id)])).toEqual([
      ["Today", ["today late", "today early"]],
      ["Yesterday", ["yesterday"]],
    ]);
  });

  it("does not reorder the list it was given", () => {
    const items = [entry("a", "Waiting", now - 2 * hour), entry("b", "Waiting", now - hour)];
    attentionOf(items);
    historyOf(items, now);
    expect(items.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("tells each kind's urgency", () => {
    expect(urgencyOf(entry("x", "Failed", now))).toBe("Failure");
    expect(urgencyOf(entry("x", "Waiting", now))).toBe("Request");
    expect(urgencyOf(entry("x", "RealmOpened", now))).toBe("Routine");
  });
});
