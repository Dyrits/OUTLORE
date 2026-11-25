import type { MissionId, Suggestion, SuggestionAnswer, ThreadId, Tier, WorkspaceId } from "@outlore/contracts";
import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { type Runner, RunnerPickers, useHarnesses } from "../editors/runners";
import { messageOf, type ServiceClient } from "../foundation/client";
import { companionLabelOf, harnessLabels } from "../foundation/formatting";
import { settledSuggestionLabelOf } from "../foundation/labels";
import { allMissions } from "../foundation/queries";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts, outline, radii, round } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { companionChoicesOf, hasTiers, realmOptionsOf, selectedChoiceOf } from "./suggestionChoices";

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
  card: { ...outline, ...round, backgroundColor: colors.surface, gap: 10, padding: 14 },
  change: { justifyContent: "center", paddingHorizontal: 12 },
  chip: { alignSelf: "flex-start" },
  chips: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { gap: 6 },
  glyph: { color: colors.accentText, fontFamily: fonts.sans, fontSize: fontSizes.lg, fontWeight: "700", width: 22 },
  list: { ...outline, ...round, backgroundColor: colors.edge, gap: 1, overflow: "hidden" },
  quote: { borderLeftColor: colors.edge, borderLeftWidth: 3, paddingLeft: 10 },
  row: { alignItems: "stretch", backgroundColor: colors.surface, flexDirection: "row" },
  rowMain: { alignItems: "center", flex: 1, flexDirection: "row", gap: 10, paddingHorizontal: 12, paddingVertical: 9 },
  rowPrimary: { backgroundColor: colors.controlActive },
  rowText: { flex: 1, gap: 1 },
  setup: { backgroundColor: colors.page, borderRadius: radii.md, gap: 10, padding: 10 },
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

const suggestionRunnerOf = (suggestion: Suggestion): Runner => ({
  accountId: suggestion.accountId,
  effort: suggestion.effort,
  harness: suggestion.harness,
  model: suggestion.model,
});

/** The channel a suggestion names: the realm it proposes for a quest, or the realm and Borderlands for an off-topic message. */
type Channel = { id: WorkspaceId | null; name: string };

/** One answer in a suggestion's list: a glyph, what it does, and a line saying what that means. */
function DestinationRow({
  detail,
  glyph,
  isPrimary = false,
  onPress,
  title,
  trailing,
}: {
  detail: string;
  glyph: string;
  isPrimary?: boolean;
  onPress: () => void;
  title: string;
  trailing?: ReactNode;
}) {
  return (
    <View style={[local.row, isPrimary && local.rowPrimary]}>
      <Pressable accessibilityRole="button" onPress={onPress} style={local.rowMain}>
        <Text style={local.glyph}>{glyph}</Text>
        <View style={local.rowText}>
          <Text numberOfLines={2} style={styles.answerText}>
            {title}
          </Text>
          <Text numberOfLines={1} style={styles.muted}>
            {detail}
          </Text>
        </View>
      </Pressable>
      {trailing}
    </View>
  );
}

/** The "Continue in ..." rows of the quests that may already cover the request. */
function MatchRows({ onContinue, suggestion }: { onContinue: (missionId: MissionId) => void; suggestion: Suggestion }) {
  return suggestion.matches.map((match) => (
    <DestinationRow
      detail={`${match.state} · continue this quest`}
      glyph="↪"
      key={match.missionId}
      onPress={() => onContinue(match.missionId)}
      title={match.title}
    />
  ));
}

/** The card's frame: the owner's text as a quote, then the answers as one list, then the setup the owner asked to change. */
function SuggestionFrame({
  children,
  error,
  heading,
  setup,
  text,
}: {
  children: ReactNode;
  error: string | null;
  heading: string;
  setup: ReactNode;
  text: string;
}) {
  return (
    <View style={local.card}>
      <Text style={styles.questionText}>{heading}</Text>
      <Text style={[styles.muted, local.quote]}>{text}</Text>
      <View style={local.list}>{children}</View>
      {setup}
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

/** The "Change" link beside the new-quest row, which opens or closes the setup beneath the list. */
function ChangeLink({ isOpen, onPress }: { isOpen: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={local.change}>
      <Text style={styles.link}>{isOpen ? "Done" : "Change"}</Text>
    </Pressable>
  );
}

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
  const [chosenRealm, setChosenRealm] = useState<WorkspaceId | null | undefined>(undefined);
  const choices =
    settings === null ? [] : companionChoicesOf(settings, (tier) => companionLabelOf(tier.harness, null, tier.model));
  const selected = selectedChoiceOf(choices, runner);
  const realms = known?.workspaces ?? [];
  const realmOptions = realmOptionsOf(realms);
  const proposedRealm = realms.find((realm) => suggestion.realmPath !== null && realm.path === suggestion.realmPath);
  const defaultRealm = proposedRealm?.id ?? channel?.id ?? null;
  const realmId = chosenRealm === undefined ? defaultRealm : chosenRealm;
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
                  onPress: () => setChosenRealm(null),
                },
                ...realmOptions.map((realm) => ({
                  isSelected: realmId === realm.id,
                  key: realm.id,
                  label: realm.label,
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
