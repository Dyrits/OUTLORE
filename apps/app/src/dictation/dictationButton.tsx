import { ActivityIndicator, Pressable, StyleSheet } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { colors, radii } from "../foundation/theme";
import type { DictationPhase } from "./dictation";

/** The microphone: a capsule on a stand, in the given ink. */
function Microphone({ color }: { color: string }) {
  return (
    <Svg
      fill="none"
      height={16}
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.6}
      viewBox="0 0 16 16"
      width={16}
    >
      <Rect height={8} rx={2.5} width={5} x={5.5} y={1.5} />
      <Path d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2.5" />
    </Svg>
  );
}

/** The cancel mark: a small cross in dim ink. */
function CancelCross() {
  return (
    <Svg
      fill="none"
      height={12}
      stroke={colors.textDim}
      strokeLinecap="round"
      strokeWidth={1.6}
      viewBox="0 0 12 12"
      width={12}
    >
      <Path d="M3 3l6 6M9 3l-6 6" />
    </Svg>
  );
}

const labels = {
  Checking: "Starting dictation",
  Idle: "Dictate",
  Listening: "Stop dictating",
  Transcribing: "Transcribing",
} satisfies Record<DictationPhase, string>;

/**
 * The message box's microphone (voice-input): press to start listening, press again to stop and get the words.
 * While listening it is lit in the accent color; while the host transcribes it turns into a spinner. Beside it, a
 * cross drops the dictation without touching the typed text.
 */
export function DictationButton({
  onCancel,
  onPress,
  phase,
}: {
  onCancel: () => void;
  onPress: () => void;
  phase: DictationPhase;
}) {
  const isBusy = phase === "Checking" || phase === "Transcribing";
  return (
    <>
      {(phase === "Listening" || phase === "Transcribing") && (
        <Pressable
          accessibilityLabel="Cancel dictation"
          accessibilityRole="button"
          onPress={onCancel}
          style={local.cancel}
        >
          <CancelCross />
        </Pressable>
      )}
      <Pressable
        accessibilityLabel={labels[phase]}
        accessibilityRole="button"
        accessibilityState={{ busy: isBusy, selected: phase === "Listening" }}
        disabled={isBusy}
        onPress={onPress}
        style={[local.microphone, phase === "Listening" && local.listening]}
      >
        {isBusy ? (
          <ActivityIndicator color={colors.textDim} size="small" />
        ) : (
          <Microphone color={phase === "Listening" ? colors.accentText : colors.textDim} />
        )}
      </Pressable>
    </>
  );
}

const local = StyleSheet.create({
  cancel: { alignItems: "center", height: 24, justifyContent: "center", width: 20 },
  listening: { backgroundColor: colors.accentSoft },
  microphone: { alignItems: "center", borderRadius: radii.pill, height: 32, justifyContent: "center", width: 32 },
});
