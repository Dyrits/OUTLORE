import type { MissionId, Suggestion, SuggestionAnswer } from "@outlore/contracts";
import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Runner } from "../editors/runners";
import { messageOf, type ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts, outline, radii, round } from "../foundation/theme";

// The pieces a suggestion card is built from (conversation panes): its frame, its rows, and the answer it sends.

/** A labelled row of exclusive choices, shown as chips that wrap, read by a screen reader as a radio group. */
export function ChoiceRow({
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

/** The styles of the card, shared with the two cards that draw it. */
export const local = StyleSheet.create({
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
export function useSuggestionAnswer(client: ServiceClient, suggestion: Suggestion) {
  const [error, setError] = useState<string | null>(null);
  const send = (answer: SuggestionAnswer) =>
    client.request({ _tag: "AnswerSuggestion", answer, suggestionId: suggestion.id }).then(
      () => setError(null),
      (reason) => setError(messageOf(reason)),
    );
  return { error, send };
}

export const suggestionRunnerOf = (suggestion: Suggestion): Runner => ({
  accountId: suggestion.accountId,
  effort: suggestion.effort,
  harness: suggestion.harness,
  model: suggestion.model,
});

/** One answer in a suggestion's list: a glyph, what it does, and a line saying what that means. */
export function DestinationRow({
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
export function MatchRows({
  onContinue,
  suggestion,
}: {
  onContinue: (missionId: MissionId) => void;
  suggestion: Suggestion;
}) {
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
export function SuggestionFrame({
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
export function ChangeLink({ isOpen, onPress }: { isOpen: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={local.change}>
      <Text style={styles.link}>{isOpen ? "Done" : "Change"}</Text>
    </Pressable>
  );
}
