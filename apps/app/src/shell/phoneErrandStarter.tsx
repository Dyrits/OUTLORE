import type { MissionId, ThreadId } from "@outlore/contracts";
import { Pressable, StyleSheet, Text } from "react-native";
import { listedErrandsOf } from "../conversation/errandRoster";
import type { ServiceClient } from "../foundation/client";
import { colors, fontSizes } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { ErrandStarter } from "./errandStarter";

/**
 * The narrow window's New errand screen (CHG-0773): the errand starter beneath a quest, which a phone has no pane for.
 * Its ✕ closes it, and an errand opened from it, or one picked from its menu, shows in the quest's conversation.
 */
export function PhoneErrandStarter({
  client,
  missionId,
  onClose,
  onOpened,
}: {
  client: ServiceClient;
  missionId: MissionId;
  onClose: () => void;
  onOpened: (threadId: ThreadId) => void;
}) {
  // The quest's own thread, which the new errand hangs from; the quest's conversation reads it under the same key.
  const { data } = useServiceQuery(client, { _tag: "ReadMission", missionId, threadId: null }, `${missionId}:top`);
  return (
    <ErrandStarter
      chrome={
        <Pressable accessibilityLabel="Close" accessibilityRole="button" hitSlop={8} onPress={onClose}>
          <Text style={local.close}>✕</Text>
        </Pressable>
      }
      client={client}
      errands={listedErrandsOf(data?.threads ?? [])}
      onOpened={onOpened}
      parent={data?.thread ?? null}
    />
  );
}

const local = StyleSheet.create({
  close: { color: colors.highlight, fontSize: fontSizes.base, paddingHorizontal: 4 },
});
