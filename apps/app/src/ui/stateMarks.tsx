import type { MissionState, ThreadState } from "@outlore/contracts";
import { Switch, Text, View } from "react-native";
import { styles } from "../foundation/styles";
import { colors, stateLabels, stateTones } from "../foundation/theme";

// The web's switch takes the thumb's color when on from a prop the native types do not declare.
const webSwitchColors = { activeThumbColor: colors.canvas };

/** An on and off switch in the accent color. */
export function Toggle({
  isDisabled = false,
  label,
  onValueChange,
  value,
}: {
  isDisabled?: boolean;
  label?: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <Switch
      {...webSwitchColors}
      accessibilityLabel={label}
      disabled={isDisabled}
      onValueChange={onValueChange}
      thumbColor={colors.canvas}
      trackColor={{ false: colors.controlActive, true: colors.accent }}
      value={value}
    />
  );
}

/** The glyph before a state that ends: a tick for Fulfilled, a cross for Failed; a dot for every other state. */
const stateGlyphs: Partial<Record<ThreadState | MissionState, string>> = { Failed: "✕", Fulfilled: "✓" };

/**
 * A state as it is marked on paper: Attention highlighted, Fulfilled ticked, Failed crossed, the others a dot of their
 * ink; no tinted pill.
 */
export function StateBadge({ state }: { state: ThreadState | MissionState }) {
  const tone = stateTones[state];
  const glyph = stateGlyphs[state] ?? null;
  return (
    <View style={[styles.badge, state === "Attention" && { backgroundColor: tone.soft }]}>
      {glyph === null ? (
        <View style={[styles.badgeDot, { backgroundColor: tone.color }]} />
      ) : (
        <Text style={[styles.badgeText, { color: tone.color }]}>{glyph}</Text>
      )}
      <Text style={[styles.badgeText, { color: tone.color }]}>{stateLabels[state]}</Text>
    </View>
  );
}

/** A conversation's state shown only by color, with its meaning available to assistive technology. */
export function StateIndicator({ state }: { state: ThreadState | MissionState }) {
  return (
    <View accessibilityLabel={stateLabels[state]} accessible style={styles.badge}>
      <View style={[styles.badgeDot, { backgroundColor: stateTones[state].color }]} />
    </View>
  );
}
