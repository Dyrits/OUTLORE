import type { SendMessage, ThreadId } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import { conversationStateOf, footerOf, sendConversationMessage } from "../../src/conversation/threadConversation";

const setup = (isRefused = false, isChronicler = false) => {
  const events: string[] = [];
  const requests: Array<typeof SendMessage.Type> = [];
  const given = {
    attachmentIds: [],
    clearComments: () => {
      events.push("clear");
    },
    client: {
      request: async (request: typeof SendMessage.Type) => {
        events.push("send");
        requests.push(request);
        if (isRefused) throw new Error("refused");
        return null;
      },
    },
    comments: [
      {
        about: "agent" as const,
        id: "comment",
        isSelection: false,
        messageId: "message",
        note: "explain",
        quote: "passage",
      },
    ],
    delivery: "Queue" as const,
    follow: () => {
      events.push("follow");
    },
    options: { isChronicler, realmPath: "/realm", viewing: null },
    prepare: async (text: string) => {
      events.push("prepare");
      return `${text} terminal`;
    },
    sent: () => {
      events.push("sent");
    },
    text: "hello",
    threadId: "thread" as ThreadId,
  };
  return { events, given, requests };
};

describe("sending a conversation message", () => {
  it("prepares the terminal, attaches comments and clears content after acceptance", async () => {
    const fake = setup();
    await sendConversationMessage(fake.given);
    expect(fake.events).toEqual(["prepare", "follow", "send", "clear", "sent"]);
    expect(fake.requests[0]).toMatchObject({ delivery: "Queue", text: expect.stringContaining("hello terminal") });
    expect(fake.requests[0]?.text).toContain("<comments>");
    expect(fake.requests[0]).not.toHaveProperty("realmPath");
  });
  it("keeps comments and terminal content when the service refuses", async () => {
    const fake = setup(true);
    await expect(sendConversationMessage(fake.given)).rejects.toThrow("refused");
    expect(fake.events).toEqual(["prepare", "follow", "send"]);
  });
  it("sends Chronicler's realm without quest-only comments", async () => {
    const fake = setup(false, true);
    await sendConversationMessage(fake.given);
    expect(fake.requests[0]).toMatchObject({ realmPath: "/realm", text: "hello terminal" });
  });
  it("offers the opposite delivery only for a running turn and explains stopped messages", () => {
    expect(conversationStateOf("Idle", false, "Queue", "Chronicler").delivery).toBeNull();
    expect(conversationStateOf("Running", true, "Queue", "Chronicler")).toMatchObject({
      delivery: "Queue",
      other: "Steer",
    });
    expect(conversationStateOf("Running", true, "Steer", "this quest").other).toBe("Queue");
    expect(conversationStateOf("Stopped", false, "Steer", "this quest").placeholder).toContain("resume");
    expect(footerOf("", false)).toBe("empty");
    expect(footerOf("", true)).toBe("working");
    expect(footerOf("reply", true)).toBe("draft");
  });
});
