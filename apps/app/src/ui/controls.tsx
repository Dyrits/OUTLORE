import type { AttachmentId, Skill } from "@outlore/contracts";
import { type ReactNode, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { AttachButton } from "../attachments/attachButton";
import { AttachmentStrip } from "../attachments/attachmentViews";
import { useAttachments } from "../attachments/useAttachments";
import { DictationButton } from "../dictation/dictationButton";
import { useDictation } from "../dictation/useDictation";
import { messageOf, type ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { ChipEditor } from "./chipEditor";
import type { ChipEditorHandle } from "./chipEditorTypes";
import { SendArrow, SideQuestBranch, StopSquare } from "./composerIcons";
import { ComposerMenu } from "./composerMenu";
import type { MenuRow } from "./mentionMenu";
import { forgetSentText, isSentText, rememberUnsentText } from "./unsentText";
import { useComposerList } from "./useComposerList";
import { useDraftText } from "./useDraftText";

// The switch and the state marks are drawn in their own file; they are re-exported so other folders keep importing them from here.
export { StateBadge, StateIndicator, Toggle } from "./stateMarks";

/**
 * A message box that keeps the text until the service accepts it, sent with Enter or the arrow button. While a thread runs, the send button queues
 * the message and Stop replaces it when the box is empty; a queued message is steered or interrupted from its card (CHG-0514).
 */
export function Composer({
  draftKey,
  placeholder,
  onSend,
  alternative,
  attachments: attachable,
  onStop,
  onChangeText,
  accessory,
  onOpenSideQuest,
  skills = [],
  mentions,
  dictation: dictable,
  onBang,
  hasContent = false,
}: {
  /**
   * The box's own name. Text left unsent is kept under it while the screen is closed and comes back when it opens;
   * a box without one starts empty. Boxes of different screens need different names, and the box must be keyed by it.
   */
  draftKey?: string;
  placeholder: string;
  onSend: (text: string, attachmentIds: ReadonlyArray<AttachmentId>) => Promise<unknown>;
  alternative?: {
    readonly label: string;
    readonly onSend: (text: string, attachmentIds: ReadonlyArray<AttachmentId>) => Promise<unknown>;
  };
  /**
   * Images can be attached to the message (message-attachments): pasted, dropped, or chosen with the file button, and uploaded through
   * the client. `refusal` is why the Companion about to read the message cannot read images, or null; the message is then not sent.
   */
  attachments?: { readonly client: ServiceClient; readonly refusal: string | null };
  /**
   * Stops the thread. While it is given and the box holds nothing to send, the send button turns into a stop button;
   * typing something turns it back into the arrow.
   */
  onStop?: () => Promise<unknown>;
  /** Hears the text as it is typed and cleared, such as to preview what it would send. */
  onChangeText?: (text: string) => void;
  /** Controls shown under the box, at its right, such as pickers for what the message runs on. */
  accessory?: ReactNode;
  /** Opens an errand from the icon after the send button. */
  onOpenSideQuest?: () => void;
  /** The skills a slash offers; a slash-name matching one is highlighted. */
  skills?: ReadonlyArray<Skill>;
  /**
   * What an `@` names: quests, errands, and realms, and the files and folders of the workspace when it has a path
   * (CHG-0181). Without it, an `@` offers nothing.
   */
  mentions?: { readonly client: ServiceClient; readonly workspacePath: string | null };
  /** A microphone that puts spoken words in the box, transcribed by the host (voice-input); shown only where it can record. */
  dictation?: { readonly client: ServiceClient };
  onBang?: () => void;
  /** Whether an attached terminal can be sent without typed text. */
  hasContent?: boolean;
}) {
  const editor = useRef<ChipEditorHandle>(null);
  // What the box left unsent, read once as it opens; what the owner types afterwards is the box's own.
  const { latestText, left } = useDraftText(draftKey, editor);
  const [text, setText] = useState(left);
  const [isSending, setIsSending] = useState(false);
  const files = useAttachments(attachable?.client ?? null);
  // A message may hold images alone.
  const isEmpty = text.trim() === "" && files.ids.length === 0 && !hasContent;
  const refusal = files.ids.length > 0 ? (attachable?.refusal ?? null) : null;
  const cannotSend = isEmpty || files.isBusy || refusal !== null;
  const [error, setError] = useState<string | null>(null);
  const list = useComposerList(skills, mentions);
  const dictation = useDictation(dictable?.client ?? null, (spoken) => editor.current?.insertText(spoken));
  const choose = (row: MenuRow) => {
    const chip = list.choose(row);
    if (chip !== null) editor.current?.insertChip(chip);
  };
  const send = async (handler: (text: string, attachmentIds: ReadonlyArray<AttachmentId>) => Promise<unknown>) => {
    if (cannotSend || isSending) return;
    setIsSending(true);
    const sent = text.trim();
    const sentIds = files.ids;
    try {
      await handler(sent, sentIds);
      // Text typed while the send was pending was never sent, so it stays; the box may have closed meanwhile.
      if (isSentText(latestText.current, sent)) editor.current?.clear();
      if (draftKey !== undefined) forgetSentText(draftKey, sent);
      files.clear(sentIds);
      setError(null);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setIsSending(false);
    }
  };
  const interrupt = (handler: () => Promise<unknown>) =>
    handler().then(
      () => setError(null),
      (reason) => setError(messageOf(reason)),
    );
  return (
    <View style={styles.composer}>
      {list.rows.length > 0 && <ComposerMenu highlighted={list.highlighted} onChoose={choose} rows={list.rows} />}
      {attachable !== undefined && <AttachmentStrip files={files.files} onRemove={files.remove} />}
      <View style={styles.composerPill}>
        {attachable !== undefined && <AttachButton onFiles={files.attach} />}
        <View style={styles.composerField}>
          <ChipEditor
            {...(onBang === undefined ? {} : { onBang })}
            {...(attachable === undefined ? {} : { onFiles: files.attach })}
            initialText={left}
            onChange={(value, typed) => {
              latestText.current = value;
              setText(value);
              if (draftKey !== undefined) rememberUnsentText(draftKey, value);
              list.onTyped(typed);
              onChangeText?.(value);
            }}
            onKeyDown={(key) => {
              const pressed = list.onKey(key);
              if (pressed.chip !== null) editor.current?.insertChip(pressed.chip);
              if (pressed.handled) return true;
              if (key.key === "Enter" && !key.shiftKey) {
                void send(onSend);
                return true;
              }
              return false;
            }}
            placeholder={placeholder}
            ref={editor}
          />
        </View>
        <View style={styles.composerActions}>
          {dictation.isAvailable && (
            <DictationButton onCancel={dictation.cancel} onPress={dictation.press} phase={dictation.phase} />
          )}
          {alternative !== undefined && (
            <Pressable
              disabled={isSending || cannotSend}
              onPress={() => send(alternative.onSend)}
              style={[styles.buttonSecondary, (isSending || cannotSend) && styles.buttonDisabled]}
            >
              <Text style={styles.buttonSecondaryText}>{alternative.label}</Text>
            </Pressable>
          )}
          {onStop !== undefined && isEmpty ? (
            <Pressable
              accessibilityLabel="Stop"
              accessibilityRole="button"
              onPress={() => interrupt(onStop)}
              style={styles.sendButton}
            >
              <StopSquare />
            </Pressable>
          ) : (
            <Pressable
              accessibilityLabel="Send"
              accessibilityRole="button"
              disabled={isSending || cannotSend}
              onPress={() => send(onSend)}
              style={[styles.sendButton, (isSending || cannotSend) && styles.buttonDisabled]}
            >
              <SendArrow />
            </Pressable>
          )}
          {onOpenSideQuest !== undefined && (
            <Pressable
              accessibilityLabel="Open errand"
              accessibilityRole="button"
              onPress={onOpenSideQuest}
              style={styles.buttonSecondary}
            >
              <SideQuestBranch />
            </Pressable>
          )}
        </View>
      </View>
      {accessory !== undefined && <View style={styles.composerAccessory}>{accessory}</View>}
      {refusal !== null && <Text style={styles.error}>{refusal}</Text>}
      {files.error !== null && <Text style={styles.error}>{files.error}</Text>}
      {dictation.error !== null && <Text style={styles.error}>{dictation.error}</Text>}
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}
