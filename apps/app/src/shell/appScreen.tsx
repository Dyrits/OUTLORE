import type { MissionId, ThreadId } from "@outlore/contracts";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { type ChronicleTarget, ChronicleTargetContext } from "../conversation/chronicleTarget";
import { Conversation } from "../conversation/conversation";
import { PermissionsScreen } from "../editors/permissions";
import type { ServiceClient } from "../foundation/client";
import { CompanionDockActions, useHasSidebar } from "../foundation/shellContext";
import { LoreScreen } from "../lore/lore";
import { RitualsScreen } from "../rituals/rituals";
import { SettingsScreen } from "../settings/settings";
import type { SettingsSectionId } from "../settings/settingsSections";
import { UsageScreen } from "../usage";
import { ArchiveScreen } from "./archivePage";
import { StandaloneChannel } from "./channelPane";
import { ChronicleActivity } from "./chronicleActivity";
import { HomeScreen } from "./homeScreen";
import { PaneHost } from "./paneHost";
import { QuestListScreen } from "./questListPage";
import type { RealmListing } from "./questTree";
import type { Place } from "./sidebar";

import type { windowViewOf } from "./windowView";

type Destination = ReturnType<typeof windowViewOf>;

/** Navigation operations exposed to the selected page, with top-level state kept in App. */
interface Navigation {
  goTo: (place: Place) => void;
  openChannel: (listing: RealmListing | null) => void;
  /** Shows the narrow window's main menu: the sidebar as a full screen. */
  openMenu: () => void;
  openMission: (id: MissionId) => void;
  /** Goes to a quest's parent view: its realm's quests, or the home screen for a quest in no realm. */
  openParent: (quest: { workspaceId: string | null; workspaceName: string | null }) => void;
  openRealm: (realm: RealmListing) => void;
  openThread: (missionId: MissionId, threadId: ThreadId) => void;
  selectMission: (id: MissionId | null) => void;
  selectThread: (id: ThreadId | null) => void;
  setPermissions: (isOpen: boolean) => void;
  setSettingsSection: (section: SettingsSectionId) => void;
  showDetails: (isOpen: boolean) => void;
}

/** Exhaustive destination rendering; adding a place requires choosing its screen at compile time. */
export function AppScreen({
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
}

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
  const quests = (listing: RealmListing) => (
    <QuestListScreen
      client={client}
      listing={listing}
      onOpen={navigation.openMission}
      onOpenThread={navigation.openThread}
    />
  );
  const home = <HomeScreen client={client} onOpen={navigation.openMission} />;
  const screens = {
    Archived: <ArchiveScreen client={client} onOpen={navigation.openMission} />,
    Channel: home,
    Chronicle: (
      <ChronicleActivity
        client={client}
        onOpenChannel={navigation.openChannel}
        onOpenMission={(missionId, target) => {
          onTarget(missionId, target);
          navigation.openMission(missionId);
        }}
        onOpenThread={(missionId, threadId, target) => {
          onTarget(missionId, target);
          navigation.openThread(missionId, threadId);
        }}
      />
    ),
    Home: home,
    Lore: <LoreScreen client={client} onBack={() => navigation.goTo("Home")} threadId={null} title="All lore" />,
    RealmQuests: view.listedRealm === null ? home : quests(view.listedRealm),
    Reserves: <UsageScreen client={client} />,
    Rituals: <RitualsScreen client={client} onOpen={navigation.openMission} />,
    Settings: view.isPermissionsOpen ? (
      <PermissionsScreen client={client} onBack={() => navigation.setPermissions(false)} />
    ) : (
      <SettingsScreen
        active={view.settingsSection}
        client={client}
        onBack={() => navigation.goTo("Home")}
        onPermissions={() => navigation.setPermissions(true)}
        onSection={navigation.setSettingsSection}
      />
    ),
  } satisfies Record<Place, ReactNode>;
  // A wide window shows a quest as a chain of panes; a narrow one keeps one conversation at a time.
  const hasPanes = useHasSidebar();
  const quest =
    view.openMission === null
      ? view.parkedQuest
      : {
          errandsRequest: view.errandsRequest,
          openCount: view.openCount,
          openMission: view.openMission,
          openThread: view.openThread,
        };
  if (quest !== null && hasPanes) {
    // The Workshop covers the whole content area, and the panes wait beneath it as they were, then come back (CHG-0563).
    const isParked = view.openMission === null;
    return (
      <>
        <View style={isParked ? local.parked : local.fill}>
          <CompanionDockActions.Provider value={null}>
            <PaneHost
              client={client}
              errandsRequest={quest.errandsRequest}
              isParked={isParked}
              key={`${quest.openMission}:${quest.openCount}`}
              missionId={quest.openMission}
              onOpenMission={navigation.openMission}
              onOpenThread={navigation.selectThread}
              openThread={quest.openThread}
            />
          </CompanionDockActions.Provider>
        </View>
        {isParked && screens[view.place]}
      </>
    );
  }
  if (view.openMission !== null)
    return (
      <Conversation
        client={client}
        initiallyShowErrands={view.errandsRequest !== null}
        key={`${view.openMission}:${view.openCount}`}
        missionId={view.openMission}
        // The Back of a quest shows only in a narrow window, which has no sidebar: it goes back to the main menu.
        onBack={navigation.openMenu}
        onOpenMission={navigation.openMission}
        onSelectThread={navigation.selectThread}
        onSetDetails={navigation.showDetails}
        selectedThreadId={view.openThread}
      />
    );
  const { channel } = view;
  if (hasPanes && channel !== null) {
    return (
      <>
        <View style={view.place === "Channel" ? local.fill : local.parked}>
          <CompanionDockActions.Provider value={null}>
            <StandaloneChannel
              channel={channel}
              client={client}
              key={channel.id ?? "borderlands"}
              onOpenMission={navigation.openMission}
              questsRequest={channel.questsRequest}
            />
          </CompanionDockActions.Provider>
        </View>
        {view.place !== "Channel" && screens[view.place]}
      </>
    );
  }
  return screens[view.place];
}

const local = StyleSheet.create({
  fill: { flex: 1 },
  // Out of sight and out of the layout, but mounted: the panes keep their folds, shares and drafts for the way back.
  parked: { display: "none" },
});
