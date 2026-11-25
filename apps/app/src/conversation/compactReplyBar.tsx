import type { MissionState, ThreadState } from "@outlore/contracts";
import { Pressable, Text, View } from "react-native";
import { agoOf } from "../foundation/formatting";
import { colors, stateLabels, stateTones } from "../foundation/theme";
import { ChipIcon } from "../ui/chips";
import { isHovered } from "../ui/pointer";
import { replyCountLabelOf, shortenedTitleOf } from "./replyLineLabels";
import { local } from "./replyLineStyles";

/**
 * Compact one-line reply bar shown directly under an anchor message in the conversation feed: state dot, reply count,
 * title, waiting/attention indicator, and last activity time.
 */
export function CompactReplyBar({
  activityAt,
  isOpen,
  kind,
  label,
  onPress,
  replyCount,
  state,
  title,
  waitingCount = 0,
}: {
  activityAt: number | null;
  isOpen: boolean;
  /** What the line opens, which its small mark shows: a quest or an errand. */
  kind: "errand" | "quest";
  label: string;
  onPress: () => void;
  replyCount: number | undefined;
  state?: ThreadState | MissionState;
  title: string;
  waitingCount?: number;
}) {
  const tone = state === undefined ? null : stateTones[state];
  const countLabel = replyCountLabelOf(replyCount, state);
  const badge = waitingCount > 0 ? `${waitingCount} waiting` : state === "Attention" ? stateLabels.Attention : null;
  return (
    <View style={local.compactRow}>
      {/* The elbow sits beside the pressable area, not under it, so the pressed or hovered fill never covers it. */}
      <View style={local.compactElbow} />
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        onPress={onPress}
        style={(pressState) => [
          local.compactBar,
          (pressState.pressed || isOpen || isHovered(pressState)) && local.lineActive,
        ]}
      >
        {tone !== null && <View style={[local.dot, { backgroundColor: tone.color }]} />}
        {countLabel !== null && <Text style={local.compactCount}>{countLabel}</Text>}
        <Text numberOfLines={1} style={local.compactTitle}>
          {shortenedTitleOf(title)}
        </Text>
        {badge !== null && <Text style={[local.compactBadge, tone !== null && { color: tone.color }]}>{badge}</Text>}
        {activityAt !== null && activityAt > 0 && (
          <Text style={local.compactMeta}>{agoOf(activityAt, Date.now())}</Text>
        )}
        <ChipIcon color={colors.accentText} kind={kind} size={14} />
      </Pressable>
    </View>
  );
}
