import {
  type MissionId,
  MissionSummary,
  RitualCard,
  type RitualId,
  type ThreadId,
  WorkspaceChoice,
  type WorkspaceId,
} from "@outlore/contracts";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { listedMissions } from "../../src/foundation/queries";
import { createRequestOf } from "../../src/rituals/ritualCreate";
import {
  deleteRitualConfirm,
  deleteRitualLoss,
  deleteRitualQuestion,
  isRealmArchivedOf,
  runIsUnderwayOf,
  takesTurnsIn,
} from "../../src/rituals/ritualRow";
import { placementsOf } from "../../src/shell/questTree";

// A Ritual among the realm's quests (CHG-0616): the lists ask for the realm's Rituals, place them with the quests of
// their realm, and draw them with their own look; the composer stays hidden in a Ritual's own conversation, and its
// Delete asks one question naming what is lost.

const usage = { cacheCreation: 0, cacheRead: 0, input: 0, output: 0 };
const ritualCard = (ritual: Partial<RitualCard> = {}) =>
  Schema.decodeUnknownSync(RitualCard)({
    id: "ritual" as RitualId,
    isOn: true,
    lastRunAt: null,
    lastRunState: null,
    nextRunAt: 1000,
    originMissionId: null,
    schedule: { _tag: "Daily", time: "07:00" },
    ...ritual,
  });
const quest = (id: string, ritual: RitualCard | null = null, workspaceId: WorkspaceId | null = null) =>
  Schema.decodeUnknownSync(MissionSummary)({
    budget: { limits: { cost: null, tokens: null }, spent: { cost: 0, tokens: 0 } },
    consumption: { earlierTurns: 0, estimated: 0, reported: 0, tokens: usage, turns: 0, unpricedTurns: 0 },
    harness: "claude",
    id: id as MissionId,
    isEmpty: false,
    isTitleByUser: false,
    lastActivityAt: 0,
    lastExchange: { owner: null, reply: null },
    model: "default",
    prompt: null,
    ritual,
    runningCount: 0,
    state: "Resting",
    threadCount: 1,
    title: id,
    topThreadId: "top",
    usage,
    workspaceId,
    workspaceName: null,
  });
const realm = (id: string): WorkspaceChoice =>
  Schema.decodeUnknownSync(WorkspaceChoice)({ id: id as WorkspaceId, name: id, path: null });

describe("the realm's lists asking for its Rituals", () => {
  it("sends includeRituals, so the Rituals come with the quests of the realm", () => {
    expect(listedMissions.request).toMatchObject({ _tag: "ListMissions", includeRituals: true, isArchived: false });
    expect(listedMissions.key).not.toBe("missions:all");
  });
  it("places a Ritual beside the quests of its realm, or with the realm-less quests in no realm", () => {
    const missions = [
      quest("plain"),
      quest("moon", ritualCard(), "ws" as WorkspaceId),
      quest("lost", ritualCard(), "ws" as WorkspaceId),
    ];
    const placements = placementsOf(missions, [realm("ws")]);
    expect(placements.borderlands.map((mission) => mission.id)).toEqual(["plain"]);
    expect(placements.realms.map((realm) => realm.quests.map((mission) => mission.id))).toEqual([["moon", "lost"]]);
    const realmless = placementsOf([quest("orphan", ritualCard())], []);
    expect(realmless.borderlands.map((mission) => mission.id)).toEqual(["orphan"]);
  });
});

describe("a Ritual's row among the quests", () => {
  it("marks a run underway from the run state its record carries", () => {
    expect(runIsUnderwayOf(ritualCard({ lastRunState: "Underway" }))).toBe(true);
    expect(runIsUnderwayOf(ritualCard({ lastRunState: "Done" }))).toBe(false);
    expect(runIsUnderwayOf(null)).toBe(false);
  });
  it("marks a Ritual of an archived realm: its realm is missing from the active realms", () => {
    const mission = quest("moon", ritualCard(), "ws" as WorkspaceId);
    expect(isRealmArchivedOf(mission, [realm("ws")])).toBe(false);
    expect(isRealmArchivedOf(mission, [realm("other")])).toBe(true);
    expect(isRealmArchivedOf(quest("plain"), [])).toBe(false);
  });
});

describe("hiding the composer in a Ritual's conversation", () => {
  it("takes no turns at a Ritual's top, and keeps the composer on the runs beneath it", () => {
    expect(takesTurnsIn({ parentId: null }, ritualCard())).toBe(false);
    expect(takesTurnsIn({ parentId: "run" as ThreadId }, ritualCard())).toBe(true);
    expect(takesTurnsIn({ parentId: null }, null)).toBe(true);
  });
});

describe("deleting a Ritual", () => {
  it("asks one question naming the Ritual", () => {
    expect(deleteRitualQuestion("Morning digest")).toBe('Delete "Morning digest"?');
  });
  it("names what is lost — the Ritual, its runs' errands, and their history — and that Cancel keeps everything", () => {
    expect(deleteRitualLoss).toContain("runs' errands");
    expect(deleteRitualLoss).toContain("permanently");
    expect(deleteRitualLoss).toContain("Cancel keeps everything");
    expect(deleteRitualConfirm).toBe("Delete forever");
  });
});

describe("scheduling a Ritual from a quest", () => {
  const runner = { accountId: null, effort: "default", harness: "claude", model: "default" } as const;
  it("sends the origin quest, whose realm the Ritual then takes", () => {
    const request = createRequestOf({
      fallbacks: [],
      instruction: "Digest.",
      originMissionId: "quest" as MissionId,
      primary: runner,
      requestId: "req" as never,
      schedule: { _tag: "Daily", time: "07:00" },
      scope: [],
      title: "Morning digest",
      workspacePath: "/somewhere/else",
    });
    expect(request).toMatchObject({
      _tag: "CreateRitual",
      originMissionId: "quest",
      title: "Morning digest",
      workspacePath: null,
    });
  });
  it("makes a Ritual of a realm directly, with no origin quest", () => {
    const request = createRequestOf({
      fallbacks: [],
      instruction: "Digest.",
      originMissionId: null,
      primary: runner,
      requestId: "req" as never,
      schedule: { _tag: "Daily", time: "07:00" },
      scope: [],
      title: "Morning digest",
      workspacePath: "/realm/workspace",
    });
    expect(request).not.toHaveProperty("originMissionId");
    expect(request.workspacePath).toBe("/realm/workspace");
  });
});
