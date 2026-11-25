import type { SendMessage, ThreadId } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import {
  conversationStateOf,
  footerOf,
  sendConversationMessage,
  workingRunnerOf,
} from "../../src/conversation/threadConversation";

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
  it("includes sendToParent on SendMessage when requested", async () => {
    const fake = setup();
    await sendConversationMessage({ ...fake.given, sendToParent: "FullContext" });
    expect(fake.requests[0]).toMatchObject({ sendToParent: "FullContext" });
  });
  it("explains what Send does in a running turn and for stopped threads", () => {
    expect(conversationStateOf("Underway", true, "Chronicler").placeholder).toContain("next turn");
    expect(conversationStateOf("Stopped", false, "this quest").placeholder).toContain("resume");
    expect(footerOf("", false)).toBe("empty");
    expect(footerOf("", true)).toBe("working");
    expect(footerOf("reply", true)).toBe("draft");
  });
  it("shows the runner of the running turn, not the one the owner picked during it", () => {
    const picked = { harness: "codex", model: "gpt-5" } as const;
    expect(workingRunnerOf({ ...picked, turnHarness: "claude", turnModel: "opus" })).toEqual({
      harness: "claude",
      model: "opus",
    });
    expect(workingRunnerOf({ ...picked, turnHarness: null, turnModel: null })).toEqual(picked);
    expect(workingRunnerOf({ ...picked, turnHarness: "claude", turnModel: null })).toEqual({
      harness: "claude",
      model: "default",
    });
  });
});
