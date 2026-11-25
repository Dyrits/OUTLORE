import type { LastExchange, MissionState, ThreadState } from "@outlore/contracts";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { colors, stateLabels, stateTones } from "../foundation/theme";
import { ChipIcon } from "../ui/chips";
import { isHovered } from "../ui/pointer";
import { oneLineOf, shortenedTitleOf } from "./replyLineLabels";
import { local } from "./replyLineStyles";

/** A creation action that sits alongside the cards for existing quests and errands. */
export function NewReplyCard({
  isDisabled = false,
  label,
  onPress,
}: {
  isDisabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={(state) => [
        local.line,
        local.lineNew,
        !isDisabled && isHovered(state) && local.lineActive,
        state.pressed && local.linePressed,
        isDisabled && local.lineDisabled,
      ]}
    >
      <View style={local.row}>
        <Text style={local.title}>+ {label}</Text>
      </View>
    </Pressable>
  );
}

/**
 * The block of a reply line: who opened the work, its title, a sample of its last exchange (the owner's latest message
 * and the companion's latest reply, as a thread summary quotes them in Slack), its state and how long ago it moved, and
 * the press that opens its pane.
 */
export function ReplyCard({
  actions,
  isRitual = false,
  isOpen,
  label,
  meta,
  onPress,
  origin,
  sample,
  state,
  title,
}: {
  actions?: ReactNode;
  isOpen: boolean;
  isRitual?: boolean;
  label: string;
  /** What follows the state on the last line: the waiting count and how long ago it last moved. */
  meta: string;
  onPress: () => void;
  origin: string;
  /** The last exchange to quote, or null while the work's quest or errand is not loaded. */
  sample: LastExchange | null;
  /** The state it was opened with, or none when it cannot be known while the quest is not loaded (or archived). */
  state?: ThreadState | MissionState;
  title: string;
}) {
  const tone = state === undefined ? null : stateTones[state];
  const openCard = (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) =>
        actions === undefined ? [local.line, (pressed || isOpen) && local.lineActive] : local.openArea
      }
    >
      <Text style={local.origin}>{origin}</Text>
      <View style={local.row}>
        {isRitual ? (
          <ChipIcon color={colors.highlight} kind="ritual" size={15} />
        ) : (
          tone !== null && <View style={[local.dot, { backgroundColor: tone.color }]} />
        )}
        <Text numberOfLines={1} style={local.title}>
          {shortenedTitleOf(title)}
        </Text>
        <Text style={local.go}>{isOpen ? "Open" : "Open ›"}</Text>
      </View>
      {sample !== null && (sample.owner !== null || sample.reply !== null) && (
        <View style={local.sample}>
          {sample.owner !== null && (
            <Text numberOfLines={1} style={local.sampleLine}>
              <Text style={local.speaker}>You </Text>
              {oneLineOf(sample.owner)}
            </Text>
          )}
          {sample.reply !== null && (
            <Text numberOfLines={2} style={local.sampleLine}>
              <Text style={local.speaker}>Companion </Text>
              {oneLineOf(sample.reply)}
            </Text>
          )}
        </View>
      )}
      <Text style={local.meta}>
        {state !== undefined && <Text style={{ color: stateTones[state].color }}>{stateLabels[state]}</Text>}
        {meta}
      </Text>
    </Pressable>
  );
  return actions === undefined ? (
    openCard
  ) : (
    <View style={[local.line, local.actionCard, isOpen && local.lineActive]}>
      {openCard}
      <View style={local.actions}>{actions}</View>
    </View>
  );
}
