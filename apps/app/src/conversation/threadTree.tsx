import type { ThreadId, ThreadSummary } from "@outlore/contracts";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { countedOf, foldedLabelOf } from "../foundation/labels";
import { styles } from "../foundation/styles";
import { stateLabels, stateTones } from "../foundation/theme";
import { rankedFoldedOf } from "./errandRoster";

export { OpenThreadForm } from "./openThreadForm";

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
