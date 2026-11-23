import type { Ritual, RitualId, RitualRunState } from "@outlore/contracts";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { messageOf, type ServiceClient } from "../foundation/client";
import { harnessLabels, modelLabelOf } from "../foundation/formatting";
import { styles } from "../foundation/styles";
import { colors } from "../foundation/theme";
import { Toggle } from "../ui/controls";
import { nextRunLabelOf, runStateLabels, scheduleLabelOf } from "./ritualLabels";
import { deleteRitualConfirm, deleteRitualLoss, deleteRitualQuestion } from "./ritualRow";
import { ritualStyles } from "./ritualStyles";

const runStateColors = {
  Done: colors.successText,
  Failed: colors.dangerText,
  Interrupted: colors.textMuted,
  Underway: colors.underwayText,
} as const satisfies Record<RitualRunState, string>;

/** Why a Ritual of an archived realm stays off and cannot run. */
export const realmArchivedNotice = "Realm archived: restore it to switch this Ritual on.";

/** Switches a Ritual on or off, keeping everything else as it is. */
export const setRitualOn = (client: ServiceClient, ritual: Ritual, isOn: boolean) =>
  client.request({
    _tag: "UpdateRitual",
    fallbacks: ritual.fallbacks,
    instruction: ritual.instruction,
    isOn,
    primary: ritual.primary,
    ritualId: ritual.id,
    schedule: ritual.schedule,
    title: ritual.title,
  });

/** Runs the Ritual now, showing the reason when it is refused. */
export function RunNowButton({
  client,
  isBlocked = false,
  isInHeader = false,
  isUnderway,
  onError,
  ritualId,
}: {
  client: ServiceClient;
  /** Whether the Ritual's realm is archived, which keeps it from running. */
  isBlocked?: boolean;
  isInHeader?: boolean;
  isUnderway: boolean;
  onError?: (message: string | null) => void;
  ritualId: RitualId;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setStarting] = useState(false);
  const reportError = onError ?? setError;
  const isDisabled = isUnderway || isBlocked || isStarting;
  return (
    <View style={ritualStyles.runNow}>
      <Pressable
        accessibilityLabel="Run now"
        accessibilityRole="button"
        accessibilityState={{ busy: isStarting, disabled: isDisabled }}
        disabled={isDisabled}
        onPress={async () => {
          setStarting(true);
          reportError(null);
          try {
            await client.request({ _tag: "RunRitual", ritualId });
          } catch (reason) {
            reportError(messageOf(reason));
          } finally {
            setStarting(false);
          }
        }}
        /**
         * The switch and the schedule apply to the next run; Run now starts one at any moment, whatever the schedule
         * and the switch (rituals).
         */
        style={[
          ritualStyles.runButton,
          isInHeader && { alignItems: "center", flexDirection: "row", gap: 5, minHeight: 28 },
          isDisabled && styles.buttonDisabled,
        ]}
      >
        {isInHeader && (
          <Svg height={14} viewBox="0 0 16 16" width={14}>
            <Path d="M5 2.5l8 5.5-8 5.5z" fill={colors.accentText} />
          </Svg>
        )}
        <Text style={ritualStyles.runButtonText}>Run now</Text>
      </Pressable>
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

/**
 * Deletes the Ritual after one confirmation naming what is lost — the Ritual, its runs' errands, and their history —
 * and that Cancel keeps it (rituals): the call removes the whole tree, permanently.
 */
export function DeleteRitualButton({
  client,
  onError,
  ritualId,
  title,
}: {
  client: ServiceClient;
  onError: (message: string | null) => void;
  ritualId: RitualId;
  title: string;
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  if (!isConfirming) {
    return (
      <Pressable
        accessibilityLabel={`Delete ${title}`}
        accessibilityRole="button"
        onPress={() => setIsConfirming(true)}
      >
        <Text style={ritualStyles.remove}>Delete</Text>
      </Pressable>
    );
  }
  return (
    <View style={ritualStyles.confirmation}>
      <Text style={styles.body}>{deleteRitualQuestion(title)}</Text>
      <Text style={styles.muted}>{deleteRitualLoss}</Text>
      <View style={ritualStyles.sentence}>
        <Pressable
          accessibilityLabel={deleteRitualConfirm}
          accessibilityRole="button"
          onPress={() =>
            client.request({ _tag: "DeleteRitual", ritualId }).then(
              () => {
                setIsConfirming(false);
                onError(null);
              },
              (reason) => {
                setIsConfirming(false);
                onError(messageOf(reason));
              },
            )
          }
        >
          <Text style={ritualStyles.remove}>{deleteRitualConfirm}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => setIsConfirming(false)}>
          <Text style={styles.link}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** A Ritual's Companion and its fallbacks in a line, such as "Sonnet 5.5 · Claude Code · 1 fallback". */
export const companionLineOf = (ritual: Pick<Ritual, "fallbacks" | "primary">) =>
  [
    modelLabelOf(ritual.primary.model),
    harnessLabels[ritual.primary.harness],
    ...(ritual.fallbacks.length === 0
      ? []
      : [`${ritual.fallbacks.length} fallback${ritual.fallbacks.length === 1 ? "" : "s"}`]),
  ].join(" · ");

/** The label of a Ritual's last run, or null when none has run. */
export const lastRunLabelOf = (lastRunState: RitualRunState | null) =>
  lastRunState === null ? null : (
    <Text style={ritualStyles.fact}>
      Last run: <Text style={{ color: runStateColors[lastRunState] }}>{runStateLabels[lastRunState]}</Text>
    </Text>
  );

/** How a Ritual's schedule, next run and last run read together as a line. */
export const scheduleLineOf = (ritual: Pick<Ritual, "isOn" | "lastRunState" | "nextRunAt" | "schedule">) => (
  <>
    <Text style={ritualStyles.cardSchedule}>Ritual · {scheduleLabelOf(ritual.schedule)}</Text>
    <Text style={ritualStyles.fact}>
      {nextRunLabelOf(ritual.isOn ? ritual.nextRunAt : null, Date.now())}
      {ritual.lastRunState === null ? "" : ` · Last run: ${runStateLabels[ritual.lastRunState]}`}
    </Text>
  </>
);

/** The toggle of a Ritual's on or off switch, with the words it reads in beside it. */
export function RitualSwitch({
  client,
  isDisabled,
  onError,
  ritual,
}: {
  client: ServiceClient;
  /** Whether the Ritual's realm is archived, which keeps it off. */
  isDisabled: boolean;
  onError: (message: string | null) => void;
  ritual: Ritual;
}) {
  return (
    <View style={ritualStyles.switch}>
      <Toggle
        isDisabled={isDisabled}
        onValueChange={(isOn) =>
          setRitualOn(client, ritual, isOn).then(
            () => onError(null),
            (reason) => onError(messageOf(reason)),
          )
        }
        value={ritual.isOn}
      />
      <Text style={styles.body}>{ritual.isOn ? "On" : "Off"}</Text>
    </View>
  );
}
