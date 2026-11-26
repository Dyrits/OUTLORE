import { Schema } from "effect";
import type { RequestTag } from "./requests.ts";

// What a committed change touched, and what each read depends on (idle traffic): a screen refetches a read only when
// a change touched something the read shows.

/**
 * What a scoped change touched: the work the owner follows (quests, threads, messages, turns, activity), or the spend
 * a finished turn adds to. A change that names no topics may have touched anything.
 */
export const Topic = Schema.Literals(["work", "spend"]);
export type Topic = typeof Topic.Type;

/**
 * The topics each read depends on.
 * A scoped change that touches none of them leaves the read's answer as it was, so a screen does not ask again; a change without topics, and a screen reconnecting, always do.
 * An empty list is a read of what only an unscoped change alters: the settings, the Vault, the connectors, the paired hosts and the installed harnesses.
 * The reads of the disk (folders, files, skills) follow the work, as an agent writes there.
 * A read not named here is not a query: a screen refetches it on every change.
 */
export const queryTopics = {
  BrowseFolders: ["work"],
  FindArchivedRealm: ["work"],
  ListArchivedRealms: ["work"],
  ListConnectors: [],
  ListHarnesses: [],
  ListHosts: [],
  ListIntel: ["work"],
  ListMentionables: ["work"],
  ListMissions: ["work"],
  ListModelEfforts: [],
  ListOpenQuestions: ["work"],
  ListRituals: ["work"],
  ListSkills: ["work"],
  ListWorkspaceEntries: ["work"],
  ReadAccountBudgets: ["spend"],
  ReadAttachment: [],
  ReadBudget: ["spend"],
  ReadChronicle: ["work"],
  ReadConnectorChoices: [],
  ReadDictation: [],
  ReadFileDiff: ["work"],
  ReadGuildHallRecap: ["work"],
  ReadGuildmaster: ["work"],
  ReadHostName: [],
  ReadHostUpdate: [],
  ReadIntelHistory: ["work"],
  ReadJournal: ["work"],
  ReadMission: ["work"],
  ReadPermissions: ["work"],
  ReadPriceStatus: [],
  ReadRemoteAccess: [],
  ReadRitual: ["work"],
  ReadSettings: [],
  ReadStartChoices: [],
  ReadThreadAnchors: ["work"],
  ReadThreadPanel: ["work"],
  ReadThreadTree: ["work"],
  ReadUsage: ["spend", "work"],
  ReadVault: [],
  SearchFolders: ["work"],
} as const satisfies Partial<Record<RequestTag, ReadonlyArray<Topic>>>;

/** The name of a request that only reads, so that equal ones asked together can share one answer. */
export type QueryTag = keyof typeof queryTopics;

/** Whether a request only reads: its answer follows the data, and asking it again changes nothing. */
export const isQueryTag = (tag: RequestTag): tag is QueryTag => Object.hasOwn(queryTopics, tag);

/**
 * Whether a change announced with these topics may alter a read's answer: always for a change without topics and for a
 * read that is not a query.
 */
export const isAffectedBy = (tag: RequestTag, topics: ReadonlyArray<Topic> | undefined) => {
  if (topics === undefined || !isQueryTag(tag)) return true;
  const dependsOn: ReadonlyArray<Topic> = queryTopics[tag];
  return dependsOn.some((topic) => topics.includes(topic));
};
