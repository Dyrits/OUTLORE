import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { testSecret } from "../fixtures/connectorBackend.ts";
import { install, inWorld, untilIdle, untilReplies } from "../fixtures/connectorWorld.ts";
import { listToolNames } from "../fixtures/mcp.ts";
import { call, startMission } from "../fixtures/service.ts";
import { folderIn } from "../work/guildmasterHelpers.ts";

const names = ["list-events", "create-event"].map((tool) => `calendar__${tool}`);
const switchOf = (connectorId: string, level: object, choice: "On" | "Off" | "Reset") =>
  call({ _tag: "SetConnectorSwitch", choice, connectorId, level: level as never });

/** A quest in a new realm, waiting for its first turn to end. */
const questInRealm = (directory: string, name: string) =>
  Effect.gen(function* () {
    const started = yield* startMission({ text: "Hello", workspacePath: folderIn(directory, name) });
    const detail = yield* untilIdle(started.missionId);
    return { ...started, realmId: detail.mission.workspaceId };
  });

const toolsOf = (threadId: string) => listToolNames(threadId as never);

describe("which tools a thread is given", () => {
  it.live("gives an installed, connected connector's tools to every quest, an errand and Chronicler", () =>
    inWorld({}, (world) =>
      Effect.gen(function* () {
        yield* install("calendar");
        const quest = yield* startMission({ text: "Hello" });
        yield* untilIdle(quest.missionId);
        const errand = yield* call({
          _tag: "OpenThread",
          effort: "default",
          model: "default",
          parentThreadId: quest.threadId,
          requestId: crypto.randomUUID(),
          shouldStartAnyway: false,
          text: "Errand",
        });
        const chronicler = yield* call({ _tag: "ReadGuildmaster" });
        for (const threadId of [quest.threadId, errand.threadId, chronicler.threadId])
          for (const name of names) expect(yield* toolsOf(threadId)).toContain(name);
        expect(world.calendar.state.listings).toBeGreaterThan(0);
      }),
    ),
  );

  it.live("gives no tool of an installed connector that is not connected, until it is", () =>
    inWorld({ hasKey: false }, (world) =>
      Effect.gen(function* () {
        const card = yield* install("calendar");
        expect(card).toMatchObject({
          isEnabled: true,
          needs: "Add your API key below.",
          state: "NeedsConnecting",
        });
        const quest = yield* startMission({ text: "Hello" });
        yield* untilIdle(quest.missionId);
        for (const name of names) expect(yield* toolsOf(quest.threadId)).not.toContain(name);
        world.vault.put("calendar", "API key", testSecret);
        yield* call({
          _tag: "SendMessage",
          delivery: null,
          requestId: crypto.randomUUID(),
          text: "Again",
          threadId: quest.threadId,
        });
        yield* untilReplies(quest.missionId, 2);
        for (const name of names) expect(yield* toolsOf(quest.threadId)).toContain(name);
      }),
    ),
  );

  it.live("hides a connector everywhere with the global switch off, even where a quest says On", () =>
    inWorld({}, () =>
      Effect.gen(function* () {
        yield* install("calendar");
        const quest = yield* startMission({ text: "Hello" });
        yield* untilIdle(quest.missionId);
        yield* switchOf("calendar", { _tag: "Quest", missionId: quest.missionId }, "On");
        yield* switchOf("calendar", { _tag: "Global" }, "Off");
        for (const name of names) expect(yield* toolsOf(quest.threadId)).not.toContain(name);
        const chronicler = yield* call({ _tag: "ReadGuildmaster" });
        for (const name of names) expect(yield* toolsOf(chronicler.threadId)).not.toContain(name);
        yield* switchOf("calendar", { _tag: "Global" }, "On");
        for (const name of names) expect(yield* toolsOf(quest.threadId)).toContain(name);
      }),
    ),
  );

  it.live("resolves Inherit, On, Off and Reset for a quest, its errand, a realm and the Borderlands", () =>
    inWorld({}, (world) =>
      Effect.gen(function* () {
        yield* install("calendar");
        const inRealm = yield* questInRealm(world.directory, "alpha");
        const other = yield* questInRealm(world.directory, "beta");
        const free = yield* startMission({ text: "Hello" });
        yield* untilIdle(free.missionId);
        const has = (threadId: string) => toolsOf(threadId).pipe(Effect.map((all) => all.includes(names[0] as string)));

        // A realm's Off reaches its quests and their errands, not other realms or the Borderlands.
        yield* switchOf("calendar", { _tag: "Realm", realmId: inRealm.realmId }, "Off");
        const errand = yield* call({
          _tag: "OpenThread",
          effort: "default",
          model: "default",
          parentThreadId: inRealm.threadId,
          requestId: crypto.randomUUID(),
          shouldStartAnyway: false,
          text: "Errand",
        });
        yield* untilIdle(inRealm.missionId, errand.threadId);
        expect([
          yield* has(inRealm.threadId),
          yield* has(errand.threadId),
          yield* has(other.threadId),
          yield* has(free.threadId),
        ]).toEqual([false, false, true, true]);

        // A quest's own On beats its realm's Off, and Reset goes back to Inherit.
        yield* switchOf("calendar", { _tag: "Quest", missionId: inRealm.missionId }, "On");
        expect([yield* has(inRealm.threadId), yield* has(errand.threadId)]).toEqual([true, true]);
        yield* switchOf("calendar", { _tag: "Quest", missionId: inRealm.missionId }, "Reset");
        expect(yield* has(inRealm.threadId)).toBe(false);
        yield* switchOf("calendar", { _tag: "Realm", realmId: inRealm.realmId }, "Reset");
        expect(yield* has(inRealm.threadId)).toBe(true);

        // The Borderlands' Off reaches a quest in no realm and leaves a quest in a realm that inherits alone.
        yield* switchOf("calendar", { _tag: "Borderlands" }, "Off");
        expect([yield* has(free.threadId), yield* has(inRealm.threadId), yield* has(other.threadId)]).toEqual([
          false,
          true,
          true,
        ]);
        // Chronicler follows the global switch alone.
        const chronicler = yield* call({ _tag: "ReadGuildmaster" });
        expect(yield* has(chronicler.threadId)).toBe(true);
        const [card] = (yield* call({ _tag: "ListConnectors" })).filter((entry) => entry.id === "calendar");
        expect(card?.borderlandsChoice).toBe("Off");
      }),
    ),
  );

  it.live("keeps a moved quest's own choice and lets it inherit from its new placement", () =>
    inWorld({}, (world) =>
      Effect.gen(function* () {
        yield* install("calendar");
        const inRealm = yield* questInRealm(world.directory, "gamma");
        const target = yield* questInRealm(world.directory, "delta");
        const has = (threadId: string) => toolsOf(threadId).pipe(Effect.map((all) => all.includes(names[0] as string)));
        yield* switchOf("calendar", { _tag: "Realm", realmId: target.realmId }, "Off");
        yield* switchOf("calendar", { _tag: "Quest", missionId: inRealm.missionId }, "Off");
        yield* switchOf("calendar", { _tag: "Quest", missionId: target.missionId }, "On");
        yield* call({ _tag: "MoveQuest", missionId: inRealm.missionId, realmId: target.realmId });
        // Its own Off is kept through the move; the quest that said On stays On inside the realm that says Off.
        expect(yield* has(inRealm.threadId)).toBe(false);
        expect(yield* has(target.threadId)).toBe(true);
        yield* switchOf("calendar", { _tag: "Quest", missionId: inRealm.missionId }, "Reset");
        // With no choice of its own it follows its new realm's Off.
        expect(yield* has(inRealm.threadId)).toBe(false);
        yield* call({ _tag: "MoveQuest", missionId: inRealm.missionId, realmId: null });
        expect(yield* has(inRealm.threadId)).toBe(true);
      }),
    ),
  );

  it.live("forgets a deleted quest's choices, and keeps a realm's through an archive", () =>
    inWorld({}, (world) =>
      Effect.gen(function* () {
        yield* install("calendar");
        const gone = yield* questInRealm(world.directory, "epsilon");
        yield* switchOf("calendar", { _tag: "Quest", missionId: gone.missionId }, "Off");
        yield* switchOf("calendar", { _tag: "Realm", realmId: gone.realmId }, "Off");
        const preview = yield* call({ _tag: "PreviewDeletion", threadId: gone.threadId });
        yield* call({ _tag: "DeleteThread", confirmation: preview.confirmation, threadId: gone.threadId });
        const rows = yield* choiceRows;
        expect(rows).toEqual([{ kind: "Realm" }]);
        // A choice for a quest that does not exist is refused, not stored.
        const refused = yield* Effect.flip(switchOf("calendar", { _tag: "Quest", missionId: "nobody" }, "Off"));
        expect(refused.kind).toBe("NotFound");
      }),
    ),
  );

  it.live("keeps a tool switched off out of the thread's listing and the card's on switch, and brings it back on", () =>
    inWorld({}, () =>
      Effect.gen(function* () {
        yield* install("calendar");
        const quest = yield* startMission({ text: "Hello" });
        yield* untilIdle(quest.missionId);
        const card = yield* call({
          _tag: "SetConnectorTool",
          connectorId: "calendar",
          isOn: false,
          tool: "create-event",
        });
        expect(card.tools.find((tool) => tool.name === "create-event")).toMatchObject({ class: "Write", isOn: false });
        expect(card.tools.find((tool) => tool.name === "list-events")).toMatchObject({ class: "Read", isOn: true });
        expect(card.tools.find((tool) => tool.name === "mystery")).toMatchObject({ class: "Unclassified", isOn: true });
        expect(yield* toolsOf(quest.threadId)).not.toContain("calendar__create-event");
        expect(yield* toolsOf(quest.threadId)).toContain("calendar__list-events");
        yield* call({ _tag: "SetConnectorTool", connectorId: "calendar", isOn: true, tool: "create-event" });
        expect(yield* toolsOf(quest.threadId)).toContain("calendar__create-event");
        const refused = yield* Effect.flip(
          call({ _tag: "SetConnectorTool", connectorId: "calendar", isOn: false, tool: "not a tool" }),
        );
        expect(refused.kind).toBe("NotFound");
      }),
    ),
  );
});

const choiceRows = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  return yield* sql<{ kind: string }>`SELECT kind FROM connector_choices`;
});
