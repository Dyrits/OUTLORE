import type { Message, MessageId } from "@outlore/contracts";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { messageOf } from "../foundation/client";
import { styles as shared } from "../foundation/styles";
import { colors, fontSizes, fonts, outline, radii, round } from "../foundation/theme";
import { ChevronIcon, EditPencilIcon, InterruptIcon, QueueIcon, SteerIcon, TrashIcon } from "../ui/composerIcons";
import {
  canModifyPendingMessage,
  clearableMessageIdsOf,
  isSteeredMessage,
  rowPreviewOf,
  traySummaryOf,
} from "./queuedMessages";

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

function QueuedMessageRow({
  isInTurn,
  message,
  onEdit,
  onInterrupt,
  onRemove,
  onSteer,
  onUnsteer,
  position,
}: {
  isInTurn: boolean;
  message: Message;
  onEdit: (messageId: MessageId, text: string) => Promise<unknown>;
  onInterrupt: () => Promise<unknown>;
  onRemove: (messageId: MessageId) => Promise<unknown>;
  onSteer: (messageId: MessageId) => Promise<unknown>;
  onUnsteer: (messageId: MessageId) => Promise<unknown>;
  position: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isSteered = isSteeredMessage(message);
  const canModify = canModifyPendingMessage(message);
  const act = async (request: Promise<unknown>, shouldCloseDraft = false) => {
    setIsSaving(true);
    setError(null);
    try {
      await request;
      if (shouldCloseDraft) setDraft(null);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <View style={local.row}>
      {draft === null ? (
        <View style={local.rowLine}>
          <View style={[local.numberBadge, isSteered && local.numberBadgeSteered]}>
            <Text style={[local.numberText, isSteered && local.numberTextSteered]}>{position}</Text>
          </View>
          <Text numberOfLines={1} style={local.preview}>
            {rowPreviewOf(message)}
          </Text>
          <View style={local.actions}>
            <Pressable
              accessibilityLabel="Remove queued message"
              accessibilityRole="button"
              accessibilityState={{ disabled: isSaving || !canModify }}
              disabled={isSaving || !canModify}
              onPress={() => void act(onRemove(message.id))}
              style={({ pressed }) => [
                local.iconButton,
                pressed && canModify && local.iconButtonHover,
                (!canModify || isSaving) && local.disabled,
              ]}
            >
              <TrashIcon tint={canModify ? colors.textMuted : colors.textDim} />
            </Pressable>
            <Pressable
              accessibilityLabel="Edit queued message"
              accessibilityRole="button"
              accessibilityState={{ disabled: isSaving || !canModify }}
              disabled={isSaving || !canModify}
              onPress={() => {
                setError(null);
                setDraft(message.text);
              }}
              style={({ pressed }) => [
                local.iconButton,
                pressed && canModify && local.iconButtonHover,
                (!canModify || isSaving) && local.disabled,
              ]}
            >
              <EditPencilIcon tint={canModify ? colors.textMuted : colors.textDim} />
            </Pressable>
            {isInTurn && (
              <>
                <Pressable
                  accessibilityLabel={isSteered ? "Unsteer message" : "Steer message"}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: isSteered, disabled: isSaving }}
                  disabled={isSaving}
                  onPress={() => void act(isSteered ? onUnsteer(message.id) : onSteer(message.id))}
                  style={({ pressed }) => [
                    local.actionButton,
                    isSteered && local.steerActive,
                    pressed && !isSteered && local.actionButtonHover,
                    isSaving && local.disabled,
                  ]}
                >
                  <SteerIcon tint={isSteered ? colors.accentText : colors.textSecondary} />
                  <Text style={[local.actionText, isSteered && local.steerActiveText]}>Steer</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="Interrupt and send now"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isSaving }}
                  disabled={isSaving}
                  onPress={() => void act(onInterrupt())}
                  style={({ pressed }) => [
                    local.actionButton,
                    pressed && local.actionButtonHover,
                    isSaving && local.disabled,
                  ]}
                >
                  <InterruptIcon tint={colors.text} />
                  <Text style={local.actionText}>Interrupt</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      ) : (
        <View style={local.editor}>
          <TextInput
            accessibilityLabel="Queued message text"
            autoFocus
            editable={!isSaving}
            multiline
            onChangeText={(text) => {
              setDraft(text);
              setError(null);
            }}
            style={shared.input}
            value={draft}
          />
          <View style={local.editorActions}>
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={() => {
                setDraft(null);
                setError(null);
              }}
            >
              <Text style={shared.link}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={() => void act(onEdit(message.id, draft), true)}
              style={[shared.buttonSecondary, isSaving && shared.buttonDisabled]}
            >
              <Text style={shared.buttonSecondaryText}>Save changes</Text>
            </Pressable>
          </View>
        </View>
      )}
      {error !== null && (
        <Text accessibilityRole="alert" style={shared.error}>
          {error}
        </Text>
      )}
    </View>
  );
}

const local = StyleSheet.create({
  actionButton: {
    alignItems: "center",
    backgroundColor: colors.control,
    borderColor: colors.edge,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionButtonHover: { backgroundColor: colors.controlHover },
  actions: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6 },
  actionText: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.sm, fontWeight: "500" },
  clearAll: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm, fontWeight: "500" },
  disabled: { opacity: 0.38 },
  editor: { gap: 8 },
  editorActions: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "flex-end" },
  header: { alignItems: "center", flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 6 },
  headerText: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm, fontWeight: "500" },
  headerToggle: { alignItems: "center", flexDirection: "row", gap: 6 },
  iconButton: { alignItems: "center", borderRadius: radii.sm, justifyContent: "center", padding: 5 },
  iconButtonHover: { backgroundColor: colors.controlHover },
  list: { maxHeight: 220 },
  numberBadge: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    height: 18,
    justifyContent: "center",
    width: 18,
  },
  numberBadgeSteered: { backgroundColor: colors.accent },
  numberText: { color: colors.accentText, fontFamily: fonts.sans, fontSize: fontSizes.xs, fontWeight: "600" },
  numberTextSteered: { color: colors.onAccent },
  preview: { color: colors.text, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.md, minWidth: 120 },
  row: {
    backgroundColor: colors.canvas,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rowLine: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  steerActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  steerActiveText: { color: colors.accentText },
  tray: { ...outline, ...round, backgroundColor: colors.surface, marginBottom: 6, overflow: "hidden" },
  trayError: { paddingBottom: 6, paddingHorizontal: 12 },
});
