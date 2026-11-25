import type { MissionId, Viewing, WorkspaceId } from "@outlore/contracts";
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { ChroniclerChat } from "./chroniclerChat";
import { ChannelHeader } from "./chroniclerHeader";
import { chroniclerStyles as local } from "./chroniclerStyles";
import type { CompanionsTab } from "./companionsTabLayout";

/**
 * The Chronicle: Chronicler's one permanent conversation, the first pane of the window (CHG-0564).
 * It takes any request, looks for a quest that already fits, offers to continue it or proposes a new one as a card for the owner to open, and shows each quest it opened as a reply line under its message (quest coordination).
 * A realm chosen on a realm's page is attached to the next message.
 * `chrome` is the buttons at the end of its header: fold, or close on a narrow window.
 */
export function ChroniclerConversation({
  alternateBody,
  channel,
  chrome,
  client,
  companions,
  onBack,
  onOpenMission,
  onRealm,
  realmPath,
  tabs,
  viewing,
}: {
  /** Shown in place of the conversation and its composer, under the tabs (a realm's Quests tab); undefined shows the conversation. */
  alternateBody?: ReactNode;
  /** The buttons at the end of the header, which the pane that holds the conversation chooses. */
  channel?: { id: WorkspaceId | null; name: string } | undefined;
  chrome: ReactNode;
  client: ServiceClient;
  companions?: CompanionsTab | undefined;
  onBack?: (() => void) | undefined;
  onOpenMission: (id: MissionId) => void;
  onRealm: (path: string | null) => void;
  realmPath: string | null;
  /** The tabs under the header, which the pane that holds the conversation chooses. */
  tabs?: ReactNode;
  /** The screen the panel is open beside, which Chronicler reads with each message. */
  viewing: Viewing;
}) {
  const { data: place, error } = useServiceQuery(
    client,
    { _tag: "ReadGuildmaster", ...(channel === undefined ? {} : { channelId: channel.id }) },
    channel === undefined ? "guildmaster" : `channel:${channel.id ?? "borderlands"}`,
  );
  if (place === null)
    return (
      <View style={local.page}>
        {onBack !== undefined && <ChannelHeader name={channel?.name} onBack={onBack} />}
        <Text style={styles.muted}>{error ?? "Calling Chronicler…"}</Text>
      </View>
    );
  return (
    <ChroniclerChat
      alternateBody={alternateBody}
      channel={channel}
      chrome={chrome}
      client={client}
      companions={companions}
      key={place.threadId}
      onBack={onBack}
      onOpenMission={onOpenMission}
      onRealm={onRealm}
      place={place}
      realmPath={realmPath}
      tabs={tabs}
      viewing={viewing}
    />
  );
}
