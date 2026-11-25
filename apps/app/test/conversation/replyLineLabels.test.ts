import { MessageId, MissionId, type ThreadAnchor, ThreadId } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import { findNewlyAnchoredQuest, replyCountLabelOf } from "../../src/conversation/replyLineLabels";

describe("compact reply line labels", () => {
  it("shows Opening… while a new thread has no replies yet and is underway", () => {
    expect(replyCountLabelOf(0, "Underway")).toBe("Opening…");
    expect(replyCountLabelOf(undefined, "Underway")).toBe("Opening…");
  });

  it("shows nothing when an idle thread has zero replies", () => {
    expect(replyCountLabelOf(0, "Resting")).toBeNull();
    expect(replyCountLabelOf(undefined, "Resting")).toBeNull();
  });

  it("formats singular and plural reply counts", () => {
    expect(replyCountLabelOf(1, "Resting")).toBe("1 reply");
    expect(replyCountLabelOf(4, "Underway")).toBe("4 replies");
  });
});

describe("auto-opening newly anchored channel quests", () => {
  const anchorOf = (threadId: string, missionId: string): ThreadAnchor => ({
    messageId: MessageId.make("m1"),
    missionId: MissionId.make(missionId),
    threadId: ThreadId.make(threadId),
    title: "Quest",
  });

  it("returns null when every anchor was already seen", () => {
    const existing = anchorOf("t1", "q1");
    expect(findNewlyAnchoredQuest([existing], new Set([existing.threadId]))).toBeNull();
  });

  it("returns the first unseen anchor when a channel Companion opens a quest", () => {
    const first = anchorOf("t1", "q1");
    const second = anchorOf("t2", "q2");
    expect(findNewlyAnchoredQuest([first, second], new Set([first.threadId]))).toEqual(second);
  });
});
