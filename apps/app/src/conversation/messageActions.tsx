import type { MessageId } from "@outlore/contracts";
import { createContext, useContext } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "../foundation/theme";
import { CopyButton } from "../ui/copyButton";
import { useReplies } from "./replies";

/**
 * Whether a message's action icons are shown: the web card says so while the pointer is on it or it has focus; where
 * nothing hovers (the phone, or a card nothing wraps) they stay shown.
 */
const MessageHoverContext = createContext(true);
export const MessageHoverProvider = MessageHoverContext.Provider;

/** A small icon button that starts a Reply to the message, drawn as a corner arrow beside the Copy icon. */
function ReplyButton({ messageId, text }: { messageId: MessageId; text: string }) {
  const replies = useReplies();
  if (replies === null) return null;
  return (
    <Pressable
      accessibilityLabel="Reply to this message"
      accessibilityRole="button"
      hitSlop={6}
      onPress={() => replies.start({ id: messageId, text })}
    >
      <Svg
        fill="none"
        height={16}
        stroke={colors.textMuted}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        viewBox="0 0 24 24"
        width={16}
      >
        <Path d="M9 14L4 9l5-5" />
        <Path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
      </Svg>
    </Pressable>
  );
}

/**
 * The icons at a message's bottom right: Reply, where a Reply starts something, and Copy. Unseen until the pointer is
 * on the message, and then out of the pointer's way. A draft, which is not a message yet, passes no `messageId` and
 * gets no Reply.
 */
export function MessageActions({
  canReply = true,
  copyLabel,
  messageId,
  text,
}: {
  canReply?: boolean;
  copyLabel: string;
  messageId: MessageId | null;
  text: string;
}) {
  const isShown = useContext(MessageHoverContext);
  return (
    <View pointerEvents={isShown ? "auto" : "none"} style={[local.actions, !isShown && local.hidden]}>
      {canReply && messageId !== null && <ReplyButton messageId={messageId} text={text} />}
      <CopyButton label={copyLabel} text={text} />
    </View>
  );
}

const local = StyleSheet.create({
  actions: { alignItems: "center", flexDirection: "row", gap: 10, marginLeft: "auto" },
  hidden: { opacity: 0 },
});
