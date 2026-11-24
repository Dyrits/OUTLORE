import { AttachmentId, type Message, MessageId, ThreadId } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import {
  canModifyPendingMessage,
  clearableMessageIdsOf,
  isSteeredMessage,
  pendingOwnerMessagesOf,
  rowPreviewOf,
  traySummaryOf,
} from "../../src/conversation/queuedMessages";

const ownerMessage = (overrides: Omit<Partial<Message>, "id"> & { id: string; sequence: number }): Message => ({
  attachments: [],
  fromMissionId: null,
  fromThreadId: null,
  fromTitle: null,
  harness: null,
  isDelivered: false,
  isQueued: true,
  isResult: false,
  model: null,
  replyToMessageId: null,
  sender: "user",
  sentAt: overrides.sequence * 1000,
  text: overrides.id,
  threadId: ThreadId.make("thread-1"),
  usage: null,
  ...overrides,
  id: MessageId.make(overrides.id),
});

describe("pending owner messages for the stacked tray", () => {
  it("selects undelivered owner messages in sequence order and ignores delivered or non-owner messages", () => {
    const messages = [
      ownerMessage({ id: "second", sequence: 3 }),
      ownerMessage({ id: "delivered", isDelivered: true, isQueued: false, sequence: 1 }),
      ownerMessage({ id: "reply", isDelivered: true, isQueued: false, sender: "agent", sequence: 2 }),
      ownerMessage({ id: "first", isQueued: false, sequence: 2 }),
    ];
    expect(pendingOwnerMessagesOf(messages).map((message) => message.id)).toEqual(["first", "second"]);
  });

  it("distinguishes queued and steered messages for editing, removal, and Clear all", () => {
    const queued = ownerMessage({ id: "queued", isQueued: true, sequence: 1 });
    const steered = ownerMessage({ id: "steered", isQueued: false, sequence: 2 });
    const delivered = ownerMessage({ id: "delivered", isDelivered: true, isQueued: false, sequence: 3 });

    expect(isSteeredMessage(queued)).toBe(false);
    expect(canModifyPendingMessage(queued)).toBe(true);

    expect(isSteeredMessage(steered)).toBe(true);
    expect(canModifyPendingMessage(steered)).toBe(false);

    expect(isSteeredMessage(delivered)).toBe(false);
    expect(canModifyPendingMessage(delivered)).toBe(false);

    expect(clearableMessageIdsOf([queued, steered, delivered])).toEqual([MessageId.make("queued")]);
  });

  it("summarizes queued and steered counts for the tray header", () => {
    const queued = ownerMessage({ id: "queued", isQueued: true, sequence: 1 });
    const steered = ownerMessage({ id: "steered", isQueued: false, sequence: 2 });

    expect(traySummaryOf([queued])).toBe("1 queued");
    expect(traySummaryOf([steered])).toBe("1 steered");
    expect(traySummaryOf([queued, steered])).toBe("1 queued · 1 steered");
  });

  it("builds a single-line row preview from text or attachment counts", () => {
    const multiline = ownerMessage({ id: "multi", sequence: 1, text: "First line\n\n  second line " });
    const imageOnly = ownerMessage({
      attachments: [
        { id: AttachmentId.make("att-1"), mediaType: "image/png", name: "shot.png", size: 120 },
        { id: AttachmentId.make("att-2"), mediaType: "image/png", name: "shot2.png", size: 140 },
      ],
      id: "images",
      sequence: 2,
      text: "   ",
    });
    const blank = ownerMessage({ id: "blank", sequence: 3, text: "" });

    expect(rowPreviewOf(multiline)).toBe("First line second line");
    expect(rowPreviewOf(imageOnly)).toBe("2 attachments");
    expect(rowPreviewOf(blank)).toBe("(empty message)");
  });
});
