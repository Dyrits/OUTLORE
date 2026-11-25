import type { LoreChange, LoreProposal } from "@outlore/contracts";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { messageOf, type ServiceClient } from "../foundation/client";
import { clockOf } from "../foundation/formatting";
import { loreActionOf, loreChangeLineOf, loreProposalLineOf, scopeNameOf } from "../foundation/loreLabels";
import { styles } from "../foundation/styles";

/** Approve and Decline on a change or a proposal awaiting the owner. */
function Decision({ onResolve }: { onResolve: (isApproved: boolean) => Promise<unknown> }) {
  const [error, setError] = useState<string | null>(null);
  const resolve = (isApproved: boolean) =>
    onResolve(isApproved).then(
      () => setError(null),
      (reason) => setError(messageOf(reason)),
    );
  return (
    <View style={styles.section}>
      <View style={styles.inlineRow}>
        <Pressable onPress={() => resolve(true)} style={[styles.answer, styles.answerPrimary]}>
          <Text style={[styles.answerText, styles.answerTextPrimary]}>Approve</Text>
        </Pressable>
        <Pressable onPress={() => resolve(false)} style={styles.answer}>
          <Text style={styles.answerText}>Decline</Text>
        </Pressable>
      </View>
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

/** A change awaiting approval as a card: what the thread asks, the text, and the decision. */
export function LoreChangeCard({
  change,
  client,
  shouldNameThread = false,
}: {
  change: LoreChange;
  client: ServiceClient;
  shouldNameThread?: boolean;
}) {
  return (
    <View style={styles.question}>
      <Text style={styles.questionText}>
        {loreActionOf(change)}
        {shouldNameThread ? ` · asked by "${change.threadTitle}"` : ""}
      </Text>
      {(change.kind === "Update" || change.kind === "Replace") && change.previousText !== change.text && (
        <Text style={styles.muted}>Was: {change.previousText}</Text>
      )}
      <Text style={styles.body}>{change.text}</Text>
      <Decision
        onResolve={(isApproved) => client.request({ _tag: "ResolveIntelChange", changeId: change.id, isApproved })}
      />
    </View>
  );
}

/** A widening or narrowing proposed from evidence: why, the text it keeps, the lore entries it moves, and the decision. */
export function LoreProposalCard({ client, proposal }: { client: ServiceClient; proposal: LoreProposal }) {
  return (
    <View style={styles.question}>
      <Text style={styles.questionText}>{loreProposalLineOf(proposal)}</Text>
      <Text style={styles.body}>{proposal.text}</Text>
      {proposal.loreEntries.map((loreEntry) => (
        <Text key={loreEntry.id} style={styles.muted}>
          Now in {scopeNameOf(loreEntry.scopeLabel)}: {loreEntry.text}
        </Text>
      ))}
      <Decision
        onResolve={(isApproved) =>
          client.request({ _tag: "ResolveIntelProposal", isApproved, proposalId: proposal.id })
        }
      />
    </View>
  );
}

/** A change made or decided, as a short line in its thread. */
export function LoreChangeLine({ change }: { change: LoreChange }) {
  return (
    <View style={styles.questionLine}>
      <Text style={styles.muted}>
        {loreChangeLineOf(change)} · {clockOf(change.resolvedAt ?? change.at)}
      </Text>
      <Text style={styles.muted}>{change.text}</Text>
    </View>
  );
}
