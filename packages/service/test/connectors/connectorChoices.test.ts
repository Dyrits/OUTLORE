import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { install, inWorld, untilIdle } from "../fixtures/connectorWorld.ts";
import { call, startMission } from "../fixtures/service.ts";
import { folderIn } from "../work/guildmasterHelpers.ts";

const switchOf = (connectorId: string, level: object, choice: "On" | "Off" | "Reset") =>
  call({ _tag: "SetConnectorSwitch", choice, connectorId, level: level as never });

/** A quest in a new realm, waiting for its first turn to end. */
const questInRealm = (directory: string, name: string) =>
  Effect.gen(function* () {
    const started = yield* startMission({ text: "Hello", workspacePath: folderIn(directory, name) });
    const detail = yield* untilIdle(started.missionId);
    const realmId = detail.mission.workspaceId;
    if (realmId === null) throw new Error("Expected a quest in a realm");
    return { ...started, realmId };
  });

const choicesOf = (level: object, connectorId = "calendar") =>
  call({ _tag: "ReadConnectorChoices", level: level as never }).pipe(
    Effect.map((cards) => cards.find((card) => card.connectorId === connectorId)),
  );

describe("the choices a realm's panel and a quest's panel read", () => {
  it.live("lists installed connectors only, each with no choice of its own and Inherit giving On", () =>
    inWorld({}, (world) =>
      Effect.gen(function* () {
        const quest = yield* questInRealm(world.directory, "alpha");
        expect(yield* call({ _tag: "ReadConnectorChoices", level: { _tag: "Realm", realmId: quest.realmId } })).toEqual(
          [],
        );
        yield* install("calendar");
        const cards = yield* call({
          _tag: "ReadConnectorChoices",
          level: { _tag: "Realm", realmId: quest.realmId },
        });
        expect(cards).toEqual([
          {
            choice: null,
            connectorId: "calendar",
            inherited: "On",
            inheritedFrom: null,
            isEnabled: true,
            name: expect.any(String),
            state: "Ready",
          },
        ]);
        expect(yield* choicesOf({ _tag: "Borderlands" })).toMatchObject({ choice: null, inherited: "On" });
      }),
    ),
  );

  it.live("reads a realm's own choice, the Borderlands' choice and a quest's own choice apart", () =>
    inWorld({}, (world) =>
      Effect.gen(function* () {
        yield* install("calendar");
        const quest = yield* questInRealm(world.directory, "beta");
        yield* switchOf("calendar", { _tag: "Realm", realmId: quest.realmId }, "Off");
        yield* switchOf("calendar", { _tag: "Borderlands" }, "Off");
        yield* switchOf("calendar", { _tag: "Quest", missionId: quest.missionId }, "On");
        expect(yield* choicesOf({ _tag: "Realm", realmId: quest.realmId })).toMatchObject({ choice: "Off" });
        expect(yield* choicesOf({ _tag: "Borderlands" })).toMatchObject({ choice: "Off" });
        expect(yield* choicesOf({ _tag: "Quest", missionId: quest.missionId })).toMatchObject({
          choice: "On",
          inherited: "Off",
          inheritedFrom: "Realm",
        });
        yield* switchOf("calendar", { _tag: "Quest", missionId: quest.missionId }, "Reset");
        expect(yield* choicesOf({ _tag: "Quest", missionId: quest.missionId })).toMatchObject({ choice: null });
      }),
    ),
  );

  it.live("makes a quest inherit from its realm when it has one and from the Borderlands only when it has none", () =>
    inWorld({}, (world) =>
      Effect.gen(function* () {
        yield* install("calendar");
        const inRealm = yield* questInRealm(world.directory, "gamma");
        const free = yield* startMission({ text: "Hello" });
        yield* untilIdle(free.missionId);
        yield* switchOf("calendar", { _tag: "Borderlands" }, "Off");
        // The counterexample: the Borderlands says Off, the quest's realm says nothing, and the quest in the realm is On.
        expect(yield* choicesOf({ _tag: "Quest", missionId: inRealm.missionId })).toMatchObject({
          choice: null,
          inherited: "On",
          inheritedFrom: null,
        });
        expect(yield* choicesOf({ _tag: "Quest", missionId: free.missionId })).toMatchObject({
          inherited: "Off",
          inheritedFrom: "Borderlands",
        });
        // A move changes what it inherits, with nothing migrated.
        yield* call({ _tag: "MoveQuest", missionId: inRealm.missionId, realmId: null });
        expect(yield* choicesOf({ _tag: "Quest", missionId: inRealm.missionId })).toMatchObject({
          inherited: "Off",
          inheritedFrom: "Borderlands",
        });
      }),
    ),
  );

  it.live("shows the global switch and whether the connector is connected beside each choice", () =>
    inWorld({ hasKey: false }, (world) =>
      Effect.gen(function* () {
        const quest = yield* questInRealm(world.directory, "delta");
        yield* install("calendar");
        expect(yield* choicesOf({ _tag: "Realm", realmId: quest.realmId })).toMatchObject({
          isEnabled: true,
          state: "NeedsConnecting",
        });
        yield* call({ _tag: "SetConnectorSwitch", choice: "Off", connectorId: "calendar", level: { _tag: "Global" } });
        expect(yield* choicesOf({ _tag: "Realm", realmId: quest.realmId })).toMatchObject({ isEnabled: false });
      }),
    ),
  );

  it.live("leaves out a connector being removed, and refuses an unknown realm, an unknown quest and Chronicler", () =>
    inWorld({}, (world) =>
      Effect.gen(function* () {
        yield* install("calendar");
        const quest = yield* questInRealm(world.directory, "epsilon");
        world.vault.state.isFailingRemoval = true;
        yield* Effect.flip(call({ _tag: "RemoveConnector", connectorId: "calendar" }));
        expect(yield* choicesOf({ _tag: "Realm", realmId: quest.realmId })).toBeUndefined();
        const unknown = "00000000-0000-4000-8000-000000000000";
        expect(
          (yield* Effect.flip(
            call({ _tag: "ReadConnectorChoices", level: { _tag: "Realm", realmId: unknown } as never }),
          )).kind,
        ).toBe("NotFound");
        expect(
          (yield* Effect.flip(
            call({ _tag: "ReadConnectorChoices", level: { _tag: "Quest", missionId: unknown } as never }),
          )).kind,
        ).toBe("NotFound");
        const chronicler = yield* call({ _tag: "ReadGuildmaster" });
        expect(
          (yield* Effect.flip(
            call({ _tag: "ReadConnectorChoices", level: { _tag: "Quest", missionId: chronicler.missionId } as never }),
          )).kind,
        ).toBe("InvalidInput");
      }),
    ),
  );
});
