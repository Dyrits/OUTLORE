/** The places the sidebar leads to; a quest is opened from its own row instead, a realm's quests from its own list. */
export type Place = "Home" | "Chronicle" | "Channel" | "RealmQuests" | "Lore" | "Archived" | "Reserves" | "Settings";

type Entry = { label: string; note: string; place: Place };

/** The places the footer menu opens, in order (CHG-0449). A Ritual is one of its realm's things, not a place (CHG-0616). */
export const menuPlaces: ReadonlyArray<Entry> = [
  { label: "Lore", note: "What quests remember", place: "Lore" },
  { label: "Archive", note: "Archived quests", place: "Archived" },
  { label: "Reserves", note: "Usage and budgets", place: "Reserves" },
  { label: "Settings", note: "Accounts, Companions, and looks", place: "Settings" },
];

/** Names used in Chronicler context, including destinations outside the menu. */
export const screenNames: Record<Place, string> = {
  Archived: "Archive",
  Channel: "Channel",
  Chronicle: "Chronicle",
  Home: "Home",
  Lore: "Lore",
  RealmQuests: "Realm quests",
  Reserves: "Reserves",
  Settings: "Settings",
};

/** Destinations safe to resume without a quest or realm selection. */
export const resumablePlaces: readonly Place[] = ["Archived", "Lore", "Reserves", "Settings"];
