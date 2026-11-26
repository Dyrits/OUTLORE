import type { Location, NavigationEvent } from "./location";
import type { PhoneRealm, PhoneTab } from "./phoneSelection";
import { menuPlaces, type Place } from "./placeCatalog";

export type { PhoneTab } from "./phoneSelection";

// The phone shell (CHG-0773): a floating bar of tabs over the narrow window that grows as the owner chooses, and a side
// menu of the other places. The rules of what shows, which tab is lit and what Back does are plain functions, so they
// run in Node and the frame only draws what they say.

/** The tabs in the bar's order, with the name each carries (the Chronicle shows its icon alone). */
export const phoneTabs: ReadonlyArray<{ id: PhoneTab; label: string }> = [
  { id: "chronicle", label: "Chronicle" },
  { id: "realms", label: "Realms" },
  { id: "quests", label: "Quests" },
  { id: "errands", label: "Errands" },
];

/** The narrow window as the location and the quest panel make it. */
export type PhoneShell = {
  /** Whether the bar shows: not under a form or the quest panel, which have their own buttons. */
  hasBar: boolean;
  /** Whether the content keeps clear of the bar because it cannot scroll beneath it, as a conversation, whose composer sits above it. */
  isClearOfBar: boolean;
  /** The tab that is lit, or null on a screen that belongs to none (the places of the side menu). */
  tab: PhoneTab | null;
  /** What the top bar names, or null where the conversation's own header does. */
  title: string | null;
};

/** The screens that scroll beneath the bar with room left at their foot; any other screen is kept clear of it. */
const scrollsBeneathBar: ReadonlySet<Place> = new Set(["Home", "Chronicle", "Archived", "Lore", "Reserves"]);

const withoutBar: PhoneShell = { hasBar: false, isClearOfBar: false, tab: null, title: null };

/** Says what the narrow window shows: whether the bar does, the lit tab, and the top bar's title. `showsDetails` is whether the quest's side panel takes the content's place. */
export const phoneShellOf = (location: Location, showsDetails: boolean): PhoneShell => {
  if (location.ritualForm !== null || showsDetails) return withoutBar;
  if (location.isErrandStarterOpen && location.openMission !== null)
    return { hasBar: false, isClearOfBar: false, tab: null, title: "New errand" };
  if (location.openMission !== null)
    return {
      hasBar: true,
      isClearOfBar: true,
      tab: location.openThread === null ? "quests" : "errands",
      title: null,
    };
  const { place } = location;
  if (place === "Channel") return { hasBar: true, isClearOfBar: true, tab: "realms", title: null };
  const isOnChronicle = place === "Home" || place === "Chronicle";
  // A place the side menu opened is named in the top bar.
  const menuPlace = menuPlaces.find((entry) => entry.place === place);
  return {
    hasBar: true,
    isClearOfBar: !scrollsBeneathBar.has(place),
    tab: isOnChronicle ? "chronicle" : null,
    title: isOnChronicle ? "Chronicle" : (menuPlace?.label ?? null),
  };
};

/** What the phone's Back (the hardware button or gesture) asks: a navigation event, closing the chooser sheet, or closing the quest panel. */
export type PhoneBack = NavigationEvent | { type: "closeChooser" } | { type: "closeDetails" };

/**
 * What Back does on the phone: it peels the topmost layer or goes up one level, so it never leaves the app from a
 * screen that has somewhere to go back to: an errand to its quest, a quest to its realm's chat (or the Chronicle it was
 * opened from), a realm's chat and a place of the side menu to the Chronicle. Null on the Chronicle, the root, where
 * Back leaves the app. `realm` is the realm the bar holds, which a quest returns to.
 */
export const phoneBackOf = (
  location: Location,
  showsDetails: boolean,
  realm: PhoneRealm | null,
  isChooserOpen = false,
): PhoneBack | null => {
  if (location.isMenuOpen) return { isOpen: false, type: "menu" };
  if (isChooserOpen) return { type: "closeChooser" };
  if (location.ritualForm !== null) return { target: null, type: "ritualForm" };
  if (location.isErrandStarterOpen) return { isOpen: false, type: "errandStarter" };
  if (location.isChroniclerBudgetOpen) return { isOpen: false, type: "chroniclerBudget" };
  if (showsDetails) return { type: "closeDetails" };
  if (location.openMission !== null) {
    if (location.page !== null) return { page: null, type: "page" };
    if (location.openThread !== null) return { id: null, missionId: location.openMission, type: "thread" };
    if (location.questReturn === "chronicle" || realm === null) return { type: "backFromQuest" };
    return { quest: { workspaceId: realm.id, workspaceName: realm.id === null ? null : realm.name }, type: "parent" };
  }
  if (location.isPermissionsOpen) return { isOpen: false, type: "permissions" };
  const { place } = location;
  if (place === "Channel" || menuPlaces.some((entry) => entry.place === place))
    return { place: "Chronicle", type: "place" };
  return null;
};

/** What choosing the Chronicle tab asks of the window: the other tabs choose through `tappedTabOf`. */
export const chronicleEvent: NavigationEvent = { place: "Chronicle", type: "place" };

/** The bar's height. */
export const barHeight = 64;
/** The gap between the bar and the window's bottom edge; a phone's home bar or gesture area gets the larger one. */
export const barBottomGap = { native: 24, web: 16 } as const;
/** The room between a conversation's composer and the bar floating beneath it. */
const barBreathing = 10;

/** How far a screen's foot must reach so its last row, or a composer, clears the bar, for a gap under the bar. */
export const barClearanceOf = (bottomGap: number) => barHeight + bottomGap + barBreathing;

/** A color with the opacity given, for the bar's translucent ground; a color that is not a six-digit hex is kept as it is. */
export const withOpacity = (color: string, opacity: number): string => {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  const alpha = Math.round(Math.min(1, Math.max(0, opacity)) * 255);
  return `${color}${alpha.toString(16).padStart(2, "0")}`;
};
