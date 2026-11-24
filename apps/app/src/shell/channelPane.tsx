import { type MissionId, WorkspaceId } from "@outlore/contracts";
import { type ReactNode, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ChroniclerConversation } from "../conversation/guildmaster";
import { PaneTabs } from "../conversation/paneTabs";
import type { ServiceClient } from "../foundation/client";
import { allMissions, listedMissions } from "../foundation/queries";
import { colors, fontSizes } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { LoreScreen } from "../lore/lore";
import { RealmPanel } from "../quests/questPanel";
import { ChannelQuests } from "./channelQuests";
import { childStatusOf } from "./childNotches";
import { childPartsOf, notchWidth } from "./paneNotches";
import { PaneNotches } from "./paneStrip";
import { useStartQuest } from "./useStartQuest";

export function ChannelPane({
  channel,
  chrome,
  client,
  listRequest,
  onBack,
  onOpenMission,
  openMission,
}: {
  channel: { id: string | null; name: string };
  chrome?: ReactNode;
  client: ServiceClient;
  /** A press on the Quests notch: each new object opens the Quests tab. */
  listRequest?: object | undefined;
  onBack?: (() => void) | undefined;
  onOpenMission: (id: MissionId) => void;
  openMission?: MissionId | undefined;
}) {
  return (
    <ChannelBody
      channel={channel}
      chrome={chrome}
      client={client}
      key={channel.id ?? "borderlands"}
      listRequest={listRequest}
      onBack={onBack}
      onOpenMission={onOpenMission}
      openMission={openMission}
    />
  );
}

/** A realm or Borderlands channel with no quest pane open. */
export function StandaloneChannel({
  channel,
  client,
  onOpenMission,
  questsRequest,
}: {
  channel: { id: string | null; name: string };
  client: ServiceClient;
  onOpenMission: (id: MissionId) => void;
  questsRequest: object | null;
}) {
  const { data } = useServiceQuery(client, listedMissions.request, listedMissions.key);
  const realmId = channel.id === null ? null : WorkspaceId.make(channel.id);
  const { failure, start } = useStartQuest(client, realmId, onOpenMission);
  const [notchRequest, setNotchRequest] = useState<{ after: object | null } | null>(null);
  const listRequest = notchRequest?.after === questsRequest ? notchRequest : questsRequest;
  const status = childStatusOf(
    (data?.missions ?? []).filter((mission) => mission.workspaceId === realmId && mission.ritual === null),
  );
  const parts = childPartsOf("quest", status, start, () => setNotchRequest({ after: questsRequest }));
  return (
    <View style={[local.fill, { paddingRight: notchWidth }]}>
      <ChannelPane
        channel={channel}
        client={client}
        listRequest={listRequest ?? void 0}
        onOpenMission={onOpenMission}
      />
      <QuestStartFailure failure={failure} />
      <PaneNotches parts={parts} side="right" />
    </View>
  );
}

export function QuestStartFailure({ failure }: { failure: string | null }) {
  return failure === null ? null : (
    <Text accessibilityRole="alert" style={local.failure}>
      {failure}
    </Text>
  );
}

const local = StyleSheet.create({
  failure: { bottom: 8, color: colors.dangerText, fontSize: fontSizes.xs, left: 12, position: "absolute" },
  fill: { flex: 1 },
});

/**
 * A channel's pane (conversation panes): Missives is its conversation, Quests lists the realm's quests in the same
 * pane. The tab resets with the channel, so each realm opens on its conversation.
 */
function ChannelBody({
  channel,
  chrome,
  client,
  listRequest,
  onBack,
  onOpenMission,
  openMission,
}: {
  channel: { id: string | null; name: string };
  chrome?: ReactNode;
  client: ServiceClient;
  listRequest?: object | undefined;
  onBack?: (() => void) | undefined;
  onOpenMission: (id: MissionId) => void;
  openMission?: MissionId | undefined;
}) {
  const [tab, setTab] = useState<"Missives" | "Quests" | "Realm" | "Rituals" | "Companions">(
    listRequest === undefined ? "Missives" : "Quests",
  );
  useEffect(() => {
    if (listRequest !== undefined) setTab("Quests");
  }, [listRequest]);
  const id = channel.id === null ? null : WorkspaceId.make(channel.id);
  const { data } = useServiceQuery(client, allMissions.request, allMissions.key);
  const realm = data?.workspaces.find((each) => each.id === id) ?? null;
  const [isLoreOpen, setLoreOpen] = useState(false);
  const realmPanel =
    realm === null ? undefined : isLoreOpen ? (
      <LoreScreen
        client={client}
        onBack={() => setLoreOpen(false)}
        threadId={null}
        title={`Lore · ${realm.name}`}
        workspaceId={realm.id}
      />
    ) : (
      <RealmPanel
        client={client}
        key={realm.id}
        missions={(data?.missions ?? []).filter((mission) => mission.workspaceId === realm.id)}
        onOpenLore={() => setLoreOpen(true)}
        onSelect={onOpenMission}
        realm={realm}
      />
    );
  return (
    <ChroniclerConversation
      alternateBody={
        tab === "Quests" || tab === "Rituals" ? (
          <ChannelQuests
            client={client}
            isTouch={onBack !== undefined}
            key={tab}
            onOpen={onOpenMission}
            openMission={openMission}
            realmId={id}
            show={tab}
          />
        ) : tab === "Realm" ? (
          realmPanel
        ) : undefined
      }
      channel={{ id, name: channel.name }}
      chrome={chrome}
      client={client}
      companions={{
        isSelected: tab === "Companions",
        onOpen: () => setTab(tab === "Companions" ? "Missives" : "Companions"),
      }}
      onBack={onBack}
      onOpenMission={onOpenMission}
      onRealm={() => {}}
      realmPath={null}
      tabs={
        <PaneTabs
          isTouch={onBack !== undefined}
          names={
            realm === null
              ? ["Missives", "Quests", "Rituals", "Companions"]
              : onBack !== undefined
                ? ["Missives", "Quests", "Rituals", "Realm", "Companions"]
                : ["Missives", "Realm", "Quests", "Rituals", "Companions"]
          }
          onSelect={setTab}
          selected={tab}
        />
      }
      viewing={{ screen: "Channel" }}
    />
  );
}
