import type { Message, MessageId } from "@outlore/contracts";
import type { ReactNode } from "react";

/** What a card needs to be commented on. */
export type CommentableProps = {
  /** Who wrote the message. */
  about: Message["sender"];
  children: ReactNode;
  messageId: MessageId;
  /** The message's text, whose start a comment on the whole message quotes. */
  text: string;
};

/**
 * A card that can be commented on: only the web build does, since the phone has no pointer to hover with and no text to
 * select. Elsewhere a message is drawn as it is; its Reply is the icon under it.
 */
export function Commentable({ children }: CommentableProps) {
  return <>{children}</>;
}
