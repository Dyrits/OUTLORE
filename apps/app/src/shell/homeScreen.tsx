import type { MissionId } from "@outlore/contracts";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { messageOf, newRequestId, type ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts } from "../foundation/theme";
import { Button } from "../ui/button";

/** What the window shows while no quest is open: the sidebar holds every realm and quest, so this only offers a start. */
export function HomeScreen({ client, onOpen }: { client: ServiceClient; onOpen: (id: MissionId) => void }) {
  const [isStarting, setStarting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const start = async () => {
    setStarting(true);
    setFailure(null);
    try {
      const quest = await client.request({ _tag: "StartEmptyQuest", realmId: null, requestId: newRequestId() });
      onOpen(quest.missionId);
    } catch (reason) {
      setFailure(messageOf(reason));
    } finally {
      setStarting(false);
    }
  };
  return (
    <View accessibilityLabel="Home" style={local.page}>
      <Text style={local.title}>Pick a quest in the sidebar, or start one.</Text>
      <Button isDisabled={isStarting} label="Start a new quest" onPress={() => void start()} />
      {failure !== null && <Text style={styles.error}>{failure}</Text>}
    </View>
  );
}

const local = StyleSheet.create({
  page: { alignItems: "center", backgroundColor: colors.page, flex: 1, gap: 14, justifyContent: "center", padding: 28 },
  title: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.md },
});
