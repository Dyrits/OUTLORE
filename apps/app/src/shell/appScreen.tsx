import type { MissionId, ThreadId } from "@outlore/contracts";
import type { ReactNode } from "react";
import { Conversation } from "../conversation/conversation";
import { PermissionsScreen } from "../editors/permissions";
import type { ServiceClient } from "../foundation/client";
import { LoreScreen } from "../lore/lore";
import { RitualsScreen } from "../rituals/rituals";
import { SettingsScreen } from "../settings/settings";
import type { SettingsSectionId } from "../settings/settingsSections";
import { ArchiveScreen } from "./archivePage";
import { QuestListScreen } from "./questListPage";
import type { RealmListing } from "./questTree";
import { RealmsScreen } from "./realmsPage";
import type { Place } from "./sidebar";
import { UsageScreen } from "./usagePage";

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
  openMission: (id: MissionId) => void;
  /** Goes to a quest's parent view: its realm's quests, or the Realms overview for a quest in no realm. */
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
        onBack={(quest) => (quest === null ? navigation.closeMission() : navigation.openParent(quest))}
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
  const realms = (
    <RealmsScreen
      client={client}
      onOpen={navigation.openMission}
      onOpenRealm={navigation.openRealm}
      onOpenThread={navigation.openThread}
    />
  );
  const screens = {
    Archived: <ArchiveScreen client={client} onOpen={navigation.openMission} />,
    Lore: <LoreScreen client={client} onBack={() => navigation.goTo("Realms")} threadId={null} title="All lore" />,
    RealmQuests: view.listedRealm === null ? realms : quests(view.listedRealm),
    Realms: realms,
    Reserves: <UsageScreen client={client} />,
    Rituals: <RitualsScreen client={client} onOpen={navigation.openMission} />,
    Settings: view.isPermissionsOpen ? (
      <PermissionsScreen client={client} onBack={() => navigation.setPermissions(false)} />
    ) : (
      <SettingsScreen
        active={view.settingsSection}
        client={client}
        onBack={() => navigation.goTo("Realms")}
        onPermissions={() => navigation.setPermissions(true)}
        onSection={navigation.setSettingsSection}
      />
    ),
  } satisfies Record<Place, ReactNode>;
  return screens[view.place];
}
