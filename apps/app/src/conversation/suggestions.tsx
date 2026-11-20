import type { MissionId, Suggestion, SuggestionAnswer, ThreadId, Tier, WorkspaceId } from "@outlore/contracts";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { type Runner, RunnerPickers, useHarnesses } from "../editors/runners";
import { messageOf, type ServiceClient } from "../foundation/client";
import { companionLabelOf, harnessLabels } from "../foundation/formatting";
import { settledSuggestionLabelOf } from "../foundation/labels";
import { allMissions } from "../foundation/queries";
import { styles } from "../foundation/styles";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { companionChoicesOf, hasTiers, selectedChoiceOf } from "./suggestionChoices";

/** The line a resolved suggestion leaves in its thread, opening where the request went. */
export function SuggestionLine({
  suggestion,
  onOpenMission,
  onSelectThread,
}: {
  suggestion: Suggestion;
  onOpenMission: (missionId: MissionId) => void;
  onSelectThread: (threadId: ThreadId) => void;
}) {
  if (suggestion.outcome === null) return null;
  const label = settledSuggestionLabelOf(suggestion);
  const { targetMissionId, targetThreadId } = suggestion;
  const open =
    suggestion.outcome === "KeptAsAside"
      ? targetThreadId === null
        ? null
        : () => onSelectThread(targetThreadId)
      : targetMissionId === null
        ? null
        : () => onOpenMission(targetMissionId);
  return (
    <View style={styles.questionLine}>
      {open === null ? (
        <Text style={styles.muted}>{label}</Text>
      ) : (
        <Pressable onPress={open}>
          <Text style={styles.link}>
            {label}: {suggestion.targetTitle}
            {suggestion.isAutomatic && !suggestion.isFromGuildmaster ? " (opened without asking)" : ""}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/** A labelled row of exclusive choices, shown as chips that wrap, read by a screen reader as a radio group. */
function ChoiceRow({
  label,
  options,
}: {
  label: string;
  options: ReadonlyArray<{ isSelected: boolean; key: string; label: string; onPress: () => void }>;
}) {
  return (
    <View accessibilityLabel={label} accessibilityRole="radiogroup" style={local.choice}>
      <Text style={styles.muted}>{label}</Text>
      <View style={local.chips}>
        {options.map((option) => (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: option.isSelected }}
            key={option.key}
            onPress={option.onPress}
            style={[styles.answer, local.chip, option.isSelected && styles.answerPrimary]}
          >
            <Text style={[styles.answerText, option.isSelected && styles.answerTextPrimary]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  chip: { alignSelf: "flex-start" },
  chips: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { gap: 6 },
});

/** Sends the owner's answer to an open suggestion, and keeps the reason when it is refused. */
function useSuggestionAnswer(client: ServiceClient, suggestion: Suggestion) {
  const [error, setError] = useState<string | null>(null);
  const send = (answer: SuggestionAnswer) =>
    client.request({ _tag: "AnswerSuggestion", answer, suggestionId: suggestion.id }).then(
      () => setError(null),
      (reason) => setError(messageOf(reason)),
    );
  return { error, send };
}

/** The "Continue in ..." buttons of the quests that may already cover the request. */
function MatchButtons({
  onContinue,
  suggestion,
}: {
  onContinue: (missionId: MissionId) => void;
  suggestion: Suggestion;
}) {
  return suggestion.matches.map((match) => (
    <Pressable key={match.missionId} onPress={() => onContinue(match.missionId)} style={styles.answer}>
      <Text style={styles.answerText}>
        Continue in "{match.title}" · {match.state}
      </Text>
    </Pressable>
  ));
}

const suggestionRunnerOf = (suggestion: Suggestion): Runner => ({
  accountId: suggestion.accountId,
  effort: suggestion.effort,
  harness: suggestion.harness,
  model: suggestion.model,
});

/** An open suggestion: Chronicler's proposal of a new quest, or where a thread's off-topic message should go. */
type Channel = { id: WorkspaceId | null; name: string };

export function SuggestionCard({
  canOpenAside = true,
  channel,
  client,
  suggestion,
}: {
  canOpenAside?: boolean;
  channel?: Channel | undefined;
  client: ServiceClient;
  suggestion: Suggestion;
}) {
  return suggestion.isFromGuildmaster ? (
    <ProposalCard channel={channel} client={client} suggestion={suggestion} />
  ) : (
    <OffTopicCard canOpenAside={canOpenAside} client={client} suggestion={suggestion} />
  );
}

/**
 * Chronicler's proposal: the realm and the Companion as rows of chips, the Companion offered by the tiers the owner set in
 * the Workshop (or only the default, stated), and the pickers behind "Customize the Companion" (CHG-0179).
 */
function ProposalCard({
  channel,
  client,
  suggestion,
}: {
  channel: Channel | undefined;
  client: ServiceClient;
  suggestion: Suggestion;
}) {
  const { data: harnesses } = useHarnesses(client);
  const { error, send } = useSuggestionAnswer(client, suggestion);
  const { data: settings } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  const { data: known } = useServiceQuery(client, allMissions.request, allMissions.key);
  const [runner, setRunner] = useState<Tier>({ ...suggestionRunnerOf(suggestion), backups: suggestion.backups });
  const [isCustomizing, setIsCustomizing] = useState(false);
  // The proposed realm until the owner picks another, or the Borderlands.
  const [chosenRealm, setChosenRealm] = useState<WorkspaceId | null | undefined>(undefined);
  const pickers = (
    <RunnerPickers
      client={client}
      harnesses={harnesses}
      isCompact={false}
      onChange={(next) => setRunner({ ...next, backups: runner.backups })}
      value={runner}
    />
  );
  const choices =
    settings === null ? [] : companionChoicesOf(settings, (tier) => companionLabelOf(tier.harness, null, tier.model));
  const selected = selectedChoiceOf(choices, runner);
  const realms = known?.workspaces ?? [];
  const proposedRealm = realms.find((realm) => suggestion.realmPath !== null && realm.path === suggestion.realmPath);
  const defaultRealm = proposedRealm?.id ?? channel?.id ?? null;
  const realmId = chosenRealm === undefined ? defaultRealm : chosenRealm;
  const hasMatches = suggestion.matches.length > 0;
  return (
    <View style={styles.question}>
      <Text style={styles.questionText}>
        {hasMatches
          ? "A quest may already cover this. Continue it, or open a new quest?"
          : "Chronicler proposes a new quest. Pick its realm, then open it."}
      </Text>
      <Text style={styles.body}>{suggestion.text}</Text>
      <MatchButtons onContinue={(missionId) => send({ _tag: "Continue", missionId })} suggestion={suggestion} />
      <View style={styles.details}>
        <Pressable
          onPress={() => send({ _tag: "NewMission", ...runner, realmId })}
          style={[styles.answer, styles.answerPrimary]}
        >
          <Text style={[styles.answerText, styles.answerTextPrimary]}>
            {hasMatches ? "Open a new quest anyway" : "Open the new quest"} "{suggestion.title}"
          </Text>
        </Pressable>
        <ChoiceRow
          label="Realm"
          options={[
            {
              isSelected: realmId === null,
              key: "borderlands",
              label: "No realm",
              onPress: () => setChosenRealm(null),
            },
            ...realms.map((realm) => ({
              isSelected: realmId === realm.id,
              key: realm.id,
              label: realm.name,
              onPress: () => setChosenRealm(realm.id),
            })),
          ]}
        />
        {hasTiers(choices) ? (
          <ChoiceRow
            label="Companion"
            options={choices.map((choice) => ({
              isSelected: choice === selected,
              key: choice.label,
              label: choice.label,
              onPress: () => setRunner(choice.runner),
            }))}
          />
        ) : (
          <Text style={styles.muted}>
            Starts on {harnessLabels[runner.harness]} · {companionLabelOf(runner.harness, null, runner.model)}, the
            default Companion. Set Light, Balanced, and Heavy in the Workshop to choose by tier.
          </Text>
        )}
        <Pressable onPress={() => setIsCustomizing(!isCustomizing)}>
          <Text style={styles.link}>{isCustomizing ? "Hide the Companion settings" : "Customize the Companion"}</Text>
        </Pressable>
        {isCustomizing && pickers}
      </View>
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

/** A thread's off-topic message: continue in a matching quest, open a new one, or keep it as an aside. */
function OffTopicCard({
  canOpenAside,
  client,
  suggestion,
}: {
  canOpenAside: boolean;
  client: ServiceClient;
  suggestion: Suggestion;
}) {
  const { data: harnesses } = useHarnesses(client);
  const { error, send } = useSuggestionAnswer(client, suggestion);
  const [runner, setRunner] = useState<Runner>(suggestionRunnerOf(suggestion));
  return (
    <View style={styles.question}>
      <Text style={styles.questionText}>This message seems off this quest's topic. Where should it go?</Text>
      <Text style={styles.body}>{suggestion.text}</Text>
      <MatchButtons onContinue={(missionId) => send({ _tag: "Continue", missionId })} suggestion={suggestion} />
      <View style={styles.details}>
        <Pressable
          onPress={() => send({ _tag: "NewMission", ...runner })}
          style={[styles.answer, styles.answerPrimary]}
        >
          <Text style={[styles.answerText, styles.answerTextPrimary]}>Open as new quest "{suggestion.title}"</Text>
        </Pressable>
        <RunnerPickers client={client} harnesses={harnesses} isCompact={false} onChange={setRunner} value={runner} />
      </View>
      {canOpenAside && (
        <Pressable onPress={() => send({ _tag: "Aside" })} style={styles.answer}>
          <Text style={styles.answerText}>Keep as aside</Text>
        </Pressable>
      )}
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}
