import type { MissionId, ThreadId } from "@outlore/contracts";
import type { ReactNode } from "react";
import { Conversation } from "../conversation/conversation";
import { PermissionsScreen } from "../editors/permissions";
import type { ServiceClient } from "../foundation/client";
import { LoreScreen } from "../lore/lore";
import { RitualsScreen } from "../rituals/rituals";
import { SettingsScreen } from "../settings/settings";
import type { SettingsSectionId } from "../settings/settingsSections";
import { UsageScreen } from "../usage";
import { ArchiveScreen } from "./archivePage";
import { HomeScreen } from "./homeScreen";
import { QuestListScreen } from "./questListPage";
import type { RealmListing } from "./questTree";
import type { Place } from "./sidebar";

/** The selected destination and its page-owned selection, without connection or frame state. */
type Destination = {
  isPermissionsOpen: boolean;
  listedRealm: RealmListing | null;
  openCount: number;
  openMission: MissionId | null;
  openThread: ThreadId | null;
  place: Place;
  selectedMission: MissionId | null;
  settingsSection: SettingsSectionId;
};

/** Navigation operations exposed to the selected page, with top-level state kept in App. */
interface Navigation {
  closeMission: () => void;
  goTo: (place: Place) => void;
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
  if (view.openMission !== null)
    return (
      <Conversation
        client={client}
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
  return screens[view.place];
}
