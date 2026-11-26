import type { Location, NavigationEvent } from "./location";
import { menuPlaces } from "./placeCatalog";

// The phone shell (CHG-0761): a floating pill of three tabs over the narrow window, and a Menu of the other places. The
// rules of what shows, which tab is lit and how the pill gives way while the owner scrolls are plain functions, so
// they run in Node and the frame only draws what they say.

/** The pill's three tabs: each opens a full screen of its own. */
export type PhoneTab = "chronicle" | "quests" | "chronicler";

/** The tabs in the pill's order, with the name each carries. */
export const phoneTabs: ReadonlyArray<{ id: PhoneTab; label: string }> = [
  { id: "chronicle", label: "Chronicle" },
  { id: "quests", label: "Quests" },
  { id: "chronicler", label: "Chronicler" },
];

/** What takes the content's place in the narrow window: the Menu, the Quests tab, or Chronicler. */
export type PhoneCover = "menu" | "quests" | "chronicler";

/**
 * What the bottom of the window holds: the pill on a screen of the tabs and the Menu's places; the conversation's own
 * composer in a quest or errand, which takes the pill's place; nothing under a form or the quest panel, which have
 * their own buttons.
 */
export type PhoneBottom = "pill" | "composer" | "none";

/** The narrow window as the location and the quest panel make it. */
export type PhoneShell = {
  bottom: PhoneBottom;
  cover: PhoneCover | null;
  /** The tab that is lit, or null on a screen that belongs to none (the Menu and its places). */
  tab: PhoneTab | null;
  /** What the top bar names, or null where the screen has a header of its own. */
  title: string | null;
  /** Whether the top bar offers Back, to the Menu a place was opened from. */
  hasBack: boolean;
  /** Whether the content must keep clear of the pill itself because it cannot scroll beneath it. */
  isClearOfPill: boolean;
};

/** The screens that scroll beneath the pill with room left at their foot; any other screen is kept clear of it. */
const scrollsBeneathPill = ["Home", "Chronicle", "Archived", "Lore", "Reserves"] as const;

/**
 * Says what the narrow window shows: the cover, the bottom, the lit tab and the top bar's title. `showsDetails` is
 * whether the quest's side panel takes the content's place.
 */
export const phoneShellOf = (location: Location, showsDetails: boolean): PhoneShell => {
  const { ritualForm } = location;
  if (ritualForm !== null)
    return { bottom: "none", cover: null, hasBack: false, isClearOfPill: false, tab: null, title: null };
  if (location.isMenuOpen)
    return { bottom: "pill", cover: "menu", hasBack: false, isClearOfPill: false, tab: null, title: "Menu" };
  if (location.isNarrowChroniclerOpen)
    return {
      bottom: "pill",
      cover: "chronicler",
      hasBack: false,
      isClearOfPill: true,
      tab: "chronicler",
      title: "Chronicler",
    };
  if (location.isQuestsOpen)
    return { bottom: "pill", cover: "quests", hasBack: false, isClearOfPill: false, tab: "quests", title: "Quests" };
  if (showsDetails)
    return { bottom: "none", cover: null, hasBack: false, isClearOfPill: false, tab: null, title: null };
  if (location.openMission !== null)
    return { bottom: "composer", cover: null, hasBack: false, isClearOfPill: false, tab: null, title: null };
  const { place } = location;
  const isOnChronicle = place === "Home" || place === "Chronicle";
  // A place the Menu opened is named in the top bar, which goes back to the Menu.
  const menuPlace = menuPlaces.find((entry) => entry.place === place);
  return {
    bottom: "pill",
    cover: null,
    hasBack: menuPlace !== undefined,
    isClearOfPill: !(scrollsBeneathPill as readonly string[]).includes(place),
    // A realm's channel belongs to the Quests tab, which it returns to.
    tab: isOnChronicle ? "chronicle" : place === "Channel" ? "quests" : null,
    title: isOnChronicle ? "Chronicle" : (menuPlace?.label ?? null),
  };
};

/** What the phone's Back (the hardware button or gesture) asks: a navigation event, or closing the quest panel. */
export type PhoneBack = NavigationEvent | { type: "closeDetails" };

/**
 * What Back does on the phone: it peels the topmost layer or goes to the screen before, so it never leaves the app
 * from a screen that has somewhere to go back to. Null on the Chronicle, the root, where Back leaves the app.
 */
export const phoneBackOf = (location: Location, showsDetails: boolean): PhoneBack | null => {
  if (location.ritualForm !== null) return { target: null, type: "ritualForm" };
  if (location.isChroniclerBudgetOpen) return { isOpen: false, type: "chroniclerBudget" };
  if (location.isMenuOpen) return { isOpen: false, type: "menu" };
  if (location.isNarrowChroniclerOpen) return { isOpen: false, type: "narrowChronicler" };
  // The Quests tab over an open quest is where leaving the quest put the owner: Back goes on to the place beneath.
  if (location.isQuestsOpen)
    return location.openMission === null ? { isOpen: false, type: "quests" } : { type: "close" };
  if (showsDetails) return { type: "closeDetails" };
  if (location.openMission !== null)
    return location.page === null ? { type: "backFromQuest" } : { page: null, type: "page" };
  if (location.isPermissionsOpen) return { isOpen: false, type: "permissions" };
  const { place } = location;
  if (menuPlaces.some((entry) => entry.place === place)) return { isOpen: true, type: "menu" };
  if (place === "Channel") return { isOpen: true, type: "quests" };
  return null;
};

/** What choosing a tab asks of the window. The Chronicle is a place; the other two cover the content and keep it mounted. */
export const phoneTabEventOf = (tab: PhoneTab): NavigationEvent => {
  if (tab === "chronicle") return { place: "Chronicle", type: "place" };
  if (tab === "quests") return { isOpen: true, type: "quests" };
  return { isOpen: true, type: "narrowChronicler" };
};

/** The pill's height, and the circle's width and height once it shrinks. */
export const pillHeight = 56;
/** The gap between the pill and the window's bottom edge; a phone's home bar or gesture area gets the larger one. */
export const pillBottomGap = { native: 24, web: 16 } as const;
const pillBreathing = 16;

/** How far a screen's foot must reach so its last row clears the pill, for a gap under the pill. */
export const pillClearanceOf = (bottomGap: number) => pillHeight + bottomGap + pillBreathing;

/** The scroll offset above which the pill stays whole: near the top of a screen there is nothing to make room for. */
const collapseThreshold = 48;
/** How far the owner must move before the pill changes, so a small tremor of the finger does not flicker it. */
const scrollSlop = 8;

/** The pill's reading of the scroll so far: whether it is a circle, and the offset it last changed at. */
export type PillScroll = { anchor: number; isCollapsed: boolean };

export const initialPillScroll: PillScroll = { anchor: 0, isCollapsed: false };

/**
 * The pill after the owner scrolled to `offset`: it shrinks to a circle while the content moves down past the
 * threshold, and comes back on a scroll up or near the top.
 */
export const pillScrollOf = (state: PillScroll, offset: number): PillScroll => {
  if (offset <= collapseThreshold) return { anchor: offset, isCollapsed: false };
  const moved = offset - state.anchor;
  if (moved > scrollSlop) return { anchor: offset, isCollapsed: true };
  if (moved < -scrollSlop) return { anchor: offset, isCollapsed: false };
  return state;
};

/** A color with the opacity given, for the pill's translucent ground; a color that is not a six-digit hex is kept as it is. */
export const withOpacity = (color: string, opacity: number): string => {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  const alpha = Math.round(Math.min(1, Math.max(0, opacity)) * 255);
  return `${color}${alpha.toString(16).padStart(2, "0")}`;
};
