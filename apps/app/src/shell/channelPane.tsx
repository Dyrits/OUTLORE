import { type MissionId, type ThreadId, WorkspaceId } from "@outlore/contracts";
import {
  type ComponentProps,
  createContext,
  type MutableRefObject,
  memo,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { StyleSheet, Text, View } from "react-native";
import { ChroniclerConversation } from "../conversation/guildmaster";
import { PaneTabs } from "../conversation/paneTabs";
import type { ServiceClient } from "../foundation/client";
import { allMissions, listedMissions } from "../foundation/queries";
import { colors, fontSizes } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { LoreScreen } from "../lore/lore";
import { RealmPanel } from "../quests/questPanel";
import { ChannelHistory } from "./channelHistory";
import { ChannelQuests } from "./channelQuests";
import { childStatusOf } from "./childNotches";
import { childPartsOf, notchWidth } from "./paneNotches";
import { PaneNotches } from "./paneStrip";
import { inRealmOf } from "./realmRoster";
import { useStartQuest } from "./useStartQuest";

/** The tabs of a channel's pane. */
export type ChannelTab = "Missives" | "Quests" | "Realm" | "Rituals" | "History" | "Companions";

/** The tab a channel's pane last showed, kept by the screen so the pane opened beside the next quest starts there. */
export type ChannelTabMemory = MutableRefObject<{ channelId: string | null; tab: ChannelTab } | null>;

/** The quest open beside the channel: only its Quests list marks it, so the rest of the pane need not render when it changes. */
const OpenMissionContext = createContext<MissionId | undefined>(void 0);

/** The channel's Quests and Rituals list, which marks the open quest. */
function OpenMissionQuests(props: Omit<ComponentProps<typeof ChannelQuests>, "openMission">) {
  return <ChannelQuests {...props} openMission={useContext(OpenMissionContext)} />;
}

export const ChannelPane = memo(function ChannelPane({
  channel,
  chrome,
  client,
  listRequest,
  onBack,
  onOpenMission,
  onOpenThread,
  openMission,
  tabMemory,
}: {
  channel: { id: string | null; name: string };
  chrome?: ReactNode;
  client: ServiceClient;
  /** A press on the Quests notch: each new object opens the Quests tab. */
  listRequest?: object | undefined;
  onBack?: (() => void) | undefined;
  onOpenMission: (id: MissionId) => void;
  /** Opens an errand of a quest, from the History tab. */
  onOpenThread: (missionId: MissionId, threadId: ThreadId) => void;
  openMission?: MissionId | undefined;
  tabMemory?: ChannelTabMemory | undefined;
}) {
  return (
    <OpenMissionContext.Provider value={openMission}>
      <ChannelBody
        channel={channel}
        chrome={chrome}
        client={client}
        key={channel.id ?? "borderlands"}
        listRequest={listRequest}
        onBack={onBack}
        onOpenMission={onOpenMission}
        onOpenThread={onOpenThread}
        tabMemory={tabMemory}
      />
    </OpenMissionContext.Provider>
  );
});

/** A realm or Borderlands channel with no quest pane open. */
export function StandaloneChannel({
  channel,
  client,
  onOpenMission,
  onOpenThread,
  questsRequest,
  tabMemory,
}: {
  channel: { id: string | null; name: string };
  client: ServiceClient;
  onOpenMission: (id: MissionId) => void;
  onOpenThread: (missionId: MissionId, threadId: ThreadId) => void;
  questsRequest: object | null;
  tabMemory?: ChannelTabMemory | undefined;
}) {
  const { data } = useServiceQuery(client, listedMissions.request, listedMissions.key);
  const realmId = channel.id === null ? null : WorkspaceId.make(channel.id);
  const { failure, start } = useStartQuest(client, realmId, onOpenMission);
  const [notchRequest, setNotchRequest] = useState<{ after: object | null } | null>(null);
  const listRequest = notchRequest?.after === questsRequest ? notchRequest : questsRequest;
  const status = childStatusOf(inRealmOf(data?.missions ?? [], realmId, "Quest"));
  const parts = childPartsOf("quest", status, start, () => setNotchRequest({ after: questsRequest }));
  return (
    <View style={[local.fill, { paddingRight: notchWidth }]}>
      <ChannelPane
        channel={channel}
        client={client}
        listRequest={listRequest ?? void 0}
        onOpenMission={onOpenMission}
        onOpenThread={onOpenThread}
        tabMemory={tabMemory}
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
 * pane, and History lists all of them by recency, with their errands. The tab resets with the channel, so each realm opens on its conversation, and stays when a quest opens.
 */
const ChannelBody = memo(function ChannelBody({
  channel,
  chrome,
  client,
  listRequest,
  onBack,
  onOpenMission,
  onOpenThread,
  tabMemory,
}: {
  channel: { id: string | null; name: string };
  chrome?: ReactNode;
  client: ServiceClient;
  listRequest?: object | undefined;
  onBack?: (() => void) | undefined;
  onOpenMission: (id: MissionId) => void;
  onOpenThread: (missionId: MissionId, threadId: ThreadId) => void;
  tabMemory?: ChannelTabMemory | undefined;
}) {
  // Opening a quest remounts the panes; the channel's pane starts on the tab it showed, if it is the same channel.
  const remembered = tabMemory?.current?.channelId === channel.id ? tabMemory.current.tab : null;
  const [tab, setTab] = useState<ChannelTab>(listRequest === undefined ? (remembered ?? "Missives") : "Quests");
  useEffect(() => {
    if (tabMemory !== undefined) tabMemory.current = { channelId: channel.id, tab };
  }, [tab, channel.id, tabMemory]);
  useEffect(() => {
    if (listRequest !== undefined) setTab("Quests");
  }, [listRequest]);
  const id = channel.id === null ? null : WorkspaceId.make(channel.id);
  const { data } = useServiceQuery(client, allMissions.request, allMissions.key);
  const realm = data?.workspaces.find((each) => each.id === id) ?? null;
  const [isLoreOpen, setLoreOpen] = useState(false);
  const openLore = useCallback(() => setLoreOpen(true), []);
  const closeLore = useCallback(() => setLoreOpen(false), []);
  const realmMissions = useMemo(
    () => (realm === null ? [] : (data?.missions ?? []).filter((mission) => mission.workspaceId === realm.id)),
    [data?.missions, realm],
  );
  const channelProp = useMemo(() => ({ id, name: channel.name }), [id, channel.name]);
  const realmPanel =
    realm === null ? undefined : isLoreOpen ? (
      <LoreScreen
        client={client}
        onBack={closeLore}
        threadId={null}
        title={`Lore · ${realm.name}`}
        workspaceId={realm.id}
      />
    ) : (
      <RealmPanel
        client={client}
        key={realm.id}
        missions={realmMissions}
        onOpenLore={openLore}
        onSelect={onOpenMission}
        realm={realm}
      />
    );
  return (
    <ChroniclerConversation
      alternateBody={
        tab === "Quests" || tab === "Rituals" ? (
          <OpenMissionQuests
            client={client}
            isTouch={onBack !== undefined}
            key={tab}
            onOpen={onOpenMission}
            realmId={id}
            show={tab}
          />
        ) : tab === "History" ? (
          <ChannelHistory
            client={client}
            isTouch={onBack !== undefined}
            onOpen={onOpenMission}
            onOpenThread={onOpenThread}
            realmId={id}
          />
        ) : tab === "Realm" ? (
          realmPanel
        ) : undefined
      }
      channel={channelProp}
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
              ? ["Missives", "Quests", "Rituals", "History", "Companions"]
              : onBack !== undefined
                ? ["Missives", "Quests", "Rituals", "History", "Realm", "Companions"]
                : ["Missives", "Realm", "Quests", "Rituals", "History", "Companions"]
          }
          onSelect={setTab}
          selected={tab}
        />
      }
      viewing={{ screen: "Channel" }}
    />
  );
});
