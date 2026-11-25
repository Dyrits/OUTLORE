import type { MissionId, Suggestion, ThreadId, Tier, WorkspaceId } from "@outlore/contracts";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { type Runner, RunnerPickers, useHarnesses } from "../editors/runners";
import type { ServiceClient } from "../foundation/client";
import { companionLabelOf, harnessLabels } from "../foundation/formatting";
import { settledSuggestionLabelOf } from "../foundation/labels";
import { allMissions } from "../foundation/queries";
import { styles } from "../foundation/styles";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { companionChoicesOf, hasTiers, realmOptionsOf, selectedChoiceOf } from "./suggestionChoices";
import {
  ChangeLink,
  ChoiceRow,
  DestinationRow,
  local,
  MatchRows,
  SuggestionFrame,
  suggestionRunnerOf,
  useSuggestionAnswer,
} from "./suggestionParts";

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

/** The channel a suggestion names: the realm it proposes for a quest, or the realm and Borderlands for an off-topic message. */
type Channel = { id: WorkspaceId | null; name: string };

/** An open suggestion card: Chronicler's proposal of a new quest, or where a thread's off-topic message should go. */
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
 * Chronicler's proposal: the quests that may already cover it, when there are any, then the new quest as one row that
 * names its realm and Companion. Changing either opens the rows of chips and the pickers behind "Customize the
 * Companion" (CHG-0179); the Companion is offered by the tiers the owner set in the Workshop, or only the default.
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
  const [isChanging, setIsChanging] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);
  // The proposed realm until the owner picks another, or the Borderlands.
  const [chosenRealm, setChosenRealm] = useState<{ id: WorkspaceId | null } | null>(null);
  const choices =
    settings === null ? [] : companionChoicesOf(settings, (tier) => companionLabelOf(tier.harness, null, tier.model));
  const selected = selectedChoiceOf(choices, runner);
  const realms = known?.workspaces ?? [];
  const realmOptions = realmOptionsOf(realms);
  const proposedRealm = realms.find((realm) => suggestion.realmPath !== null && realm.path === suggestion.realmPath);
  const defaultRealm = proposedRealm?.id ?? channel?.id ?? null;
  const realmId = chosenRealm === null ? defaultRealm : chosenRealm.id;
  const realmLabel = realmOptions.find((realm) => realm.id === realmId)?.label ?? "No realm";
  const companionLabel = selected?.label ?? companionLabelOf(runner.harness, null, runner.model);
  const hasMatches = suggestion.matches.length > 0;
  return (
    <SuggestionFrame
      error={error}
      heading={hasMatches ? "Where should this go?" : "Chronicler suggests a new quest"}
      setup={
        isChanging && (
          <View style={local.setup}>
            <ChoiceRow
              label="Realm"
              options={[
                {
                  isSelected: realmId === null,
                  key: "borderlands",
                  label: "No realm",
                  onPress: () => setChosenRealm({ id: null }),
                },
                ...realmOptions.map((realm) => ({
                  isSelected: realmId === realm.id,
                  key: realm.id,
                  label: realm.label,
                  onPress: () => setChosenRealm({ id: realm.id }),
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
              <Text style={styles.link}>
                {isCustomizing ? "Hide the Companion settings" : "Customize the Companion"}
              </Text>
            </Pressable>
            {isCustomizing && (
              <RunnerPickers
                client={client}
                harnesses={harnesses}
                isCompact={false}
                onChange={(next) => setRunner({ ...next, backups: runner.backups })}
                value={runner}
              />
            )}
          </View>
        )
      }
      text={suggestion.text}
    >
      <MatchRows onContinue={(missionId) => send({ _tag: "Continue", missionId })} suggestion={suggestion} />
      <DestinationRow
        detail={`${realmLabel} · ${companionLabel}`}
        glyph="+"
        isPrimary
        onPress={() => send({ _tag: "NewMission", ...runner, realmId })}
        title={`${hasMatches ? "New quest" : "Open quest"} "${suggestion.title}"`}
        trailing={<ChangeLink isOpen={isChanging} onPress={() => setIsChanging(!isChanging)} />}
      />
    </SuggestionFrame>
  );
}

/**
 * A thread's off-topic message: the quests that may already cover it, when there are any, then a new quest, then an
 * aside. The Companion the new quest starts on is named, and changing it opens the pickers.
 */
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
  const [isChanging, setIsChanging] = useState(false);
  return (
    <SuggestionFrame
      error={error}
      heading={suggestion.matches.length > 0 ? "Where should this go?" : "This seems off this quest's topic"}
      setup={
        isChanging && (
          <View style={local.setup}>
            <RunnerPickers
              client={client}
              harnesses={harnesses}
              isCompact={false}
              onChange={setRunner}
              value={runner}
            />
          </View>
        )
      }
      text={suggestion.text}
    >
      <MatchRows onContinue={(missionId) => send({ _tag: "Continue", missionId })} suggestion={suggestion} />
      <DestinationRow
        detail={`${harnessLabels[runner.harness]} · ${companionLabelOf(runner.harness, null, runner.model)}`}
        glyph="+"
        isPrimary
        onPress={() => send({ _tag: "NewMission", ...runner })}
        title={`New quest "${suggestion.title}"`}
        trailing={<ChangeLink isOpen={isChanging} onPress={() => setIsChanging(!isChanging)} />}
      />
      {canOpenAside && (
        <DestinationRow
          detail="Stays in this quest's thread"
          glyph="·"
          onPress={() => send({ _tag: "Aside" })}
          title="Keep here as an aside"
        />
      )}
    </SuggestionFrame>
  );
}
