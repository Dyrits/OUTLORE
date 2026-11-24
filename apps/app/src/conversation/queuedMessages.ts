import type { Message, MessageId } from "@outlore/contracts";
import { countedOf } from "../foundation/labels";

/** Whether a message is an owner message still waiting for a turn to take it in. */
export const isPendingOwnerMessage = (message: Message): boolean =>
  message.sender === "user" && message.isDelivered === false;

/** Pending owner messages in delivery order, oldest sequence first. */
export const pendingOwnerMessagesOf = (messages: ReadonlyArray<Message>): ReadonlyArray<Message> =>
  messages.filter(isPendingOwnerMessage).sort((current, next) => current.sequence - next.sequence);

/** Whether a pending owner message has been released to join the running turn. */
export const isSteeredMessage = (message: Message): boolean => isPendingOwnerMessage(message) && !message.isQueued;

/** Whether a pending owner message can still be edited or removed (only while queued, before steering or delivery). */
export const canModifyPendingMessage = (message: Message): boolean =>
  isPendingOwnerMessage(message) && message.isQueued;

/** The pending messages that Clear all removes: queued ones only, leaving steered ones untouched. */
export const clearableMessageIdsOf = (messages: ReadonlyArray<Message>): ReadonlyArray<MessageId> =>
  messages.filter(canModifyPendingMessage).map((message) => message.id);

/** The tray header summary of how many pending messages are queued and how many are steered. */
export const traySummaryOf = (messages: ReadonlyArray<Message>): string => {
  const steeredCount = messages.filter(isSteeredMessage).length;
  const queuedCount = messages.length - steeredCount;
  if (steeredCount === 0) return `${queuedCount} queued`;
  if (queuedCount === 0) return `${steeredCount} steered`;
  return `${queuedCount} queued · ${steeredCount} steered`;
};

/** One-line preview for a row in the stacked tray, falling back to its attachment count when the text is blank. */
export const rowPreviewOf = (message: Message): string => {
  const collapsed = message.text.replace(/\s+/g, " ").trim();
  if (collapsed !== "") return collapsed;
  if (message.attachments.length > 0) return countedOf(message.attachments.length, "attachment");
  return "(empty message)";
};
