import type { MissionId, Ritual } from "@outlore/contracts";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { messageOf, type ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { EmptyBoard } from "../ui/brand";
import { Toggle } from "../ui/controls";
import {
  companionLineOf,
  DeleteRitualButton,
  RitualCard,
  RunNowButton,
  realmArchivedNotice,
  setRitualOn,
} from "./ritualCard";
import { RitualForm } from "./ritualForm";
import { nextRunLabelOf, runStateLabels, scheduleLabelOf } from "./ritualLabels";
import { ritualStyles } from "./ritualStyles";

// Rituals in the interface: their own place, apart from the quests: a screen of cards, the form that makes or edits one,
// and its controls in the panel of its quest (rituals).

/** The Rituals, the latest first; they refetch when anything changes. */
export const useRituals = (client: ServiceClient) => useServiceQuery(client, { _tag: "ListRituals" }, "rituals").data;

/** The Rituals place: a button to make one, its form when open, and a card for each Ritual. */
export function RitualsScreen({
  client,
  onOpen,
}: {
  client: ServiceClient;
  /** Opens a Ritual's quest, where its runs happen. */
  onOpen: (missionId: MissionId) => void;
}) {
  const rituals = useRituals(client);
  // A Ritual being edited, a new one being made, or none.
  const [editing, setEditing] = useState<Ritual | "new" | null>(null);
  return (
    <View style={ritualStyles.page}>
      <ScrollView contentContainerStyle={ritualStyles.content}>
        <View style={ritualStyles.header}>
          <View style={ritualStyles.headerText}>
            <Text style={ritualStyles.heading}>Rituals</Text>
            <Text style={ritualStyles.subheading}>
              Standing orders that run by themselves, each in a quest of its own.
            </Text>
          </View>
          {editing === null && (
            <Pressable
              accessibilityLabel="New Ritual"
              accessibilityRole="button"
              onPress={() => setEditing("new")}
              style={styles.button}
            >
              <Text style={styles.buttonText}>+ New Ritual</Text>
            </Pressable>
          )}
        </View>
        {editing !== null && (
          <RitualForm
            client={client}
            key={editing === "new" ? "new" : editing.id}
            onCancel={() => setEditing(null)}
            onDone={(missionId) => {
              setEditing(null);
              if (editing === "new") onOpen(missionId);
            }}
            ritual={editing === "new" ? null : editing}
          />
        )}
        {rituals !== null && rituals.length === 0 && editing === null && (
          <EmptyBoard line="No Ritual yet. A Ritual sends an instruction to its own quest on a schedule." />
        )}
        <View style={ritualStyles.grid}>
          {(rituals ?? []).map((ritual) => (
            <RitualCard
              client={client}
              key={ritual.id}
              onEdit={() => setEditing(ritual)}
              onOpen={() => onOpen(ritual.missionId)}
              ritual={ritual}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/** The Ritual's controls in its quest's panel: its schedule, Run now, the switch, Edit, and Delete. */
export function RitualControls({ client, missionId }: { client: ServiceClient; missionId: MissionId }) {
  const { data: ritual } = useServiceQuery(client, { _tag: "ReadRitual", missionId }, `ritual:${missionId}`);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (ritual === null) return null;
  if (isEditing) {
    return (
      <RitualForm
        client={client}
        onCancel={() => setIsEditing(false)}
        onDone={() => setIsEditing(false)}
        ritual={ritual}
      />
    );
  }
  const guard = (work: Promise<unknown>) =>
    work.then(
      () => setError(null),
      (reason) => setError(messageOf(reason)),
    );
  return (
    <View style={ritualStyles.controls}>
      <Text style={ritualStyles.cardSchedule}>Ritual · {scheduleLabelOf(ritual.schedule)}</Text>
      <Text style={ritualStyles.fact}>
        {nextRunLabelOf(ritual.isOn ? ritual.nextRunAt : null, Date.now())}
        {ritual.lastRunState === null ? "" : ` · Last run: ${runStateLabels[ritual.lastRunState]}`}
      </Text>
      <Text style={ritualStyles.fact}>{companionLineOf(ritual)}</Text>
      {ritual.isRealmArchived && <Text style={ritualStyles.fact}>{realmArchivedNotice}</Text>}
      <View style={ritualStyles.switch}>
        <Toggle
          isDisabled={ritual.isRealmArchived}
          onValueChange={(isOn) => guard(setRitualOn(client, ritual, isOn))}
          value={ritual.isOn}
        />
        <Text style={styles.body}>{ritual.isOn ? "On" : "Off"}</Text>
      </View>
      <RunNowButton
        client={client}
        isBlocked={ritual.isRealmArchived}
        isUnderway={ritual.lastRunState === "Underway"}
        ritualId={ritual.id}
      />
      <View style={ritualStyles.switch}>
        <Pressable accessibilityRole="button" onPress={() => setIsEditing(true)}>
          <Text style={styles.link}>Edit</Text>
        </Pressable>
        <DeleteRitualButton client={client} onError={setError} ritualId={ritual.id} />
      </View>
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}
