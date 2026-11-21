/** Every mission not archived, unfiltered, with its cache key: the dashboard's questions and the permissions filter use it. */
export const allMissions = {
  key: "missions:all",
  request: { _tag: "ListMissions", isArchived: false, search: null, state: null, workspaceId: null },
} as const;

/**
 * Every mission not archived with the realm's Rituals among them (CHG-0616): what a realm's quest lists show — the
 * sidebar's columns, a realm's page, the channels' Quests tab — so a Ritual is drawn beside the quests of its realm.
 */
export const listedMissions = {
  key: "missions:listed",
  request: {
    _tag: "ListMissions",
    includeRituals: true,
    isArchived: false,
    search: null,
    state: null,
    workspaceId: null,
  },
} as const;
