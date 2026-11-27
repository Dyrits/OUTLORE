import type { Message, MessageId } from "@outlore/contracts";

// A mentioned Companion's answer belongs under the owner's message it answers (thread-messaging, Mentioning a Companion
// with @; CHG-0785), not where it was written: the host flags it, and the reply anchor names the message.

/** Whether the host sent the message as a Companion's answer to a message of the conversation. */
export const isCompanionAnswer = (message: Message): boolean =>
  message.isCompanionAnswer === true && message.replyToMessageId != null;

/** The Companion answers under each message that is drawn, oldest first; an answer whose message is not drawn is left out. */
export const answersUnderOf = (
  messages: ReadonlyArray<Message>,
  isDrawn: (messageId: MessageId) => boolean,
): Map<MessageId, Array<Message>> => {
  const under = new Map<MessageId, Array<Message>>();
  for (const message of messages) {
    const tagged = message.replyToMessageId;
    if (!isCompanionAnswer(message) || tagged == null || !isDrawn(tagged)) continue;
    const existing = under.get(tagged);
    if (existing === undefined) under.set(tagged, [message]);
    else existing.push(message);
  }
  return under;
};
