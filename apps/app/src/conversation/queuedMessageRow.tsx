import type { Message, MessageId } from "@outlore/contracts";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { messageOf } from "../foundation/client";
import { styles as shared } from "../foundation/styles";
import { colors } from "../foundation/theme";
import { EditPencilIcon, InterruptIcon, SteerIcon, TrashIcon } from "../ui/composerIcons";
import { queuedMessageStyles as local } from "./queuedMessageStyles";
import { canModifyPendingMessage, isSteeredMessage, rowPreviewOf } from "./queuedMessages";

/** One queued message row with inline edit, delete, steer toggle, and interrupt actions. */
export function QueuedMessageRow({
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
