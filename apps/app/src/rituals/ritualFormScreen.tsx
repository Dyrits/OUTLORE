import type { MissionId, Ritual } from "@outlore/contracts";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { RitualForm } from "./ritualForm";
import type { RitualFormTarget } from "./ritualFormNavigation";
import { ritualStyles } from "./ritualStyles";

/**
 * The Ritual form as the conversation area's own screen (CHG-0643): it stands over the panes, conversation, or screen
 * opened before it, Back returns to what was there, and the made or saved Ritual's conversation opens in its place.
 */
export function RitualFormScreen({
  client,
  onClose,
  onOpened,
  target,
}: {
  client: ServiceClient;
  /** Goes back to what showed before the form was opened. */
  onClose: () => void;
  /** Opens the made or saved Ritual's own conversation. */
  onOpened: (missionId: MissionId) => void;
  target: RitualFormTarget;
}) {
  return target.kind === "edit" ? (
    // An edited form waits for its Ritual, as its panel does, so it never flashes as a creation.
    <EditingRitualForm client={client} onClose={onClose} onOpened={onOpened} target={target} />
  ) : (
    <RitualFormBody client={client} onClose={onClose} onOpened={onOpened} ritual={null} target={target} />
  );
}

/** Reads the Ritual the form edits, before the form itself can show it. */
function EditingRitualForm({
  client,
  onClose,
  onOpened,
  target,
}: {
  client: ServiceClient;
  onClose: () => void;
  onOpened: (missionId: MissionId) => void;
  target: { kind: "edit"; missionId: MissionId };
}) {
  const { data: ritual } = useServiceQuery(
    client,
    { _tag: "ReadRitual", missionId: target.missionId },
    `ritual:${target.missionId}`,
  );
  if (ritual === null) return null;
  return <RitualFormBody client={client} onClose={onClose} onOpened={onOpened} ritual={ritual} target={null} />;
}

/** The form with its Back, filling the conversation area as a screen, so its fields stay readable at every width. */
function RitualFormBody({
  client,
  onClose,
  onOpened,
  ritual,
  target,
}: {
  client: ServiceClient;
  onClose: () => void;
  onOpened: (missionId: MissionId) => void;
  ritual: Ritual | null;
  /** Where a new Ritual begins, or null for the edit's own saved realm. */
  target: { kind: "create"; originMissionId: MissionId | null; realmPath: string | null } | null;
}) {
  return (
    <ScrollView contentContainerStyle={ritualStyles.content} style={ritualStyles.page}>
      <View style={styles.header}>
        <Pressable onPress={onClose}>
          <Text style={styles.link}>← Back</Text>
        </Pressable>
      </View>
      <RitualForm
        client={client}
        initialWorkspacePath={target?.realmPath ?? null}
        onCancel={onClose}
        onDone={onOpened}
        originMissionId={target?.originMissionId ?? null}
        ritual={ritual}
      />
    </ScrollView>
  );
}
