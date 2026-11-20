import type { ChronicleItem, MissionId, ThreadId } from "@outlore/contracts";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { agoOf } from "../foundation/formatting";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
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

/** The ink and soft fill of each kind's badge, as the states read on the status marks. */
const tones = {
  Archived: { color: colors.textMuted, soft: colors.controlActive },
  Failed: { color: colors.dangerText, soft: colors.dangerSoft },
  Finished: { color: colors.successText, soft: colors.successSoft },
  QuestOpened: { color: colors.accentText, soft: colors.accentSoft },
  RealmOpened: { color: colors.accentText, soft: colors.accentSoft },
  Waiting: { color: colors.warningText, soft: colors.marker },
} satisfies Record<ChronicleItem["kind"], { color: string; soft: string }>;

/**
 * The Chronicle's activity (conversation panes), laid out as Slack's Activity tab: a title with a separator under it,
 * then one row per event with its badge, what happened, what it concerns, and how long ago, each row set off by a rule.
 * Pressing a row opens the quest, errand or realm it concerns.
 */
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
  const now = Date.now();
  return (
    <View style={local.page}>
      <View style={local.header}>
        <Text style={local.title}>Chronicle</Text>
      </View>
      <View style={local.separator} />
      <ScrollView>
        {error !== null && <Text style={[local.note, local.error]}>{error}</Text>}
        {data?.length === 0 && <Text style={local.note}>No activity yet.</Text>}
        {data?.map((item) => {
          const tone = tones[item.kind];
          return (
            <Pressable
              accessibilityRole="button"
              key={item.id}
              onPress={() => open(item)}
              style={({ pressed }) => [local.row, pressed && local.pressed]}
            >
              <View style={[local.badge, { backgroundColor: tone.soft }]}>
                <View style={[local.dot, { backgroundColor: tone.color }]} />
              </View>
              <View style={local.text}>
                <Text numberOfLines={1} style={local.label}>
                  {labels[item.kind]}
                </Text>
                <Text numberOfLines={1} style={local.detail}>
                  {item.title}
                </Text>
              </View>
              <Text style={local.time}>{agoOf(item.at, now)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const local = StyleSheet.create({
  badge: { alignItems: "center", borderRadius: radii.pill, height: 28, justifyContent: "center", width: 28 },
  detail: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.md },
  dot: { borderRadius: radii.pill, height: 8, width: 8 },
  error: { color: colors.dangerText },
  header: { paddingBottom: 12, paddingHorizontal: 16, paddingTop: 14 },
  label: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "600" },
  note: {
    color: colors.textMuted,
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  page: { backgroundColor: colors.page, flex: 1 },
  pressed: { backgroundColor: colors.controlActive },
  row: {
    alignItems: "center",
    borderBottomColor: colors.edge,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  separator: { backgroundColor: colors.edge, height: StyleSheet.hairlineWidth },
  text: { flex: 1, gap: 2, minWidth: 0 },
  time: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  title: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.lg, fontWeight: "700" },
});
