import type { ChronicleItem, MissionId, ThreadId } from "@outlore/contracts";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ChronicleTarget } from "../conversation/chronicleTarget";
import type { ServiceClient } from "../foundation/client";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import {
  attentionOf,
  type ChronicleConversation,
  conversationsOf,
  historyOf,
  needsAttentionOf,
  unreadOf,
} from "./chronicleFeed";
import { ChronicleRow } from "./chronicleRows";
import type { RealmListing } from "./questTree";
import { isHovered } from "./railStyles";

type Tab = "Attention" | "History";
/** The Attention view's filters (CHG-0569): everything the feed shows, only what is unread, or only what waits on the owner. */
const filters = ["All", "Unread", "Needs attention"] as const;
type Filter = (typeof filters)[number];

const emptyLines = {
  Attention: {
    hint: "A reply you have not read, a request that needs your answer, or a quest that failed, shows up here.",
    title: "Nothing is waiting for you.",
  },
  History: {
    hint: "Quests you start, move, finish or archive, and realms you open, show up here.",
    title: "Nothing has happened yet.",
  },
} as const satisfies Record<Tab, { hint: string; title: string }>;

/**
 * The Chronicle: what asks for the owner across every realm and quest, grouped by conversation (CHG-0569), and the
 * routine record beneath it. Reading a conversation marks its updates read; a request stays until answered.
 */
export function ChronicleActivity({
  client,
  onOpenChannel,
  onOpenMission,
  onOpenThread,
}: {
  client: ServiceClient;
  onOpenChannel: (realm: RealmListing) => void;
  onOpenMission: (id: MissionId, target: ChronicleTarget) => void;
  onOpenThread: (missionId: MissionId, threadId: ThreadId, target: ChronicleTarget | null) => void;
}) {
  const { data, error } = useServiceQuery(client, { _tag: "ReadChronicle" }, "chronicle-activity");
  const [tab, setTab] = useState<Tab>("Attention");
  const [filter, setFilter] = useState<Filter>("All");
  const open = (item: ChronicleItem) => {
    if (item.missionId !== null) {
      if (item.threadId === null)
        onOpenMission(item.missionId, { messageId: null, questionId: null, threadId: null, waitingAt: null });
      else
        onOpenThread(item.missionId, item.threadId, {
          messageId: item.messageId,
          questionId: item.questionId ?? null,
          threadId: item.threadId,
          waitingAt: item.kind === "Waiting" && item.questionId === undefined ? item.at : null,
        });
    } else if (item.realmId !== null) onOpenChannel({ id: item.realmId, name: item.title });
  };
  const openConversation = (conversation: ChronicleConversation) => {
    const item = conversation.items[0];
    if (item !== undefined) open(item);
  };
  const now = Date.now();
  const attentionItems = attentionOf(data ?? []);
  const needsItems = needsAttentionOf(attentionItems);
  const unreadItems = unreadOf(attentionItems);
  const feed = conversationsOf(
    filter === "Unread" ? unreadItems : filter === "Needs attention" ? needsItems : attentionItems,
  );
  const counts: Record<Filter, number> = {
    All: attentionItems.length,
    "Needs attention": needsItems.length,
    Unread: unreadItems.length,
  };
  const history = historyOf(data ?? [], now);
  const isEmpty = tab === "Attention" ? feed.length === 0 : history.length === 0;
  return (
    <ScrollView contentContainerStyle={local.content} style={local.page}>
      <Text accessibilityRole="header" style={local.title}>
        Chronicle
      </Text>
      <View accessibilityRole="tablist" style={local.tabs}>
        <TabButton
          count={needsItems.length}
          isSelected={tab === "Attention"}
          label="Attention"
          onPress={() => setTab("Attention")}
        />
        <TabButton count={0} isSelected={tab === "History"} label="History" onPress={() => setTab("History")} />
      </View>
      {tab === "Attention" && (
        <View accessibilityRole="tablist" style={local.filters}>
          {filters.map((each) => (
            <FilterButton
              count={counts[each]}
              isSelected={filter === each}
              key={each}
              label={each}
              onPress={() => setFilter(each)}
            />
          ))}
        </View>
      )}
      {error !== null && (
        <View accessibilityRole="alert" style={local.failure}>
          <Text style={local.failureTitle}>The Chronicle could not be read.</Text>
          <Text style={local.failureText}>{error}</Text>
        </View>
      )}
      {error === null && data === null && <Text style={local.hint}>Reading the Chronicle.</Text>}
      {data !== null && isEmpty && (
        <View style={local.empty}>
          <Text style={[local.emptyTitle, tab === "Attention" && filter !== "All" && local.emptyFiltered]}>
            {tab === "Attention" && filter !== "All" ? `Nothing here under ${filter}.` : emptyLines[tab].title}
          </Text>
          <Text style={local.hint}>{emptyLines[tab].hint}</Text>
        </View>
      )}
      {tab === "Attention" &&
        feed.map((conversation) => (
          <View key={conversation.key} style={local.conversation}>
            <Pressable accessibilityRole="button" onPress={() => openConversation(conversation)}>
              <Text numberOfLines={1} style={local.conversationTitle}>
                {conversation.heading}
              </Text>
            </Pressable>
            {conversation.items.map((item) => (
              <ChronicleRow isTitled={false} item={item} key={item.id} now={now} onPress={() => open(item)} />
            ))}
          </View>
        ))}
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

/** One of the two views. The count, when there is one, says how many entries still wait on the owner's answer. */
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

/** One of the Attention view's filters, with how many entries it holds. */
function FilterButton({
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
        local.filter,
        (state.pressed || isHovered(state)) && local.tabHovered,
        isSelected && local.filterSelected,
      ]}
    >
      <Text style={[local.filterText, isSelected && local.filterTextSelected]}>{label}</Text>
      {count > 0 && <Text style={local.filterCount}>{count}</Text>}
    </Pressable>
  );
}

const local = StyleSheet.create({
  content: { alignSelf: "stretch", gap: 16, maxWidth: 760, paddingHorizontal: 28, paddingVertical: 24, width: "100%" },
  conversation: { gap: 6 },
  conversationTitle: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
    fontWeight: "600",
    paddingHorizontal: 16,
  },
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
  emptyFiltered: { fontSize: fontSizes.md },
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
  filter: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 3,
  },
  filterCount: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.xs },
  filterSelected: { backgroundColor: colors.controlActive, borderColor: colors.borderStrong },
  filters: { alignSelf: "flex-start", flexDirection: "row", gap: 6 },
  filterText: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  filterTextSelected: { color: colors.text, fontWeight: "600" },
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
