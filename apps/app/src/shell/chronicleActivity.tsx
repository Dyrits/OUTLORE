import type { ChronicleItem, MissionId, ThreadId } from "@outlore/contracts";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { attentionOf, historyOf } from "./chronicleFeed";
import { ChronicleRow } from "./chronicleRows";
import type { RealmListing } from "./questTree";
import { isHovered } from "./railStyles";

type Tab = "Attention" | "History";

const emptyLines = {
  Attention: {
    hint: "A request that needs your answer, or a quest that failed, shows up here.",
    title: "Nothing is waiting for you.",
  },
  History: {
    hint: "Quests you start, finish or archive, and realms you open, show up here.",
    title: "Nothing has happened yet.",
  },
} as const satisfies Record<Tab, { hint: string; title: string }>;

/** The Chronicle: what needs the owner across every realm and quest, and the routine record beneath it. */
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
  const [tab, setTab] = useState<Tab>("Attention");
  const open = (item: ChronicleItem) => {
    if (item.missionId !== null) {
      if (item.threadId === null) onOpenMission(item.missionId);
      else onOpenThread(item.missionId, item.threadId);
    } else if (item.realmId !== null) onOpenChannel({ id: item.realmId, name: item.title });
  };
  const now = Date.now();
  const attention = attentionOf(data ?? []);
  const history = historyOf(data ?? [], now);
  const isEmpty = tab === "Attention" ? attention.length === 0 : history.length === 0;
  return (
    <ScrollView contentContainerStyle={local.content} style={local.page}>
      <Text accessibilityRole="header" style={local.title}>
        Chronicle
      </Text>
      <View accessibilityRole="tablist" style={local.tabs}>
        <TabButton
          count={attention.length}
          isSelected={tab === "Attention"}
          label="Needs attention"
          onPress={() => setTab("Attention")}
        />
        <TabButton count={0} isSelected={tab === "History"} label="History" onPress={() => setTab("History")} />
      </View>
      {error !== null && (
        <View accessibilityRole="alert" style={local.failure}>
          <Text style={local.failureTitle}>The Chronicle could not be read.</Text>
          <Text style={local.failureText}>{error}</Text>
        </View>
      )}
      {error === null && data === null && <Text style={local.hint}>Reading the Chronicle.</Text>}
      {data !== null && isEmpty && (
        <View style={local.empty}>
          <Text style={local.emptyTitle}>{emptyLines[tab].title}</Text>
          <Text style={local.hint}>{emptyLines[tab].hint}</Text>
        </View>
      )}
      {tab === "Attention" && (
        <View style={local.list}>
          {attention.map((item) => (
            <ChronicleRow item={item} key={item.id} now={now} onPress={() => open(item)} />
          ))}
        </View>
      )}
      {tab === "History" &&
        history.map((day) => (
          <View key={day.heading} style={local.day}>
            <Text style={local.heading}>{day.heading}</Text>
            {day.items.map((item) => (
              <ChronicleRow item={item} key={item.id} now={now} onPress={() => open(item)} />
            ))}
          </View>
        ))}
    </ScrollView>
  );
}

/** One of the two views. The count, when there is one, says how many entries ask for the owner. */
function TabButton({
  count,
  isSelected,
  label,
  onPress,
}: {
  count: number;
  isSelected: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={(state) => [
        local.tab,
        (state.pressed || isHovered(state)) && local.tabHovered,
        isSelected && local.tabSelected,
      ]}
    >
      <Text style={[local.tabText, isSelected && local.tabTextSelected]}>{label}</Text>
      {count > 0 && (
        <View style={local.count}>
          <Text style={local.countText}>{count}</Text>
        </View>
      )}
    </Pressable>
  );
}

const local = StyleSheet.create({
  content: { alignSelf: "stretch", gap: 16, maxWidth: 760, paddingHorizontal: 28, paddingVertical: 24, width: "100%" },
  count: {
    backgroundColor: colors.marker,
    borderColor: colors.warningText,
    borderRadius: radii.pill,
    borderWidth: 1,
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  countText: {
    color: colors.warningText,
    fontFamily: fonts.sans,
    fontSize: fontSizes.xs,
    fontWeight: "600",
    textAlign: "center",
  },
  day: { gap: 2 },
  empty: { gap: 4, paddingHorizontal: 16, paddingVertical: 12 },
  emptyTitle: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "600" },
  failure: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerText,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: 2,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  failureText: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fontSizes.md },
  failureTitle: { color: colors.dangerText, fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "600" },
  heading: {
    color: colors.textMuted,
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
    fontWeight: "600",
    paddingBottom: 4,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  hint: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.md, lineHeight: 20 },
  list: { gap: 10 },
  page: { backgroundColor: colors.page, flex: 1 },
  tab: {
    alignItems: "center",
    borderRadius: radii.md,
    flexDirection: "row",
    gap: 8,
    minHeight: 32,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  tabHovered: { backgroundColor: colors.controlHover },
  tabSelected: { backgroundColor: colors.controlActive },
  tabs: { alignSelf: "flex-start", flexDirection: "row", gap: 4 },
  tabText: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.base },
  tabTextSelected: { color: colors.text, fontWeight: "600" },
  title: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.title, fontWeight: "600", lineHeight: 28 },
});
