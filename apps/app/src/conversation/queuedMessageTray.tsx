import type { Message, MessageId } from "@outlore/contracts";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { messageOf } from "../foundation/client";
import { styles as shared } from "../foundation/styles";
import { colors } from "../foundation/theme";
import { ChevronIcon, QueueIcon } from "../ui/composerIcons";
import { QueuedMessageRow } from "./queuedMessageRow";
import { queuedMessageStyles as local } from "./queuedMessageStyles";
import { clearableMessageIdsOf, traySummaryOf } from "./queuedMessages";

/**
 * Stacked tray of pending owner messages above the composer (option B).
 * Each row is numbered in delivery order and offers Delete, Edit, a Steer toggle, and Interrupt.
 */
export function QueuedMessageTray({
  isInTurn,
  messages,
  onEdit,
  onInterrupt,
  onRemove,
  onSteer,
  onUnsteer,
}: {
  isInTurn: boolean;
  messages: ReadonlyArray<Message>;
  onEdit: (messageId: MessageId, text: string) => Promise<unknown>;
  onInterrupt: () => Promise<unknown>;
  onRemove: (messageId: MessageId) => Promise<unknown>;
  onSteer: (messageId: MessageId) => Promise<unknown>;
  onUnsteer: (messageId: MessageId) => Promise<unknown>;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [trayError, setTrayError] = useState<string | null>(null);
  if (messages.length === 0) return null;
  const clearableIds = clearableMessageIdsOf(messages);
  const clearAll = async () => {
    if (clearableIds.length === 0 || isClearing) return;
    setIsClearing(true);
    setTrayError(null);
    const errors: Array<string> = [];
    for (const messageId of clearableIds) {
      try {
        await onRemove(messageId);
      } catch (reason) {
        errors.push(messageOf(reason));
      }
    }
    if (errors.length > 0) setTrayError(errors[0] ?? null);
    setIsClearing(false);
  };
  return (
    <View style={local.tray}>
      <View style={local.header}>
        <Pressable
          accessibilityLabel={isCollapsed ? "Expand queued messages" : "Collapse queued messages"}
          accessibilityRole="button"
          accessibilityState={{ expanded: !isCollapsed }}
          onPress={() => setIsCollapsed((current) => !current)}
          style={local.headerToggle}
        >
          <ChevronIcon isExpanded={!isCollapsed} tint={colors.textMuted} />
          <QueueIcon tint={colors.textMuted} />
          <Text style={local.headerText}>{traySummaryOf(messages)}</Text>
        </Pressable>
        <View style={shared.flex} />
        {clearableIds.length > 0 && (
          <Pressable
            accessibilityLabel="Clear all queued messages"
            accessibilityRole="button"
            disabled={isClearing}
            onPress={() => void clearAll()}
          >
            <Text style={[local.clearAll, isClearing && local.disabled]}>Clear all</Text>
          </Pressable>
        )}
      </View>
      {trayError !== null && (
        <View style={local.trayError}>
          <Text accessibilityRole="alert" style={shared.error}>
            {trayError}
          </Text>
        </View>
      )}
      {!isCollapsed && (
        <ScrollView style={local.list}>
          {messages.map((message, index) => (
            <QueuedMessageRow
              isInTurn={isInTurn}
              key={message.id}
              message={message}
              onEdit={onEdit}
              onInterrupt={onInterrupt}
              onRemove={onRemove}
              onSteer={onSteer}
              onUnsteer={onUnsteer}
              position={index + 1}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
