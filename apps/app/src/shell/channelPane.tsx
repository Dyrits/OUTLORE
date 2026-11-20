import { type MissionId, WorkspaceId } from "@outlore/contracts";
import { type ReactNode, useEffect, useState } from "react";
import { ChroniclerConversation } from "../conversation/guildmaster";
import { PaneTabs } from "../conversation/paneTabs";
import type { ServiceClient } from "../foundation/client";
import { allMissions } from "../foundation/queries";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { LoreScreen } from "../lore/lore";
import { RealmPanel } from "../quests/questPanel";
import { ChannelQuests } from "./channelQuests";

export const channelId = "channel" as const;

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
  const [tab, setTab] = useState<"Missives" | "Quests" | "Realm" | "Companions">("Missives");
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
