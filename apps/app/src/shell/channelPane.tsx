import { type MissionId, WorkspaceId } from "@outlore/contracts";
import { type ReactNode, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ChroniclerConversation } from "../conversation/guildmaster";
import { PaneTabs } from "../conversation/paneTabs";
import { messageOf, newRequestId, type ServiceClient } from "../foundation/client";
import { allMissions } from "../foundation/queries";
import { colors, fontSizes } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { LoreScreen } from "../lore/lore";
import { RealmPanel } from "../quests/questPanel";
import { ChannelQuests } from "./channelQuests";
import { childPartsOf, notchWidth } from "./paneNotches";
import { PaneNotches } from "./paneStrip";

export function ChannelPane({
  channel,
  chrome,
  client,
  listRequest,
  onOpenMission,
}: {
  channel: { id: string | null; name: string };
  chrome?: ReactNode;
  client: ServiceClient;
  /** A press on the "+N" notch: each new object opens the Quests tab. */
  listRequest?: object | undefined;
  onOpenMission: (id: MissionId) => void;
}) {
  return (
    <ChannelBody
      channel={channel}
      chrome={chrome}
      client={client}
      key={channel.id ?? "borderlands"}
      listRequest={listRequest}
      onOpenMission={onOpenMission}
    />
  );
}

/**
 * A realm's pane on its own, with no quest open. While the realm has no quest, a notch on its right edge, a sword with
 * a "+", starts one (conversation-panes, CHG-0604). While it has quests, they show there instead: one notch for each
 * active quest, as on any realm pane (CHG-0598).
 */
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
  const { data } = useServiceQuery(client, allMissions.request, allMissions.key);
  const [failure, setFailure] = useState<string | null>(null);
  // A "+N" notch asks the pane to open its Quests tab; a new object each press, so a second press asks again.
  const [notchRequest, setNotchRequest] = useState<{ after: object | null } | null>(null);
  const listRequest = notchRequest?.after === questsRequest ? notchRequest : questsRequest;
  const quests = (data?.missions ?? []).filter((mission) => mission.workspaceId === channel.id);
  const isEmpty = data !== undefined && data !== null && quests.length === 0;
  const start = () => {
    setFailure(null);
    client
      .request({
        _tag: "StartEmptyQuest",
        realmId: channel.id === null ? null : WorkspaceId.make(channel.id),
        requestId: newRequestId(),
      })
      .then((started) => onOpenMission(started.missionId))
      .catch((reason) => setFailure(messageOf(reason)));
  };
  const parts = childPartsOf(quests, new Set(), "quest", onOpenMission, () =>
    setNotchRequest({ after: questsRequest }),
  );
  return (
    <View style={[local.fill, (parts.length > 0 || isEmpty) && { paddingRight: notchWidth }]}>
      <ChannelPane
        channel={channel}
        client={client}
        listRequest={listRequest ?? void 0}
        onOpenMission={onOpenMission}
      />
      {failure !== null && <Text style={local.failure}>{failure}</Text>}
      {isEmpty ? (
        <PaneNotches
          parts={[{ id: "new-quest", isNew: true, kind: "quest", onReveal: start, state: null, title: "New quest" }]}
          side="right"
        />
      ) : (
        parts.length > 0 && <PaneNotches parts={parts} side="right" />
      )}
    </View>
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
  onOpenMission,
}: {
  channel: { id: string | null; name: string };
  chrome?: ReactNode;
  client: ServiceClient;
  listRequest?: object | undefined;
  onOpenMission: (id: MissionId) => void;
}) {
  const [tab, setTab] = useState<"Missives" | "Quests" | "Realm" | "Companions">(
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
        tab === "Quests" ? (
          <ChannelQuests client={client} onOpen={onOpenMission} realmId={id} />
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
      onOpenMission={onOpenMission}
      onRealm={() => {}}
      realmPath={null}
      tabs={
        <PaneTabs
          names={realm === null ? ["Missives", "Quests", "Companions"] : ["Missives", "Realm", "Quests", "Companions"]}
          onSelect={setTab}
          selected={tab}
        />
      }
      viewing={{ screen: "Channel" }}
    />
  );
}
