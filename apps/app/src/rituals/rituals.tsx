import type { MissionId } from "@outlore/contracts";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { useServiceQuery } from "../foundation/useServiceQuery";
import {
  companionLineOf,
  DeleteRitualButton,
  RitualSwitch,
  RunNowButton,
  realmArchivedNotice,
  scheduleLineOf,
} from "./ritualCard";
import { useRitualFormNavigation } from "./ritualFormNavigation";
import { ritualStyles } from "./ritualStyles";

// Rituals in the interface (CHG-0616): a Ritual is one of its realm's things, drawn beside the quests, opened like a
// quest; its controls live in its panel, the details column beside its conversation — the form that makes or edits one.

/**
 * The Ritual's controls in its panel: its schedule and where its runs stand, Run now, the on or off switch, its link
 * to the quest it was made from, Edit, and Delete. Nothing else acts on a Ritual's conversation: its runs are its
 * only writers.
 */
export function RitualControls({
  client,
  missionId,
  onOpenMission,
}: {
  client: ServiceClient;
  missionId: MissionId;
  /** Opens another quest, such as the quest the Ritual was made from. */
  onOpenMission: (missionId: MissionId) => void;
}) {
  const { data: ritual } = useServiceQuery(client, { _tag: "ReadRitual", missionId }, `ritual:${missionId}`);
  const { open: openRitualForm } = useRitualFormNavigation();
  const [error, setError] = useState<string | null>(null);
  if (ritual === null) return null;
  // The origin quest, when the Ritual was scheduled from one: a link, nothing else inherited (CHG-0616).
  const origin = ritual.originMissionId;
  return (
    <View style={ritualStyles.controls}>
      {scheduleLineOf(ritual)}
      <Text style={ritualStyles.fact}>{companionLineOf(ritual)}</Text>
      {ritual.isRealmArchived && <Text style={ritualStyles.fact}>{realmArchivedNotice}</Text>}
      <RitualSwitch client={client} isDisabled={ritual.isRealmArchived} onError={setError} ritual={ritual} />
      <RunNowButton
        client={client}
        isBlocked={ritual.isRealmArchived}
        isUnderway={ritual.lastRunState === "Underway"}
        ritualId={ritual.id}
      />
      {origin !== null && (
        <View style={ritualStyles.sentence}>
          <Text style={styles.muted}>Made from</Text>
          <Pressable accessibilityRole="button" onPress={() => onOpenMission(origin)}>
            <Text style={styles.link}>the quest it came from</Text>
          </Pressable>
        </View>
      )}
      <View style={ritualStyles.sentence}>
        {/* The form opens as the conversation area's own screen (CHG-0643); this panel stays beside it. */}
        <Pressable accessibilityRole="button" onPress={() => openRitualForm({ kind: "edit", missionId })}>
          <Text style={styles.link}>Edit</Text>
        </Pressable>
        <DeleteRitualButton client={client} onError={setError} ritualId={ritual.id} title={ritual.title} />
      </View>
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}
