import { MissionSummary, type RitualCard } from "@outlore/contracts";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { inRealmOf, rosterOf } from "../../src/shell/realmRoster";

const usage = { cacheCreation: 0, cacheRead: 0, input: 0, output: 0 };
const template = Schema.decodeUnknownSync(MissionSummary)({
  budget: { limits: { cost: null, tokens: null }, spent: { cost: 0, tokens: 0 } },
  consumption: { earlierTurns: 0, estimated: 0, reported: 0, tokens: usage, turns: 0, unpricedTurns: 0 },
  harness: "claude",
  id: "template",
  isEmpty: false,
  isTitleByUser: false,
  lastActivityAt: 0,
  lastExchange: { owner: null, reply: null },
  model: "default",
  prompt: null,
  ritual: null,
  runningCount: 0,
  state: "Resting",
  threadCount: 1,
  title: "template",
  topThreadId: "top",
  usage,
  workspaceId: null,
  workspaceName: null,
});
const ritual = { isOn: true } as unknown as RitualCard;
const mission = (id: string, lastActivityAt: number, isRitual = false, workspaceId: string | null = null) =>
  ({
    ...template,
    id,
    lastActivityAt,
    ritual: isRitual ? ritual : null,
    workspaceId,
  }) as MissionSummary;
const idsOf = (missions: ReadonlyArray<MissionSummary>) => missions.map((each) => each.id as string);

// Five Rituals newer than three quests: before the split, they took the preview's four slots and the count said eight.
const mixed = [
  mission("quest 1", 1),
  mission("quest 2", 2),
  mission("quest 3", 3),
  mission("ritual 1", 11, true),
  mission("ritual 2", 12, true),
  mission("ritual 3", 13, true),
  mission("ritual 4", 14, true),
  mission("ritual 5", 15, true),
];

describe("a placement's quests and Rituals, ranked apart", () => {
  it("fills the quest preview with quests only, so Rituals take none of its slots", () => {
    const { quests } = rosterOf(mixed, { openMission: null, questLimit: 4 });
    expect(idsOf(quests.preview)).toEqual(["quest 3", "quest 2", "quest 1"]);
  });

  it('counts only quests for "Show all N quests", and only Rituals for the Rituals', () => {
    const { quests, rituals } = rosterOf(mixed, { openMission: null, questLimit: 2 });
    expect(quests.count).toBe(3);
    expect(idsOf(quests.preview)).toEqual(["quest 3", "quest 2"]);
    expect(rituals.count).toBe(5);
    expect(idsOf(rituals.ranked)).toEqual(["ritual 5", "ritual 4", "ritual 3", "ritual 2", "ritual 1"]);
  });

  it("keeps the open quest in the preview, and the open Ritual in its own", () => {
    const roster = rosterOf(mixed, { openMission: "quest 1", questLimit: 2, ritualLimit: 2 });
    expect(idsOf(roster.quests.preview)).toEqual(["quest 3", "quest 1"]);
    expect(idsOf(rosterOf(mixed, { openMission: "ritual 1", questLimit: 2, ritualLimit: 2 }).rituals.preview)).toEqual([
      "ritual 5",
      "ritual 1",
    ]);
  });

  it("shows every Ritual unless a Ritual limit is given", () => {
    expect(rosterOf(mixed, { openMission: null, questLimit: 1 }).rituals.preview).toHaveLength(5);
  });
});

describe("a realm's missions of one kind", () => {
  it("leaves out the other kind and the other realms", () => {
    const all = [mission("q", 1, false, "w1"), mission("r", 2, true, "w1"), mission("other", 3, false, "w2")];
    expect(idsOf(inRealmOf(all, "w1", "Quest"))).toEqual(["q"]);
    expect(idsOf(inRealmOf(all, "w1", "Ritual"))).toEqual(["r"]);
    expect(idsOf(inRealmOf([mission("none", 1)], null, "Quest"))).toEqual(["none"]);
  });
});
