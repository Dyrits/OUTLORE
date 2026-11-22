import { describe, expect, it } from "vitest";
import { matchingMessages, nextMatchOf } from "../../src/conversation/conversationSearch";
import { entriesOf } from "../../src/conversation/entries";
import { detailOf } from "../fixtures/conversation";

const detail = detailOf([], "top");
const entries = entriesOf({
  ...detail,
  messages: detail.messages.map((message) => ({ ...message, text: `Path [SRC] ${message.text}` })),
});

describe("finding messages in a conversation", () => {
  it("returns literal case-insensitive matches in feed order, including the oldest message", () => {
    expect(matchingMessages(entries, "  [src] ").map(({ key, index }) => ({ index, key }))).toEqual([
      { index: 0, key: "second" },
      { index: 1, key: "first" },
    ]);
  });

  it("skips non-message entries without changing the feed index of a match", () => {
    expect(
      matchingMessages([...entries, { _tag: "LiveFooter", at: 99, key: "footer" }], "src").map(({ index }) => index),
    ).toEqual([1, 2]);
  });

  it("returns no matches for a blank or absent query", () => {
    expect(matchingMessages(entries, "  ")).toEqual([]);
    expect(matchingMessages(entries, "absent")).toEqual([]);
  });

  it("wraps navigation and starts at the newest hit when there is no selection", () => {
    const matches = matchingMessages(entries, "src");
    expect(nextMatchOf(matches, -1, 1)?.key).toBe("second");
    expect(nextMatchOf(matches, 0, -1)?.key).toBe("first");
    expect(nextMatchOf(matches, 1, 1)?.key).toBe("second");
    expect(nextMatchOf([], -1, 1)).toBeNull();
  });
});
