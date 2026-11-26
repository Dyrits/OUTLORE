import type { MissionId, ThreadId } from "@outlore/contracts";
import type { QuestPage } from "../foundation/pageNavigation";
import type { RitualFormTarget } from "../rituals/ritualFormNavigation";
import { type SettingsSectionId, settingsSectionOf } from "../settings/settingsSections";
import { archiveParentOf, resumablePlaces } from "./navigation";
import type { RealmListing } from "./questTree";
import type { Place } from "./sidebar";

/** Where a quest opened in a narrow window returns to on Back: the channel or the Chronicle it was opened from. */
export type QuestOrigin = "channel" | "chronicle";

/** The window's destination, conversation page, and transient covering layers. */
export type Location = {
  place: Place;
  openMission: MissionId | null;
  openThread: ThreadId | null;
  selectedMission: MissionId | null;
  listedRealm: RealmListing | null;
  settingsSection: SettingsSectionId;
  isPermissionsOpen: boolean;
  guildmasterRealm: string | null;
  openCount: number;
  questReturn: QuestOrigin | null;
  listRequest: { tab: "quests" | "errands" } | null;
  page: QuestPage;
  /** The Ritual form covering the conversation area (CHG-0643), or null when none is. */
  ritualForm: RitualFormTarget | null;
  isChroniclerBudgetOpen: boolean;
  isMenuOpen: boolean;
  isNarrowChroniclerOpen: boolean;
  /** Where the owner was when the Workshop was opened from its icon; pressing the icon again goes back there. */
  workshopReturn: Location | null;
};

/** Events are the only way a page or frame changes the location. */
export type NavigationEvent =
  | { type: "place"; place: Place }
  | { type: "workshop" }
  | { type: "quest"; id: MissionId; origin?: QuestOrigin; shouldShowErrands?: boolean }
  | { type: "backFromQuest" }
  | { type: "thread"; missionId: MissionId; id: ThreadId | null; origin?: QuestOrigin }
  | { type: "select"; id: MissionId | null }
  | { type: "channel"; listing: RealmListing | null; shouldShowQuests?: boolean }
  | { type: "parent"; quest: { workspaceId: string | null; workspaceName: string | null } }
  | { type: "close" }
  | { type: "host" }
  | { type: "page"; page: QuestPage }
  | { type: "ritualForm"; target: RitualFormTarget | null }
  | { type: "permissions"; isOpen: boolean }
  | { type: "section"; section: SettingsSectionId }
  | { type: "chroniclerRealm"; path: string | null }
  | { type: "chroniclerBudget"; isOpen: boolean }
  | { type: "menu"; isOpen: boolean }
  | { type: "narrowChronicler"; isOpen: boolean };

/** Starts without a quest; only destinations independent of a saved selection resume. */
export const initialLocation = (resumed: string | null): Location => ({
  guildmasterRealm: null,
  isChroniclerBudgetOpen: false,
  isMenuOpen: false,
  isNarrowChroniclerOpen: false,
  isPermissionsOpen: false,
  listedRealm: null,
  listRequest: null,
  openCount: 0,
  openMission: null,
  openThread: null,
  page: null,
  place: resumablePlaces.find((place) => place === resumed) ?? "Home",
  questReturn: null,
  ritualForm: null,
  selectedMission: null,
  settingsSection: settingsSectionOf(resumed),
  workshopReturn: null,
});

const uncovered = (location: Location): Location => ({
  ...location,
  isChroniclerBudgetOpen: false,
  isMenuOpen: false,
  isNarrowChroniclerOpen: false,
  isPermissionsOpen: false,
  listRequest: null,
  page: null,
  questReturn: null,
  ritualForm: null,
});

/** The events that go to another destination, after which the Workshop icon no longer has a place to go back to. */
const leavingEvents: ReadonlyArray<NavigationEvent["type"]> = [
  "place",
  "quest",
  "thread",
  "close",
  "backFromQuest",
  "host",
  "channel",
  "parent",
];

/** Resolves navigation atomically so no newly opened destination remains behind an old layer. */
export const navigate = (location: Location, event: NavigationEvent): Location => {
  if (event.type === "workshop") {
    // Pressed while open, the icon closes the Workshop and returns to where the owner was before it.
    if (location.place === "Settings" && location.openMission === null)
      return location.workshopReturn ?? navigate(location, { place: "Home", type: "place" });
    return {
      ...navigate(location, { place: "Settings", type: "place" }),
      workshopReturn: { ...location, workshopReturn: null },
    };
  }
  const next = resolved(location, event);
  return leavingEvents.includes(event.type) ? { ...next, workshopReturn: null } : next;
};

const resolved = (location: Location, event: Exclude<NavigationEvent, { type: "workshop" }>): Location => {
  if (event.type === "place")
    return {
      ...uncovered(location),
      openMission: null,
      openThread: null,
      place: event.place,
      selectedMission: null,
      settingsSection: "permissions",
    };
  if (event.type === "quest")
    return {
      ...uncovered(location),
      listRequest: event.shouldShowErrands
        ? { tab: "errands" }
        : event.origin === "channel"
          ? location.listRequest
          : null,
      openCount: location.openCount + 1,
      openMission: event.id,
      openThread: null,
      questReturn: event.origin ?? null,
      selectedMission: null,
    };
  if (event.type === "thread")
    return {
      ...uncovered(location),
      openCount: location.openCount + (location.openMission === event.missionId ? 0 : 1),
      openMission: event.missionId,
      openThread: event.id,
      // An errand of the open quest keeps where the quest returns to; one opened from elsewhere carries its own origin.
      questReturn: event.origin ?? (location.openMission === event.missionId ? location.questReturn : null),
      selectedMission: null,
    };
  if (event.type === "backFromQuest")
    // A quest opened from the channel or the Chronicle returns there; any other opens the narrow window's menu.
    return location.questReturn === null
      ? { ...location, isMenuOpen: true, isNarrowChroniclerOpen: false }
      : {
          ...uncovered(location),
          ...(location.questReturn === "channel" ? { listRequest: location.listRequest } : {}),
          openMission: null,
          openThread: null,
        };
  if (event.type === "close") return { ...uncovered(location), openMission: null, openThread: null };
  if (event.type === "host")
    return {
      ...uncovered(location),
      guildmasterRealm: null,
      listedRealm: null,
      openMission: null,
      openThread: null,
      selectedMission: null,
    };
  if (event.type === "channel")
    return {
      ...resolved(location, { place: "Channel", type: "place" }),
      listedRealm: event.listing,
      listRequest: event.shouldShowQuests ? { tab: "quests" } : null,
    };
  if (event.type === "parent") {
    const parent = archiveParentOf(event.quest);
    return { ...resolved(location, { place: parent.place, type: "place" }), listedRealm: parent.listing };
  }
  if (event.type === "select") return { ...location, selectedMission: event.id };
  if (event.type === "page") return { ...location, page: event.page };
  // The form covers the conversation area without leaving the destination beneath it, so Back returns to what was
  // there; whatever was layered over that destination closes, as any newly opened screen's does.
  if (event.type === "ritualForm")
    return event.target === null
      ? { ...location, ritualForm: null }
      : { ...uncovered(location), ritualForm: event.target };
  if (event.type === "permissions") return { ...location, isPermissionsOpen: event.isOpen };
  if (event.type === "section") return { ...location, settingsSection: event.section };
  if (event.type === "chroniclerRealm")
    return {
      ...location,
      guildmasterRealm: event.path,
      ...(event.path === null ? {} : { isMenuOpen: false, isNarrowChroniclerOpen: true }),
    };
  if (event.type === "chroniclerBudget") return { ...location, isChroniclerBudgetOpen: event.isOpen };
  if (event.type === "menu") return { ...location, isMenuOpen: event.isOpen, isNarrowChroniclerOpen: false };
  return { ...location, isMenuOpen: false, isNarrowChroniclerOpen: event.isOpen };
};

/** The panel follows the destination and page, without copying the frame's layer state. */
export const panelScopeOf = (location: Location) => ({
  isPermissionsOpen: location.isPermissionsOpen,
  openCount: location.openCount,
  openMission: location.openMission,
  openThread: location.openThread,
  page: location.page,
  place: location.place,
  realm: location.place === "Channel" ? (location.listedRealm?.id ?? null) : null,
  section: location.place === "Settings" ? location.settingsSection : null,
});
