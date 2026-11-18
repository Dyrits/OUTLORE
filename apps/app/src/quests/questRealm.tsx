import type { MissionDetail } from "@outlore/contracts";
import { type ReactNode, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { allMissions } from "../foundation/queries";
import { colors, fontSizes, fonts, outline, radii } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { realmLabelOf } from "../realms/realmLabels";
import { MoveQuestModal } from "./moveQuestModal";
import { type Destination, type MoveConfirmation, moveConfirmationOf, noRealmDestination } from "./questMove";

/**
 * The quest panel's realm row: it names the realm the quest is in, and pressing it lists the other places the quest can
 * go, including out of its realm. It is the way to move a quest on a phone, and without dragging it in the sidebar.
 * Choosing a place asks for the same confirmation as a drop does; nothing moves before the owner confirms.
 */
export function QuestRealm({
  client,
  mission,
  renderRow,
}: {
  client: ServiceClient;
  mission: MissionDetail["mission"];
  /** Draws the row that opens the list, given what pressing it runs; the panel supplies its own row. */
  renderRow: (onPress: () => void) => ReactNode;
}) {
  const { data } = useServiceQuery(client, allMissions.request, allMissions.key);
  const [isChoosing, setIsChoosing] = useState(false);
  const [pending, setPending] = useState<{ confirmation: MoveConfirmation; destination: Destination } | null>(null);
  const realms = data?.workspaces ?? [];
  const places: ReadonlyArray<Destination> = [
    ...(mission.workspaceId === null ? [] : [noRealmDestination]),
    ...realms
      .filter((realm) => realm.id !== mission.workspaceId)
      .map((realm) => ({ id: realm.id, name: realmLabelOf(realm, realms) })),
  ];
  const choose = (destination: Destination) => {
    setIsChoosing(false);
    const confirmation = moveConfirmationOf(mission, destination);
    if (confirmation !== null) setPending({ confirmation, destination });
  };
  return (
    <>
      {renderRow(() => setIsChoosing(true))}
      {isChoosing && (
        <Modal animationType="fade" onRequestClose={() => setIsChoosing(false)} transparent visible>
          <View style={local.backdrop}>
            <Pressable
              accessibilityLabel="Close"
              onPress={() => setIsChoosing(false)}
              style={StyleSheet.absoluteFill}
            />
            <View style={local.menu}>
              <Text style={local.title}>Move "{mission.title}" to…</Text>
              {places.length === 0 && <Text style={local.empty}>There is no other place to move it to.</Text>}
              {places.map((place) => (
                <Pressable
                  accessibilityRole="button"
                  key={place.id ?? "none"}
                  onPress={() => choose(place)}
                  style={({ pressed }) => [local.option, pressed && local.pressed]}
                >
                  <Text style={local.optionText}>{place.id === null ? "No realm" : place.name}</Text>
                </Pressable>
              ))}
              <Pressable accessibilityRole="button" onPress={() => setIsChoosing(false)} style={local.option}>
                <Text style={local.optionText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
      {pending !== null && (
        <MoveQuestModal
          confirmation={pending.confirmation}
          onCancel={() => setPending(null)}
          onConfirm={() =>
            client.request({ _tag: "MoveQuest", missionId: mission.id, realmId: pending.destination.id })
          }
        />
      )}
    </>
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
  empty: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.md },
  menu: {
    ...outline,
    backgroundColor: colors.page,
    borderRadius: radii.xl,
    gap: 8,
    maxWidth: 420,
    padding: 20,
    width: "100%",
  },
  option: {
    ...outline,
    backgroundColor: colors.canvas,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  optionText: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "600" },
  pressed: { backgroundColor: colors.controlHover },
  title: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.lg, fontWeight: "700" },
});
