import { type MissionId, WorkspaceId } from "@outlore/contracts";
import type { ReactNode } from "react";
import { ChroniclerConversation } from "../conversation/guildmaster";
import type { ServiceClient } from "../foundation/client";

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
    <ChroniclerConversation
      channel={{ ...channel, id: channel.id === null ? null : WorkspaceId.make(channel.id) }}
      chrome={chrome}
      client={client}
      key={channel.id ?? "borderlands"}
      onOpenMission={onOpenMission}
      onRealm={() => {}}
      realmPath={null}
      viewing={{ screen: "Channel" }}
    />
  );
}
