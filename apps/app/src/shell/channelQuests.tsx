import type { MissionId, WorkspaceId } from "@outlore/contracts";
import { useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { NewReplyCard, QuestCard, RitualReplyCard } from "../conversation/replyLine";
import { messageOf, newRequestId, type ServiceClient } from "../foundation/client";
import { listedMissions } from "../foundation/queries";
import { styles } from "../foundation/styles";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { compareUrgency } from "./childNotches";

/** Where work that is over sits in the list: after the active quests, which read by urgency. */

/**
 * The Quests tab of a channel (conversation panes): the quests of its realm, or of the Borderlands for the quests in no
 * realm, most urgent first and work that is over last. Each is a block with a sample of its last exchange; pressing one
 * opens it in the next pane. The list is part of the channel's own pane, not a pane of its own.
 */
export function ChannelQuests({
  client,
  onOpen,
  realmId,
}: {
  client: ServiceClient;
  onOpen: (missionId: MissionId) => void;
  realmId: WorkspaceId | null;
}) {
  const { data, error } = useServiceQuery(client, listedMissions.request, listedMissions.key);
  const [isStarting, setStarting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const start = async () => {
    setStarting(true);
    setFailure(null);
    try {
      const quest = await client.request({ _tag: "StartEmptyQuest", realmId, requestId: newRequestId() });
      onOpen(quest.missionId);
    } catch (reason) {
      setFailure(messageOf(reason));
    } finally {
      setStarting(false);
    }
  };
  // The realm's quests read most urgent first (mission-tracking, Mission state), work that is over at the end; its
  // Rituals keep their place among them (CHG-0616).
  const missions = (data?.missions ?? []).filter((mission) => mission.workspaceId === realmId).sort(compareUrgency);
  return (
    <ScrollView contentContainerStyle={local.list} style={local.page}>
      <NewReplyCard isDisabled={isStarting} label="New quest" onPress={() => void start()} />
      {failure !== null && (
        <Text accessibilityRole="alert" style={styles.error}>
          {failure}
        </Text>
      )}
      {error !== null && <Text style={styles.error}>{error}</Text>}
      {missions.map((mission) =>
        mission.ritual === null ? (
          <QuestCard key={mission.id} label="Quest" onOpen={() => onOpen(mission.id)} origin="Quest" quest={mission} />
        ) : (
          <RitualReplyCard key={mission.id} onOpen={() => onOpen(mission.id)} ritual={mission} />
        ),
      )}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  list: { gap: 8, paddingBottom: 14, paddingHorizontal: 4, paddingTop: 8 },
  page: { flex: 1 },
});
