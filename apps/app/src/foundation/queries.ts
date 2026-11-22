/** Every mission not archived, unfiltered, with its cache key: the dashboard's questions and the permissions filter use it. */
export const allMissions = {
  key: "missions:all",
  request: { _tag: "ListMissions", isArchived: false, search: null, state: null, workspaceId: null },
} as const;

/**
 * Every active mission with Rituals included, for the sidebar and the channel's Quests and Rituals tabs.
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
