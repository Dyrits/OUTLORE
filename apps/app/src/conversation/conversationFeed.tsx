import type { MissionDetail } from "@outlore/contracts";
import { FlatList, Pressable, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { EntryView } from "./conversationEntries";
import { ConversationFooter } from "./conversationFooter";
import type { Entry } from "./entries";
import type { useThreadConversation } from "./useThreadConversation";

type Navigation = Pick<
  Parameters<typeof EntryView>[0],
  "canOpenAside" | "channel" | "onOpenMission" | "onSelectThread"
>;
type Thread = MissionDetail["thread"];
type Conversation = ReturnType<typeof useThreadConversation>;

/** The conversation list and its inverted footer, with navigation supplied by the host. */
export function ConversationFeed({
  client,
  conversation,
  thread,
  workspacePath,
  ...navigation
}: Navigation & { client: ServiceClient; conversation: Conversation; thread: Thread; workspacePath: string | null }) {
  const footer = <ConversationFooter draft={conversation.draft} thread={thread} />;
  const hasPendingMessages = conversation.entries.some((entry) => entry._tag === "LiveFooter");
  return (
    <FlatList<Entry>
      {...conversation.followNewest.listPropsOf(
        <View>
          {!hasPendingMessages && footer}
          {conversation.terminal.panel}
        </View>,
      )}
      contentContainerStyle={styles.feed}
      keyboardShouldPersistTaps="handled"
      keyExtractor={(entry) => entry.key}
      renderItem={({ item }) =>
        item._tag === "LiveFooter" ? (
          footer
        ) : (
          <EntryView
            {...navigation}
            client={client}
            entry={item}
            harness={thread.harness}
            isInTurn={thread.actions.isInTurn}
            onInterrupt={conversation.interrupt}
            onSteer={conversation.steer}
            skills={conversation.skills}
            workspacePath={workspacePath}
          />
        )
      }
      style={styles.flex}
    />
  );
}

/** Explains a turn failure and offers Retry when the thread can take a turn. */
export function ConversationFailure({
  client,
  conversation,
  linkStyle,
  thread,
}: {
  client: ServiceClient;
  conversation: Conversation;
  linkStyle?: Parameters<typeof Text>[0]["style"];
  thread: Thread;
}) {
  if (thread.failure == null) return null;
  const isLink = linkStyle !== undefined;
  return (
    <View style={styles.failure}>
      <Text style={styles.error}>The last turn failed: {thread.failure}</Text>
      <Text style={styles.muted}>
        {isLink
          ? "Your next message retries it."
          : "Retry runs it again on the Companion chosen below; your next message retries it too."}
      </Text>
      {!thread.actions.isInTurn && thread.state !== "Stopped" && (
        <Pressable
          accessibilityRole="button"
          onPress={() => conversation.act(client.request({ _tag: "RetryThread", threadId: thread.id }))}
          style={isLink ? null : styles.button}
        >
          <Text style={linkStyle ?? styles.buttonText}>Retry</Text>
        </Pressable>
      )}
    </View>
  );
}
