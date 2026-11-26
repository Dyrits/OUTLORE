import type { MissionId, ThreadId, WorkspaceId } from "@outlore/contracts";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { archivedMissions, listedMissions } from "../foundation/queries";
import { colors, fontSizes, fonts } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { EmptyBoard } from "../ui/brand";
import { ToggleRow } from "../ui/toggleRow";
import { QuestTreeLines } from "./questListRows";
import { historyQuestsOf, recencyGroupsOf } from "./questRecency";
import { toggledFold } from "./questTree";

/**
 * The History tab of a channel's pane: every quest of the realm or the Borderlands, latest first by the quest's own
 * activity, under Today, Yesterday, and the months, each with its errands (CHG-0686).
 */
export function ChannelHistory({
  client,
  isTouch = false,
  onOpen,
  onOpenThread,
  realmId,
}: {
  client: ServiceClient;
  isTouch?: boolean;
  onOpen: (missionId: MissionId) => void;
  /** Opens an errand of a quest. */
  onOpenThread: (missionId: MissionId, threadId: ThreadId) => void;
  realmId: WorkspaceId | null;
}) {
  const { data: settings } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  // Quests start unfolded here, so their errands show; the owner folds any quest or errand.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) => setCollapsed((current) => toggledFold(current, id));
  const { data } = useServiceQuery(client, listedMissions.request, listedMissions.key);
  // Archived quests stay out until the owner asks; they are read from the Archived view and drawn among the rest.
  const [isArchivedShown, setIsArchivedShown] = useState(false);
  const { data: archived } = useServiceQuery(client, archivedMissions.request, archivedMissions.key);
  // The realm's things: its quests and, beside them, its Rituals (CHG-0616).
  const missions = historyQuestsOf(data?.missions ?? [], archived?.missions ?? [], realmId, isArchivedShown);
  const archivedIds: ReadonlySet<string> = new Set((archived?.missions ?? []).map((mission) => mission.id));
  const now = Date.now();
  return (
    <ScrollView contentContainerStyle={[local.content, isTouch && local.touchContent]} style={local.page}>
      <ToggleRow label="Show archived quests" onChange={setIsArchivedShown} value={isArchivedShown} />
      {data !== null && data !== undefined && missions.length === 0 && (
        <EmptyBoard line={realmId === null ? "No quest here yet." : "No quest in this realm yet."} />
      )}
      {recencyGroupsOf(missions, now).map((group) => (
        <View key={group.heading} style={local.group}>
          <Text style={local.heading}>{group.heading}</Text>
          {group.quests.map((mission) => (
            <QuestTreeLines
              client={client}
              collapsed={collapsed}
              isArchived={archivedIds.has(mission.id)}
              key={mission.id}
              mission={mission}
              now={now}
              onOpen={onOpen}
              onOpenThread={onOpenThread}
              onToggle={toggle}
              realms={data?.workspaces ?? []}
              shouldShowAgentThreads={settings?.shouldShowAgentThreads ?? true}
            />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  content: { gap: 22, paddingHorizontal: 8, paddingVertical: 12 },
  group: { gap: 2 },
  heading: {
    color: colors.textMuted,
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
    fontWeight: "600",
    paddingBottom: 6,
  },
  page: { flex: 1 },
  touchContent: { paddingHorizontal: 12 },
});
