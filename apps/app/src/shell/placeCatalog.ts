import type { NavIconName } from "./navIcons";

/** The places the sidebar leads to; a quest is opened from its own row instead, a realm's quests from its own list. */
export type Place =
  | "Guildmaster"
  | "Quests"
  | "Realms"
  | "Borderlands"
  | "RealmQuests"
  | "Rituals"
  | "Craft"
  | "Library"
  | "Lore"
  | "Archived"
  | "Reserves"
  | "Charter"
  | "Settings";

type Entry = { icon: NavIconName; label: string; note: string; place: Place };

/** The menu's rows in groups, set apart by a line, in the sidebar's order. */
export const placeGroups: ReadonlyArray<ReadonlyArray<Entry>> = [
  [
    { icon: "guild-hall", label: "Guild Hall", note: "What waits for you and what happened", place: "Guildmaster" },
    { icon: "realms", label: "Realms", note: "Quests sharing lore, by realm", place: "Realms" },
    { icon: "borderlands", label: "Borderlands", note: "Quests with no realm", place: "Borderlands" },
  ],
  [
    { icon: "rituals", label: "Rituals", note: "Orders that run by themselves", place: "Rituals" },
    { icon: "craft", label: "Craft", note: "Reusable procedures", place: "Craft" },
  ],
  [
    { icon: "library", label: "Library", note: "Artifacts your quests made", place: "Library" },
    { icon: "lore", label: "Lore", note: "What quests remember", place: "Lore" },
    { icon: "archive", label: "Archive", note: "Archived quests", place: "Archived" },
  ],
  [
    { icon: "reserves", label: "Reserves", note: "Usage and budgets", place: "Reserves" },
    { icon: "charter", label: "Charter", note: "Devices and relays", place: "Charter" },
    { icon: "workshop", label: "Workshop", note: "Accounts, Companions, and looks", place: "Settings" },
  ],
];

/** Names used in Chronicler context, including destinations outside the menu. */
export const screenNames: Record<Place, string> = {
  Archived: "Archive",
  Borderlands: "Borderlands quests",
  Charter: "Charter",
  Craft: "Craft",
  Guildmaster: "Guild Hall",
  Library: "Library",
  Lore: "Lore",
  Quests: "Quest board",
  RealmQuests: "Realm quests",
  Realms: "Realms",
  Reserves: "Reserves",
  Rituals: "Rituals",
  Settings: "Settings",
};

/** Destinations safe to resume without a quest or realm selection. */
export const resumablePlaces: readonly Place[] = [
  "Archived",
  "Charter",
  "Craft",
  "Guildmaster",
  "Library",
  "Lore",
  "Quests",
  "Realms",
  "Reserves",
  "Rituals",
  "Settings",
];
