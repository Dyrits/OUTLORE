import type { ChronicleItem, MissionId, ThreadId } from "@outlore/contracts";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { agoOf } from "../foundation/formatting";
import { styles } from "../foundation/styles";
import { useServiceQuery } from "../foundation/useServiceQuery";
import type { RealmListing } from "./questTree";

const labels = {
  Archived: "Quest archived",
  Failed: "Needs attention after a failure",
  Finished: "Quest finished",
  QuestOpened: "Quest opened",
  RealmOpened: "Realm opened",
  Waiting: "Waiting for your answer",
} satisfies Record<ChronicleItem["kind"], string>;

export function ChronicleActivity({
  client,
  onOpenChannel,
  onOpenMission,
  onOpenThread,
}: {
  client: ServiceClient;
  onOpenChannel: (realm: RealmListing) => void;
  onOpenMission: (id: MissionId) => void;
  onOpenThread: (missionId: MissionId, threadId: ThreadId) => void;
}) {
  const { data, error } = useServiceQuery(client, { _tag: "ReadChronicle" }, "chronicle-activity");
  const open = (item: ChronicleItem) => {
    if (item.missionId !== null) {
      if (item.threadId === null) onOpenMission(item.missionId);
      else onOpenThread(item.missionId, item.threadId);
    } else if (item.realmId !== null) onOpenChannel({ id: item.realmId, name: item.title });
  };
  return (
    <ScrollView contentContainerStyle={styles.feed}>
      <View style={styles.header}>
        <Text style={styles.muted}>Chronicle</Text>
      </View>
      {error !== null && <Text style={styles.error}>{error}</Text>}
      {data?.length === 0 && <Text style={styles.muted}>No activity yet.</Text>}
      {data?.map((item) => (
        <Pressable accessibilityRole="button" key={item.id} onPress={() => open(item)}>
          <Text style={styles.muted}>
            {labels[item.kind]} · {item.title} · {agoOf(item.at, Date.now())}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
