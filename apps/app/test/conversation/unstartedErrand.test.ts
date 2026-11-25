import { describe, expect, it } from "vitest";
import { isUnstartedErrand } from "../../src/conversation/unstartedErrand";

const threadOf = (parentId: string | null) => ({ parentId }) as Parameters<typeof isUnstartedErrand>[0];
const messageOf = (sender: "user" | "agent" | "thread" | "system") =>
  ({ sender }) as Parameters<typeof isUnstartedErrand>[1][number];

describe("an errand a Reply opened that has no message yet", () => {
  it("is an errand with no messages", () => {
    expect(isUnstartedErrand(threadOf("th_quest"), [])).toBe(true);
  });

  it("stays unstarted while it holds only notices", () => {
    expect(isUnstartedErrand(threadOf("th_quest"), [messageOf("system")])).toBe(true);
  });

  it("is started by the owner's first message", () => {
    expect(isUnstartedErrand(threadOf("th_quest"), [messageOf("user")])).toBe(false);
  });

  it("is started by an agent's message", () => {
    expect(isUnstartedErrand(threadOf("th_quest"), [messageOf("thread")])).toBe(false);
  });

  it("is never a quest, which has its own starting form", () => {
    expect(isUnstartedErrand(threadOf(null), [])).toBe(false);
  });
});
