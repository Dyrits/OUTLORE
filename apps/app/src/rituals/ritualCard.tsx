import type { Ritual, RitualId, RitualRunState } from "@outlore/contracts";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { messageOf, type ServiceClient } from "../foundation/client";
import { Emblem } from "../foundation/emblems";
import { harnessLabels, modelLabelOf } from "../foundation/formatting";
import { styles } from "../foundation/styles";
import { colors } from "../foundation/theme";
import { Toggle } from "../ui/controls";
import { nextRunLabelOf, runStateLabels, scheduleLabelOf } from "./ritualLabels";
import { ritualStyles } from "./ritualStyles";

const runStateColors = {
  Done: colors.successText,
  Failed: colors.dangerText,
  Interrupted: colors.textMuted,
  Underway: colors.accentText,
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
  isUnderway,
  ritualId,
}: {
  client: ServiceClient;
  /** Whether the Ritual's realm is archived, which keeps it from running. */
  isBlocked?: boolean;
  isUnderway: boolean;
  ritualId: RitualId;
}) {
  const [error, setError] = useState<string | null>(null);
  return (
    <View style={ritualStyles.runNow}>
      <Pressable
        accessibilityLabel="Run now"
        accessibilityRole="button"
        accessibilityState={{ disabled: isUnderway || isBlocked }}
        disabled={isUnderway || isBlocked}
        onPress={() => {
          setError(null);
          client.request({ _tag: "RunRitual", ritualId }).catch((reason) => setError(messageOf(reason)));
        }}
        style={[ritualStyles.runButton, (isUnderway || isBlocked) && styles.buttonDisabled]}
      >
        <Text style={ritualStyles.runButtonText}>Run now</Text>
      </Pressable>
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

/** Deletes the Ritual after one confirmation; its quest stays, as an ordinary quest (rituals). */
export function DeleteRitualButton({
  client,
  onError,
  ritualId,
}: {
  client: ServiceClient;
  onError: (message: string | null) => void;
  ritualId: RitualId;
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  if (!isConfirming) {
    return (
      <Pressable accessibilityRole="button" onPress={() => setIsConfirming(true)}>
        <Text style={ritualStyles.remove}>Delete</Text>
      </Pressable>
    );
  }
  return (
    <View style={ritualStyles.switch}>
      <Pressable
        accessibilityLabel="Confirm: delete the Ritual, keep its quest"
        accessibilityRole="button"
        onPress={() =>
          client.request({ _tag: "DeleteRitual", ritualId }).then(
            () => onError(null),
            (reason) => {
              setIsConfirming(false);
              onError(messageOf(reason));
            },
          )
        }
      >
        <Text style={ritualStyles.remove}>Confirm: delete the Ritual, keep its quest</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => setIsConfirming(false)}>
        <Text style={styles.link}>Cancel</Text>
      </Pressable>
    </View>
  );
}

/** A Ritual's Companion and its fallbacks in a line, such as "Sonnet 5.5 · Claude Code · 1 fallback". */
export const companionLineOf = (ritual: Ritual) =>
  [
    modelLabelOf(ritual.primary.model),
    harnessLabels[ritual.primary.harness],
    ...(ritual.fallbacks.length === 0
      ? []
      : [`${ritual.fallbacks.length} fallback${ritual.fallbacks.length === 1 ? "" : "s"}`]),
  ].join(" · ");

/** A Ritual as a card: its name, schedule, next and last run, Companion, and what can be done with it. */
export function RitualCard({
  client,
  onEdit,
  onOpen,
  ritual,
}: {
  client: ServiceClient;
  onEdit: () => void;
  onOpen: () => void;
  ritual: Ritual;
}) {
  const [error, setError] = useState<string | null>(null);
  return (
    <View style={[ritualStyles.card, !ritual.isOn && ritualStyles.cardOff]}>
      <Pressable accessibilityRole="button" onPress={onOpen} style={ritualStyles.cardTop}>
        <View style={ritualStyles.seal}>
          <Emblem name="moon" size={26} tint={colors.highlight} />
        </View>
        <View style={ritualStyles.cardText}>
          <Text numberOfLines={2} style={ritualStyles.cardTitle}>
            {ritual.title}
          </Text>
          <Text style={ritualStyles.cardSchedule}>{scheduleLabelOf(ritual.schedule)}</Text>
        </View>
      </Pressable>
      <View style={ritualStyles.facts}>
        <Text style={ritualStyles.fact}>{nextRunLabelOf(ritual.isOn ? ritual.nextRunAt : null, Date.now())}</Text>
        {ritual.lastRunState !== null && (
          <Text style={ritualStyles.fact}>
            Last run:{" "}
            <Text style={{ color: runStateColors[ritual.lastRunState] }}>{runStateLabels[ritual.lastRunState]}</Text>
          </Text>
        )}
        <Text style={ritualStyles.fact}>{companionLineOf(ritual)}</Text>
        {ritual.isRealmArchived && <Text style={ritualStyles.fact}>{realmArchivedNotice}</Text>}
      </View>
      <View style={ritualStyles.actions}>
        <RunNowButton
          client={client}
          isBlocked={ritual.isRealmArchived}
          isUnderway={ritual.lastRunState === "Underway"}
          ritualId={ritual.id}
        />
        <View style={ritualStyles.switch}>
          <Toggle
            isDisabled={ritual.isRealmArchived}
            onValueChange={(isOn) =>
              setRitualOn(client, ritual, isOn).then(
                () => setError(null),
                (reason) => setError(messageOf(reason)),
              )
            }
            value={ritual.isOn}
          />
          <Text style={ritualStyles.fact}>{ritual.isOn ? "On" : "Off"}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onOpen}>
          <Text style={styles.link}>Open</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onEdit}>
          <Text style={styles.link}>Edit</Text>
        </Pressable>
        <DeleteRitualButton client={client} onError={setError} ritualId={ritual.id} />
      </View>
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}
