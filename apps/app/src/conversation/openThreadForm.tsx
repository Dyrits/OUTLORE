import type { AttachmentId, BackupCompanion, MessageId, ModelChoice, ThreadId, ThreadView } from "@outlore/contracts";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { imageRefusalOf } from "../attachments/attachmentRules";
import { BackupsEditor } from "../editors/backupsEditor";
import { presetsOf } from "../editors/presets";
import { type Runner, RunnerPickers, useHarnesses } from "../editors/runners";
import { newRequestId, type ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { useSkills } from "../foundation/useSkills";
import { LoreScreen } from "../lore/lore";
import { Composer } from "../ui/controls";
import { StartingContextWarning } from "./startingContextWarning";

/**
 * Opens a thread beneath the selected one: its model and effort start as the parent's and can be changed until the first message is sent (thread-tree, Opening a thread).
 * Past a quarter of the model's context window it warns, with a larger model, trimming lore, or starting anyway.
 */
export function OpenThreadForm({
  anchorMessageId = null,
  client,
  companions,
  onCancel,
  onOpened,
  parent,
}: {
  anchorMessageId?: MessageId | null;
  client: ServiceClient;
  companions?: { isSelected: boolean; onOpen: () => void };
  onCancel?: () => void;
  onOpened: (threadId: ThreadId) => void;
  parent: ThreadView;
}) {
  const { data: harnesses } = useHarnesses(client);
  const { data: settings } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  const { data: parentPanel } = useServiceQuery(
    client,
    { _tag: "ReadThreadPanel", threadId: parent.id },
    `parent:${parent.id}`,
  );
  const [backups, setBackups] = useState<ReadonlyArray<BackupCompanion> | null>(null);
  const skills = useSkills(client, parent.workspace?.path ?? null);
  const [runner, setRunner] = useState<Runner>({
    accountId: parent.accountId,
    effort: parent.effort,
    harness: parent.harness,
    model: parent.model,
  });
  const { model } = runner;
  const setModel = (chosen: ModelChoice) => setRunner({ ...runner, model: chosen });
  const [isTrimming, setIsTrimming] = useState(false);
  const request = useSettledText();
  const { data: context } = useServiceQuery(
    client,
    {
      _tag: "PreviewStartingContext",
      harness: runner.harness,
      model,
      parentThreadId: parent.id,
      text: request.settled,
    },
    `starting:${parent.id}:${runner.harness}:${model}:${request.settled}`,
  );
  const openWith = (shouldStartAnyway: boolean) => async (text: string, attachmentIds: ReadonlyArray<AttachmentId>) => {
    const opened = await client.request({
      _tag: "OpenThread",
      accountId: runner.accountId,
      ...(anchorMessageId === null ? {} : { anchorMessageId }),
      attachmentIds,
      ...(backups === null ? {} : { backups }),
      effort: runner.effort,
      harness: runner.harness,
      model,
      parentThreadId: parent.id,
      requestId: newRequestId(),
      shouldStartAnyway,
      text,
    });
    onOpened(opened.threadId);
  };
  const isOverWarning = context?.isOverWarning === true;
  const picker = (isFullPanel: boolean) => (
    <RunnerPickers
      client={client}
      // Offered once the parent's list is read, so an edit never starts from an empty list standing in for it.
      {...(parentPanel === null
        ? {}
        : {
            extra: (
              <BackupsEditor
                backups={backups ?? parentPanel.backups}
                harnesses={harnesses}
                isCompact={false}
                isFolded
                onChange={setBackups}
              />
            ),
          })}
      harnesses={harnesses}
      isCompact
      isFullPanel={isFullPanel}
      isTabOpen={companions?.isSelected === true}
      onChange={setRunner}
      onOpenTab={companions?.onOpen}
      presetChoice={
        settings === null
          ? null
          : {
              backups: backups ?? parentPanel?.backups ?? null,
              onOverwritePreset: (name, stack) =>
                client.request({ _tag: "ChangeCompanionPreset", edit: { _tag: "SetStack", name, stack } }),
              onPreset: (preset) => {
                setRunner(preset.runner);
                setBackups(preset.backups);
              },
              onSavePreset: (name, stack) =>
                client.request({ _tag: "ChangeCompanionPreset", edit: { _tag: "Add", name, stack } }),
              presets: presetsOf(settings.tiers, settings.companionPresets),
            }
      }
      value={runner}
    />
  );
  return (
    <View style={companions === undefined ? styles.pane : styles.flex}>
      {companions?.isSelected && (
        <>
          {picker(true)}
          {/* The composer holds the draft's compact picker and is hidden while the tab is open, so the tab carries its own. */}
          <View style={styles.composerAccessory}>{picker(false)}</View>
        </>
      )}
      <View
        style={
          companions?.isSelected
            ? { display: "none" }
            : [styles.pane, companions !== undefined && { marginTop: "auto" }]
        }
      >
        {onCancel !== undefined && (
          <View style={styles.header}>
            <Text numberOfLines={1} style={[styles.label, styles.flex]}>
              New errand beneath "{parent.title}"
            </Text>
            <Pressable accessibilityLabel="Cancel new errand" accessibilityRole="button" hitSlop={8} onPress={onCancel}>
              <Text style={styles.error}>✕</Text>
            </Pressable>
          </View>
        )}
        {context != null && isOverWarning && (
          <StartingContextWarning context={context} onChooseModel={setModel} onTrim={() => setIsTrimming(true)} />
        )}
        {isTrimming && (
          // The panel opens inside the form, so the request typed so far stays.
          <View style={styles.trimPanel}>
            <LoreScreen
              client={client}
              onBack={() => setIsTrimming(false)}
              threadId={parent.id}
              title={`Trim lore · ${parent.title}`}
            />
          </View>
        )}
        <Composer
          accessory={picker(false)}
          attachments={{ client, refusal: imageRefusalOf(harnesses, runner.harness, model) }}
          dictation={{ client }}
          mentions={{ client, workspacePath: parent.workspace?.path ?? null }}
          skills={skills}
          {...(isOverWarning ? { alternative: { label: "Start anyway", onSend: openWith(true) } } : {})}
          onChangeText={request.change}
          onSend={openWith(false)}
          placeholder="The errand's first message…"
        />
      </View>
    </View>
  );
}

/** Text as typed, and the same text once typing pauses, so a preview is not asked for at every key. */
function useSettledText() {
  const [text, setText] = useState("");
  const [settled, setSettled] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSettled(text), 300);
    return () => clearTimeout(timer);
  }, [text]);
  return { change: setText, settled };
}
