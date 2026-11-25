import type {
  AttachmentId,
  BackupCompanion,
  MessageId,
  ModelChoice,
  ThreadId,
  ThreadSummary,
  ThreadView,
} from "@outlore/contracts";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { imageRefusalOf } from "../attachments/attachmentRules";
import { BackupsEditor } from "../editors/backupsEditor";
import { presetsOf } from "../editors/presets";
import { type Runner, RunnerPickers, useHarnesses } from "../editors/runners";
import { newRequestId, type ServiceClient } from "../foundation/client";
import { modelLabelOf } from "../foundation/formatting";
import { countedOf, foldedLabelOf, startingContextPartsOf, startingContextWarningOf } from "../foundation/labels";
import { styles } from "../foundation/styles";
import { stateLabels, stateTones } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { useSkills } from "../foundation/useSkills";
import { LoreScreen } from "../lore/lore";
import { Composer } from "../ui/controls";
import { rankedFoldedOf } from "./errandRoster";

/** A mission's threads as an indented tree with their states; selecting one shows its conversation. */
export function ThreadTree({
  onSelect,
  selectedId,
  shouldShowAgentThreads,
  threads,
}: {
  onSelect: (threadId: ThreadId) => void;
  selectedId: ThreadId;
  shouldShowAgentThreads: boolean;
  threads: ReadonlyArray<ThreadSummary>;
}) {
  const [unfolded, setUnfolded] = useState<ReadonlySet<string>>(new Set());
  const archived = threads.filter((thread) => thread.isArchived === true);
  const parentOf = new Map(threads.map((thread) => [thread.id, thread.parentId]));
  const depthOf = (thread: ThreadSummary) => {
    let depth = 0;
    for (let up = thread.parentId; up !== null; up = parentOf.get(up) ?? null) depth++;
    return depth;
  };
  return (
    <ScrollView contentContainerStyle={styles.treeList} style={styles.tree}>
      {rankedFoldedOf(
        threads.filter((thread) => thread.isArchived !== true),
        shouldShowAgentThreads,
        unfolded,
      ).map(({ thread, depth, foldedCount }, index) => (
        <View key={thread.id}>
          {index === 0 && <Text style={styles.treeSection}>Quest</Text>}
          {index === 1 && <Text style={[styles.treeSection, styles.treeSectionLater]}>Errands</Text>}
          <Pressable
            onPress={() => {
              if (foldedCount > 0) setUnfolded((current) => new Set([...current, thread.id]));
              onSelect(thread.id);
            }}
            style={[
              styles.treeRow,
              // The first level of errands has its own heading, so it lines up with the quest; deeper ones step in.
              { paddingLeft: 8 + Math.max(0, depth - 1) * 16 },
              thread.id === selectedId && styles.treeRowSelected,
            ]}
          >
            {depth >= 2 && <View style={[styles.treeBranch, { left: 8 + (depth - 2) * 16 + 4 }]} />}
            <View style={styles.treeTitleRow}>
              <Text numberOfLines={1} style={[styles.treeTitle, depth === 0 && styles.treeTitleQuest]}>
                {thread.title}
              </Text>
              <TreeState state={thread.shownState} />
            </View>
            {thread.isAside && <Text style={styles.treeNote}>Aside</Text>}
            {foldedCount > 0 && <Text style={styles.treeNote}>{foldedLabelOf(foldedCount)}</Text>}
            {thread.waitingCount > 0 && thread.state !== "Underway" && (
              <Text style={styles.treeNote}>{countedOf(thread.waitingCount, "message")} waiting</Text>
            )}
          </Pressable>
        </View>
      ))}
      {archived.length > 0 && <Text style={[styles.treeSection, styles.treeSectionLater]}>Archived errands</Text>}
      {archived.map((thread) => (
        <Pressable
          key={thread.id}
          onPress={() => onSelect(thread.id)}
          style={[
            styles.treeRow,
            { paddingLeft: 8 + Math.max(0, depthOf(thread) - 1) * 16 },
            thread.id === selectedId && styles.treeRowSelected,
          ]}
        >
          <View style={styles.treeTitleRow}>
            <Text numberOfLines={1} style={styles.treeTitle}>
              {thread.title}
            </Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** A thread's state at the end of its row: a diamond of the state's ink, then its name in italics. */
function TreeState({ state }: { state: ThreadSummary["state"] }) {
  const { color, soft } = stateTones[state];
  return (
    <View style={[styles.treeState, state === "Attention" && { backgroundColor: soft }]}>
      <Text style={[styles.treeStateMark, { color }]}>
        {state === "Fulfilled" ? "✓" : state === "Failed" ? "✕" : "◆"}
      </Text>
      <Text style={[styles.treeStateText, { color }]}>{stateLabels[state]}</Text>
    </View>
  );
}

/**
 * Opens a thread beneath the selected one: its model and effort start as the parent's and can be changed
 * until the first message is sent (thread-tree, Opening a thread). Past a quarter of the model's context
 * window it warns, with a larger model, trimming lore, or starting anyway.
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
          <View style={styles.failure}>
            <Text style={styles.error}>{startingContextWarningOf(context)}</Text>
            <Text style={styles.muted}>{startingContextPartsOf(context.parts)}</Text>
            <View style={styles.inlineRow}>
              {context.largerModels.length === 0 ? (
                <Text style={styles.muted}>No model has a larger context window.</Text>
              ) : (
                context.largerModels.map((larger) => (
                  <Pressable key={larger} onPress={() => setModel(larger)} style={styles.answer}>
                    <Text style={styles.answerText}>Use {modelLabelOf(larger)}</Text>
                  </Pressable>
                ))
              )}
              <Pressable onPress={() => setIsTrimming(true)} style={styles.answer}>
                <Text style={styles.answerText}>Trim lore</Text>
              </Pressable>
            </View>
          </View>
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
