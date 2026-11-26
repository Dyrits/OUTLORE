import type { LoreEntryId, LoreGauge, LoreScope, LoreStateFilter, ThreadId, WorkspaceId } from "@outlore/contracts";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useBarClearance } from "../foundation/barClearance";
import type { ServiceClient } from "../foundation/client";
import { loreGaugeLabelOf } from "../foundation/loreLabels";
import { useHasSidebar, useHasTopBar } from "../foundation/shellContext";
import { styles } from "../foundation/styles";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { Choice } from "../ui/pickers";
import { LoreChangeCard, LoreProposalCard } from "./loreChanges";
import { LoreEntryRow } from "./loreEntryRow";
import { DeletedLoreEntryRow, LoreHistoryScreen } from "./loreHistory";

// The changes are drawn in their own file; they are re-exported so the conversation keeps importing them from here.
export { LoreChangeCard, LoreChangeLine } from "./loreChanges";

// Stored and wire names keep `intel` so existing data and agents still work: request tags (`"ListIntel"`, ...).

// Scoped lore (scoped-intel): the thread's lore icon, its changes in the conversation, and the lore panel.

/** The thread's lore icon: its count and share of the context window, red past the warning share. */
export function LoreIcon({ gauge, onPress }: { gauge: LoreGauge; onPress: () => void }) {
  return (
    <Pressable
      accessibilityHint={`${gauge.tokens} tokens of a ${gauge.windowTokens}-token context window; opens the lore panel`}
      onPress={onPress}
    >
      <Text style={[styles.link, gauge.isOverWarning && styles.error]}>{loreGaugeLabelOf(gauge)}</Text>
    </Pressable>
  );
}

const scopes = [null, "Thread", "Workspace", "Global"] as const satisfies ReadonlyArray<LoreScope | null>;
const states = [
  null,
  "Active",
  "Dormant",
  "Archived",
  "Pinned",
  "Deleted",
] as const satisfies ReadonlyArray<LoreStateFilter | null>;
const scopeNames = { Global: "Global", Thread: "Quest and errands", Workspace: "Realm" } as const satisfies Record<
  LoreScope,
  string
>;

/**
 * The lore panel: the changes awaiting approval, then each lore entry with its scope, saver, and time, filtered by
 * scope. Opened from a thread it lists the lore in that thread's scope, most specific first; otherwise all.
 */
export function LoreScreen({
  client,
  onBack,
  threadId,
  title,
  workspaceId = null,
}: {
  client: ServiceClient;
  onBack: () => void;
  threadId: ThreadId | null;
  title: string;
  /** Only the lore of this realm's own scope, as for the realm panel's lore. */
  workspaceId?: WorkspaceId | null;
}) {
  const hasSidebar = useHasSidebar();
  const hasTopBar = useHasTopBar();
  const barClearance = useBarClearance();
  const [scope, setScope] = useState<LoreScope | null>(null);
  const [state, setState] = useState<LoreStateFilter | null>(null);
  const [historyOf, setHistoryOf] = useState<LoreEntryId | null>(null);
  const { data, error } = useServiceQuery(
    client,
    { _tag: "ListIntel", scope, state, threadId, workspaceId },
    `lore:${threadId ?? "all"}:${scope ?? "all"}:${state ?? "all"}:${workspaceId ?? "any"}`,
  );
  if (historyOf !== null) {
    return <LoreHistoryScreen client={client} loreEntryId={historyOf} onBack={() => setHistoryOf(null)} />;
  }
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        {/* All lore is a place of the sidebar or the narrow window's menu; a thread's lore goes back to its thread. */}
        {!((hasSidebar || hasTopBar) && threadId === null && workspaceId === null) && (
          <Pressable onPress={onBack}>
            <Text style={styles.link}>← Back</Text>
          </Pressable>
        )}
        {!((hasSidebar || hasTopBar) && threadId === null && workspaceId === null) && (
          <Text numberOfLines={1} style={[styles.heading, styles.flex]}>
            {title}
          </Text>
        )}
      </View>
      {error !== null && <Text style={styles.error}>{error}</Text>}
      {data?.gauge != null && (
        <Text style={data.gauge.isOverWarning ? styles.error : styles.muted}>
          The lore in this quest or errand's scope takes {data.gauge.tokens} tokens of its model's{" "}
          {data.gauge.windowTokens.toLocaleString("en-US")}-token context{" "}
          {data.gauge.isSoftLimit === true ? "soft limit" : "window"}; the icon turns red past{" "}
          {data.gauge.warningPercent}%.
        </Text>
      )}
      {data && (
        <ScrollView contentContainerStyle={barClearance} style={styles.flex}>
          {data.proposals.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.label}>Proposed from how lore is used</Text>
              {data.proposals.map((proposal) => (
                <LoreProposalCard client={client} key={proposal.id} proposal={proposal} />
              ))}
            </View>
          )}
          {data.awaiting.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.label}>Waiting for your approval</Text>
              {data.awaiting.map((change) => (
                <LoreChangeCard change={change} client={client} key={change.id} shouldNameThread />
              ))}
            </View>
          )}
          <View style={[styles.filters, styles.raised]}>
            {/* A realm's lore is all of its own scope, so there is nothing to choose between. */}
            {workspaceId === null && (
              <Choice
                accessibilityLabel="Scope"
                label={(choice) => (choice === null ? "All scopes" : scopeNames[choice])}
                onChange={setScope}
                options={scopes}
                value={scope}
              />
            )}
            <Choice
              accessibilityLabel="State"
              label={(choice) => (choice === null ? "Any state" : choice)}
              onChange={setState}
              options={states}
              value={state}
            />
          </View>
          {data.loreEntries.length === 0 && data.deleted.length === 0 && (
            <Text style={styles.muted}>{state === "Deleted" ? "No deleted lore." : "No lore here yet."}</Text>
          )}
          {data.loreEntries.map((loreEntry) => (
            <LoreEntryRow
              client={client}
              key={loreEntry.id}
              loreEntry={loreEntry}
              onHistory={() => setHistoryOf(loreEntry.id)}
            />
          ))}
          {data.deleted.map((loreEntry) => (
            <DeletedLoreEntryRow
              client={client}
              key={loreEntry.id}
              loreEntry={loreEntry}
              onHistory={() => setHistoryOf(loreEntry.id)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
