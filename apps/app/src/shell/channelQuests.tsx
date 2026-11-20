import type { MissionId, WorkspaceId } from "@outlore/contracts";
import { ScrollView, StyleSheet, Text } from "react-native";
import { QuestCard } from "../conversation/replyLine";
import type { ServiceClient } from "../foundation/client";
import { allMissions } from "../foundation/queries";
import { styles } from "../foundation/styles";
import { useServiceQuery } from "../foundation/useServiceQuery";

/**
 * The Quests tab of a channel (conversation panes): the quests of its realm, or of the Borderlands for the quests in no
 * realm, latest first. Each is a block with a sample of its last exchange; pressing one opens it in the next pane. The
 * list is part of the channel's own pane, not a pane of its own.
 */
export function ChannelQuests({
  channel,
  client,
  onOpen,
}: {
  channel: { id: WorkspaceId | null; name: string };
  client: ServiceClient;
  onOpen: (missionId: MissionId) => void;
}) {
  const { data, error } = useServiceQuery(client, allMissions.request, allMissions.key);
  const quests = (data?.missions ?? [])
    .filter((mission) => mission.workspaceId === channel.id)
    .sort((current, next) => next.lastActivityAt - current.lastActivityAt);
  return (
    <ScrollView contentContainerStyle={local.list} style={local.page}>
      {error !== null && <Text style={styles.error}>{error}</Text>}
      {data !== null && quests.length === 0 && <Text style={styles.muted}>No quest in {channel.name} yet.</Text>}
      {quests.map((quest) => (
        <QuestCard key={quest.id} label="Quest" onOpen={() => onOpen(quest.id)} origin="Quest" quest={quest} />
      ))}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  list: { gap: 8, paddingBottom: 14, paddingHorizontal: 4, paddingTop: 8 },
  page: { flex: 1 },
});
