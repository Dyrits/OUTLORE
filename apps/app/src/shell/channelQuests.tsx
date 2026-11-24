import type { MissionId, MissionSummary, WorkspaceId } from "@outlore/contracts";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { mobileIconTarget } from "../conversation/mobileHeader";
import { NewReplyCard, QuestCard, RitualReplyCard } from "../conversation/replyLine";
import type { ServiceClient } from "../foundation/client";
import { listedMissions } from "../foundation/queries";
import { styles } from "../foundation/styles";
import { useEnding } from "../foundation/useEnding";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { EndingConfirmation } from "../quests/missionActions";
import { ArchiveButton } from "../ui/archiveButton";
import { DoneButton } from "../ui/questHeaderButtons";
import { compareUrgency } from "./childNotches";
import { useStartQuest } from "./useStartQuest";

/**
 * The Quests and Rituals tabs list the corresponding work in the channel's realm or the Borderlands.
 * Pressing a card opens its conversation in the next pane.
 */
export function ChannelQuests({
  client,
  isTouch = false,
  onOpen,
  openMission,
  realmId,
  show,
}: {
  client: ServiceClient;
  isTouch?: boolean;
  onOpen: (missionId: MissionId) => void;
  openMission?: MissionId | undefined;
  realmId: WorkspaceId | null;
  show: "Quests" | "Rituals";
}) {
  const { data, error } = useServiceQuery(client, listedMissions.request, listedMissions.key);
  const { failure, isStarting, start } = useStartQuest(client, realmId, onOpen);
  const showRituals = show === "Rituals";
  const missions = (data?.missions ?? [])
    .filter((mission) => mission.workspaceId === realmId && (mission.ritual !== null) === showRituals)
    .sort(compareUrgency);
  return (
    <ScrollView contentContainerStyle={[local.list, isTouch && local.touchList]} style={local.page}>
      {!showRituals && <NewReplyCard isDisabled={isStarting} label="New quest" onPress={() => void start()} />}
      {failure !== null && (
        <Text accessibilityRole="alert" style={styles.error}>
          {failure}
        </Text>
      )}
      {error !== null && <Text style={styles.error}>{error}</Text>}
      {showRituals && data !== null && missions.length === 0 && <Text style={styles.muted}>No Rituals yet.</Text>}
      {missions.map((mission) =>
        mission.ritual === null ? (
          <ListedQuest
            client={client}
            isOpen={mission.id === openMission}
            isTouch={isTouch}
            key={mission.id}
            onOpen={() => onOpen(mission.id)}
            quest={mission}
          />
        ) : (
          <RitualReplyCard key={mission.id} onOpen={() => onOpen(mission.id)} ritual={mission} />
        ),
      )}
    </ScrollView>
  );
}

function ListedQuest({
  client,
  isOpen,
  isTouch,
  onOpen,
  quest,
}: {
  client: ServiceClient;
  isOpen: boolean;
  isTouch: boolean;
  onOpen: () => void;
  quest: MissionSummary;
}) {
  const ending = useEnding(client, quest, isOpen);
  const isDisabled = ending.isBusy || ending.pending !== null;
  const isDone = quest.state === "Fulfilled";
  return (
    <View>
      <QuestCard
        actions={
          <>
            <ArchiveButton
              isDelete={quest.isEmpty}
              isDisabled={isDisabled}
              label={`${quest.isEmpty ? "Delete" : "Archive"} ${quest.title}`}
              onPress={() => ending.start("Archived")}
              style={isTouch ? mobileIconTarget : null}
            />
            <DoneButton
              isDisabled={isDisabled}
              isDone={isDone}
              label={`${isDone ? "Mark as not done" : "Mark as done"}: ${quest.title}`}
              onPress={() =>
                isDone
                  ? ending.run(() => client.request({ _tag: "ReopenMission", missionId: quest.id }))
                  : ending.start("Fulfilled")
              }
              style={isTouch ? mobileIconTarget : null}
            />
          </>
        }
        label={`Open quest: ${quest.title}`}
        onOpen={onOpen}
        origin="Quest"
        quest={quest}
      />
      <EndingConfirmation ending={ending} />
      {ending.error !== null && (
        <Text accessibilityRole="alert" style={styles.error}>
          {ending.error}
        </Text>
      )}
    </View>
  );
}

const local = StyleSheet.create({
  list: { gap: 8, paddingBottom: 14, paddingHorizontal: 4, paddingTop: 8 },
  page: { flex: 1 },
  touchList: { gap: 12, paddingHorizontal: 8 },
});
