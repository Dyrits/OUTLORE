import type { MissionId, ThreadId } from "@outlore/contracts";
import { memo, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { type ChronicleTarget, ChronicleTargetContext } from "../conversation/chronicleTarget";
import { Conversation } from "../conversation/conversation";
import { PermissionsScreen } from "../editors/permissions";
import type { ServiceClient } from "../foundation/client";
import { CompanionDockActions, useHasSidebar } from "../foundation/shellContext";
import { LoreScreen } from "../lore/lore";
import { RitualFormScreen } from "../rituals/ritualFormScreen";
import { SettingsScreen } from "../settings/settings";
import type { SettingsSectionId } from "../settings/settingsSections";
import { UsageScreen } from "../usage";
import { ArchiveScreen } from "./archivePage";
import { ChannelPane, type ChannelTabMemory } from "./channelPane";
import { ChronicleActivity } from "./chronicleActivity";
import { HomeScreen } from "./homeScreen";
import type { QuestOrigin } from "./location";
import { PaneHost } from "./paneHost";
import type { RealmListing } from "./questTree";
import type { Place } from "./sidebar";

import type { windowViewOf } from "./windowView";

type Destination = ReturnType<typeof windowViewOf>;

/** Navigation operations exposed to the selected page, with top-level state kept in App. */
interface Navigation {
  backFromQuest: () => void;
  /** Closes the Ritual form covering the conversation area, going back to what showed beneath it. */
  closeRitualForm: () => void;
  goTo: (place: Place) => void;
  openChannel: (listing: RealmListing | null) => void;
  /** Shows the narrow window's Menu of places. */
  openMenu: () => void;
  /** Opens a quest; the origin says where its Back returns in a narrow window. */
  openMission: (id: MissionId, origin?: QuestOrigin) => void;
  /** Goes to a quest's parent view: its realm's channel, or the home screen for a quest in no realm. */
  openParent: (quest: { workspaceId: string | null; workspaceName: string | null }) => void;
  /** Shows the narrow window's Quests tab: the realms and their quests as a full screen. */
  openQuests: () => void;
  /** Opens a quest's errand; the origin says where its Back returns in a narrow window. */
  openThread: (missionId: MissionId, threadId: ThreadId, origin?: QuestOrigin) => void;
  selectMission: (id: MissionId | null) => void;
  selectThread: (id: ThreadId | null) => void;
  setPermissions: (isOpen: boolean) => void;
  setSettingsSection: (section: SettingsSectionId) => void;
  showDetails: (isOpen: boolean) => void;
}

/** Exhaustive destination rendering; adding a place requires choosing its screen at compile time. */
export const AppScreen = memo(function AppScreen({
  client,
  navigation,
  view,
}: {
  client: ServiceClient;
  navigation: Navigation;
  view: Destination;
}) {
  const [selection, setSelection] = useState<{ missionId: MissionId; target: ChronicleTarget } | null>(null);
  const opened = useRef<typeof selection>(null);
  useEffect(() => {
    if (selection === null) return;
    if (view.errandsRequest !== null || (opened.current === selection && view.openMission !== selection.missionId)) {
      opened.current = null;
      setSelection(null);
    } else if (view.openMission === selection.missionId) opened.current = selection;
  }, [selection, view.errandsRequest, view.openMission]);
  const target =
    selection !== null && selection.missionId === view.openMission && view.errandsRequest === null
      ? selection.target
      : null;
  return (
    <ChronicleTargetContext.Provider value={target}>
      <AppScreenContent
        client={client}
        navigation={navigation}
        onTarget={(missionId, target) => setSelection(target === null ? null : { missionId, target })}
        view={view}
      />
    </ChronicleTargetContext.Provider>
  );
});

function AppScreenContent({
  client,
  navigation,
  view,
  onTarget,
}: {
  client: ServiceClient;
  navigation: Navigation;
  view: Destination;
  onTarget: (missionId: MissionId, target: ChronicleTarget | null) => void;
}) {
  // Whether the realm's channel is open, as its own screen or as a pane: a quest opened next keeps it open.
  const isChannelOpen = useRef(false);
  const { openMission, place } = view;
  useEffect(() => {
    // The Workshop parks what is under it, so only a screen the owner left for another place closes the channel.
    if (openMission === null && place !== "Settings") isChannelOpen.current = place === "Channel";
  }, [openMission, place]);
  // The tab the channel's pane showed: the panes remount for each quest, and the channel stays on its tab.
  const channelTab: ChannelTabMemory = useRef(null);
  const setChannelOpen = useCallback((isOpen: boolean) => {
    isChannelOpen.current = isOpen;
  }, []);
  // A narrow window has no sidebar and shows a quest as one conversation at a time; a wide one shows panes.
  const hasPanes = useHasSidebar();
  // A place the Menu opened goes back to the Menu; a wide window has the Home screen to go back to.
  const leave = hasPanes ? () => navigation.goTo("Home") : navigation.openMenu;
  const home = <HomeScreen client={client} onOpen={navigation.openMission} />;
  const chronicle = (
    <ChronicleActivity
      client={client}
      onOpenChannel={navigation.openChannel}
      onOpenMission={(missionId, target) => {
        onTarget(missionId, target);
        navigation.openMission(missionId, "chronicle");
      }}
      onOpenThread={(missionId, threadId, target) => {
        onTarget(missionId, target);
        navigation.openThread(missionId, threadId, "chronicle");
      }}
    />
  );
  const screens = {
    Archived: <ArchiveScreen client={client} onOpen={navigation.openMission} />,
    Channel: home,
    Chronicle: chronicle,
    // The phone's first screen is its Chronicle tab (CHG-0760); the Home screen's start button is the wide window's.
    Home: hasPanes ? home : chronicle,
    Lore: <LoreScreen client={client} onBack={leave} threadId={null} title="All lore" />,
    Reserves: <UsageScreen client={client} />,
    Settings: view.isPermissionsOpen ? (
      <PermissionsScreen client={client} onBack={() => navigation.setPermissions(false)} />
    ) : (
      <SettingsScreen
        active={view.settingsSection}
        client={client}
        onBack={leave}
        onPermissions={() => navigation.setPermissions(true)}
        onSection={navigation.setSettingsSection}
      />
    ),
  } satisfies Record<Place, ReactNode>;
  // The Ritual form stands over the conversation area (CHG-0643): it is a screen of the middle panel, not a modal,
  // so it covers both the panes and the screens, and closing it returns to whatever was showing before it.
  const ritualForm =
    view.ritualForm === null ? null : (
      <RitualFormScreen
        client={client}
        onClose={navigation.closeRitualForm}
        onOpened={navigation.openMission}
        target={view.ritualForm}
      />
    );
  const quest =
    view.openMission === null
      ? view.parkedQuest
      : {
          errandsRequest: view.errandsRequest,
          openCount: view.openCount,
          openMission: view.openMission,
          openThread: view.openThread,
        };
  const { channel } = view;
  // The channel's identity, so the panes skip rendering while the same channel is listed.
  const channelId = channel?.id;
  const channelName = channel?.name;
  const listedChannel = useMemo(
    () => (channelName === undefined ? undefined : { id: channelId ?? null, name: channelName }),
    [channelId, channelName],
  );
  if ((quest !== null || channel !== null) && hasPanes) {
    // One host for the channel alone and for the channel beside a quest, so a quest opening or closing never remounts the
    // channel's pane. The Workshop covers the whole content area, and the panes wait beneath it as they were, then come
    // back (CHG-0563).
    const isParked = view.place !== "Channel" && view.openMission === null;
    return (
      <>
        <View style={isParked || view.ritualForm !== null ? local.parked : local.fill}>
          <CompanionDockActions.Provider value={null}>
            <PaneHost
              client={client}
              errandsRequest={quest?.errandsRequest ?? null}
              isChannelOpen={isChannelOpen.current || quest === null}
              isParked={isParked}
              listedChannel={listedChannel}
              missionId={quest?.openMission ?? null}
              onChannelOpen={setChannelOpen}
              onOpenErrand={navigation.openThread}
              onOpenMission={navigation.openMission}
              onOpenThread={navigation.selectThread}
              openCount={quest?.openCount ?? 0}
              openThread={quest?.openThread ?? null}
              questsRequest={quest === null ? (channel?.questsRequest ?? null) : null}
              tabMemory={channelTab}
            />
          </CompanionDockActions.Provider>
        </View>
        {view.ritualForm !== null ? ritualForm : isParked && screens[view.place]}
      </>
    );
  }
  const conversation =
    view.openMission === null ? null : (
      <Conversation
        client={client}
        initiallyShowErrands={view.errandsRequest !== null}
        key={`${view.openMission}:${view.openCount}`}
        missionId={view.openMission}
        onBack={navigation.backFromQuest}
        onOpenMission={(id) => navigation.openMission(id, view.questReturn ?? undefined)}
        onSelectThread={navigation.selectThread}
        onSetDetails={navigation.showDetails}
        selectedThreadId={view.openThread}
      />
    );
  if (!hasPanes && channel !== null) {
    const showsChannel = view.place === "Channel" && conversation === null && view.ritualForm === null;
    return (
      <>
        <View style={showsChannel ? local.fill : local.parked}>
          <ChannelPane
            channel={channel}
            client={client}
            listRequest={channel.questsRequest ?? void 0}
            onBack={navigation.openQuests}
            onOpenMission={(id) => navigation.openMission(id, "channel")}
            onOpenThread={(missionId, threadId) => navigation.openThread(missionId, threadId, "channel")}
            tabMemory={channelTab}
          />
        </View>
        {conversation !== null && (
          <View style={view.ritualForm === null ? local.fill : local.parked}>{conversation}</View>
        )}
        {ritualForm ?? (conversation === null && view.place !== "Channel" && screens[view.place])}
      </>
    );
  }
  if (conversation !== null) {
    // The Ritual form can cover the quest's conversation, which stays mounted beneath it (CHG-0643).
    return (
      <>
        <View style={view.ritualForm === null ? local.fill : local.parked}>{conversation}</View>
        {ritualForm}
      </>
    );
  }
  return view.ritualForm !== null ? ritualForm : screens[view.place];
}

const local = StyleSheet.create({
  fill: { flex: 1 },
  // Out of sight and out of the layout, but mounted: the panes keep their folds, shares and drafts for the way back.
  parked: { display: "none" },
});
