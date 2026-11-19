import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { install, inWorld, untilIdle } from "../fixtures/connectorWorld.ts";
import { call, startMission } from "../fixtures/service.ts";
import { folderIn } from "../work/guildmasterHelpers.ts";

describe("the connector tools in a thread's panel", () => {
  it.live("lists usable tools, marks switched-off tools and hides an unavailable connector", () =>
    inWorld({}, () =>
      Effect.gen(function* () {
        yield* install("calendar");
        const quest = yield* startMission({ text: "Hello" });
        const detail = yield* untilIdle(quest.missionId);
        const read = () => call({ _tag: "ReadThreadPanel", threadId: detail.thread.id });
        let panel = yield* read();
        expect(panel.connectorTools.some((tool) => tool.connectorId === "calendar" && tool.isOn)).toBe(true);
        const tool = panel.connectorTools[0];
        if (tool === undefined) throw new Error("Expected a connector tool");
        yield* call({ _tag: "SetConnectorTool", connectorId: tool.connectorId, isOn: false, tool: tool.name });
        panel = yield* read();
        expect(panel.connectorTools.find((entry) => entry.name === tool.name)?.isOn).toBe(false);
        yield* call({
          _tag: "SetConnectorSwitch",
          choice: "Off",
          connectorId: "calendar",
          level: { _tag: "Quest", missionId: quest.missionId },
        });
        expect((yield* read()).connectorTools).toEqual([]);
        expect(panel.outloreTools).toContain("read_journal");
      }),
    ),
  );

  it.live("lists only tools of chosen Apple apps and does not expose an unclassified app", () =>
    inWorld({}, () =>
      Effect.gen(function* () {
        yield* install("applefake", ["calendar"]);
        yield* call({ _tag: "RequestApplePermission", connectorId: "applefake" });
        const quest = yield* startMission({ text: "Hello" });
        const detail = yield* untilIdle(quest.missionId);
        const panel = yield* call({ _tag: "ReadThreadPanel", threadId: detail.thread.id });
        expect(panel.connectorTools.map((tool) => tool.name)).toEqual(["list-calendars", "list-events"]);
        yield* call({ _tag: "ChooseAppleApps", apps: ["mail"], connectorId: "applefake" });
        yield* call({ _tag: "RequestApplePermission", connectorId: "applefake" });
        const updated = yield* call({ _tag: "ReadThreadPanel", threadId: detail.thread.id });
        expect(updated.connectorTools.map((tool) => tool.name)).toEqual(["read-mail", "send-email"]);
      }),
    ),
  );

  it.live("applies the quest's placement to its errand and follows a move", () =>
    inWorld({}, (world) =>
      Effect.gen(function* () {
        yield* install("calendar");
        const quest = yield* startMission({ text: "Hello", workspacePath: folderIn(world.directory, "realm") });
        const detail = yield* untilIdle(quest.missionId);
        const realmId = detail.mission.workspaceId;
        if (realmId === null) throw new Error("Expected a realm");
        const errand = yield* call({
          _tag: "OpenThread",
          effort: "default",
          model: "default",
          parentThreadId: quest.threadId,
          requestId: crypto.randomUUID(),
          shouldStartAnyway: false,
          text: "Errand",
        });
        yield* untilIdle(quest.missionId, errand.threadId);
        yield* call({
          _tag: "SetConnectorSwitch",
          choice: "Off",
          connectorId: "calendar",
          level: { _tag: "Realm", realmId },
        });
        expect((yield* call({ _tag: "ReadThreadPanel", threadId: errand.threadId })).connectorTools).toEqual([]);
        yield* call({ _tag: "MoveQuest", missionId: quest.missionId, realmId: null });
        expect(
          (yield* call({ _tag: "ReadThreadPanel", threadId: errand.threadId })).connectorTools.length,
        ).toBeGreaterThan(0);
      }),
    ),
  );
});
