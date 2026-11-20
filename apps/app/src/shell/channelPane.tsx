import { type MissionId, WorkspaceId } from "@outlore/contracts";
import { type ReactNode, useState } from "react";
import { ChroniclerConversation } from "../conversation/guildmaster";
import { PaneTabs } from "../conversation/paneTabs";
import type { ServiceClient } from "../foundation/client";
import { ChannelQuests } from "./channelQuests";

export const channelId = "channel" as const;

export function ChannelPane({
  channel,
  chrome,
  client,
  onOpenMission,
}: {
  channel: { id: string | null; name: string };
  chrome?: ReactNode;
  client: ServiceClient;
  onOpenMission: (id: MissionId) => void;
}) {
  return (
    <ChannelBody
      channel={channel}
      chrome={chrome}
      client={client}
      key={channel.id ?? "borderlands"}
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
  onOpenMission,
}: {
  channel: { id: string | null; name: string };
  chrome?: ReactNode;
  client: ServiceClient;
  onOpenMission: (id: MissionId) => void;
}) {
  const [tab, setTab] = useState<"Missives" | "Quests" | "Companions">("Missives");
  const id = channel.id === null ? null : WorkspaceId.make(channel.id);
  return (
    <ChroniclerConversation
      alternateBody={
        tab === "Quests" ? <ChannelQuests client={client} onOpen={onOpenMission} realmId={id} /> : undefined
      }
      channel={{ id, name: channel.name }}
      chrome={chrome}
      client={client}
      companions={{ isSelected: tab === "Companions", onOpen: () => setTab("Companions") }}
      onOpenMission={onOpenMission}
      onRealm={() => {}}
      realmPath={null}
      tabs={<PaneTabs names={["Missives", "Quests", "Companions"]} onSelect={setTab} selected={tab} />}
      viewing={{ screen: "Channel" }}
    />
  );
}
