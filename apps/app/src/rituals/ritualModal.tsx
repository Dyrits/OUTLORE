import type { MissionId } from "@outlore/contracts";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { colors, radii } from "../foundation/theme";
import { RitualForm } from "./ritualForm";

/**
 * The menu that schedules a new Ritual in a realm (CHG-0616): the form, with the realm's folder already taken. saving
 * it opens the Ritual's conversation, where its runs will land; Cancel closes the form.
 */
export function NewRitualModal({
  client,
  onCancel,
  onDone,
  realmPath,
}: {
  client: ServiceClient;
  onCancel: () => void;
  /** Opens the Ritual's conversation once made. */
  onDone: (missionId: MissionId) => void;
  /** The folder of the realm whose quests the Ritual stands beside; null for a realm tied to no folder. */
  realmPath: string | null;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onCancel} transparent visible>
      <View style={local.backdrop}>
        <Pressable accessibilityLabel="Close" onPress={onCancel} style={StyleSheet.absoluteFill} />
        <ScrollView contentContainerStyle={local.menuContent} style={local.menu}>
          <View style={local.menu}>
            <RitualForm
              client={client}
              initialWorkspacePath={realmPath}
              onCancel={onCancel}
              onDone={(missionId) => {
                onCancel();
                onDone(missionId);
              }}
              ritual={null}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const local = StyleSheet.create({
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(5,10,18,0.7)",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  menu: {
    alignSelf: "stretch",
    backgroundColor: colors.page,
    borderRadius: radii.xl,
    gap: 12,
    maxWidth: 800,
    paddingBottom: 12,
    width: "100%",
  },
  menuContent: { padding: 20 },
});
