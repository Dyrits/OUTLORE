import type { Message, MessageId } from "@outlore/contracts";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { ActionMenu } from "../ui/actionMenu";
import { useReplies } from "./replies";

/** What a card needs to be commented on. */
export type CommentableProps = {
  /** Who wrote the message. */
  about: Message["sender"];
  /** Whether the Reply button is offered on this message (suppressed on notices and parent-echoed child replies). */
  canReply?: boolean;
  children: ReactNode;
  messageId: MessageId;
  /** The message's text, whose start a comment on the whole message quotes. */
  text: string;
};

/**
 * A card that can be replied to on the phone: a small menu at its corner whose one action is Reply, since there is no
 * pointer to hover with and no text to select. Commenting needs the web build; elsewhere a message is drawn as it is.
 */
export function Commentable({ canReply = true, children, messageId, text }: CommentableProps) {
  const replies = useReplies();
  if (!canReply || replies === null) return <>{children}</>;
  return (
    <View style={local.card}>
      {children}
      <View style={local.corner}>
        <ActionMenu
          accessibilityLabel="Message actions"
          actions={[{ label: "Reply", onPress: () => replies.start({ id: messageId, text }) }]}
        />
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  card: { position: "relative" },
  corner: { position: "absolute", right: -4, top: -14, zIndex: 1 },
});
