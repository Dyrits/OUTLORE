import type { Message, MessageId } from "@outlore/contracts";

// A mentioned Companion's answer and any follow-up inside its frame belong under the frame's opening message
// (thread-messaging, Mentioning a Companion with @; CHG-0785, CHG-0786), not where each was written.

/** Whether the host sent the message as a Companion's answer to a message of the conversation. */
export const isCompanionAnswer = (message: Message): boolean =>
  message.isCompanionAnswer === true && (message.companionFrameId != null || message.replyToMessageId != null);

/** The opening message of the Companion frame `message` belongs to, or null when it is not inside a frame. */
export const frameParentOf = (message: Message): MessageId | null =>
  message.companionFrameId ?? (isCompanionAnswer(message) ? (message.replyToMessageId ?? null) : null);

/** The messages inside each drawn Companion frame, oldest first; messages whose opening message is not drawn are left out. */
export const answersUnderOf = (
  messages: ReadonlyArray<Message>,
  isDrawn: (messageId: MessageId) => boolean,
): Map<MessageId, Array<Message>> => {
  const under = new Map<MessageId, Array<Message>>();
  for (const message of messages) {
    const parent = frameParentOf(message);
    if (parent == null || !isDrawn(parent)) continue;
    const existing = under.get(parent);
    if (existing === undefined) under.set(parent, [message]);
    else existing.push(message);
  }
  return under;
};
