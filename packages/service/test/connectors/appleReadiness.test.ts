import { unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { ConnectorBackends } from "../../src/connectors/backend.ts";
import { stdioMcpBackend } from "../../src/connectors/backends/stdioMcp.ts";
import { Service } from "../../src/index.ts";
import { appleLikeEntry } from "../fixtures/connectorBackend.ts";
import { connectorWorld, install, replyOf, untilIdle } from "../fixtures/connectorWorld.ts";
import { listToolNames } from "../fixtures/mcp.ts";
import { call, startMission, temporary } from "../fixtures/service.ts";

const card = () =>
  call({ _tag: "ListConnectors" }).pipe(Effect.map((cards) => cards.find((entry) => entry.id === "applefake")));
const check = () => call({ _tag: "RequestApplePermission", connectorId: "applefake" });

describe("Apple app readiness", () => {
  it.live("requires a host check after a paired install and again after restarting the host", () =>
    Effect.gen(function* () {
      const world = yield* connectorWorld();
      yield* Effect.gen(function* () {
        const service = yield* Service;
        yield* service.handle(
          { _tag: "InstallConnector", connectorId: "applefake", hasConfirmedNotice: true },
          { isPairedDevice: true },
        );
        expect(yield* card()).toMatchObject({
          apps: [{ permission: "NotAskedYet" }, { isChosen: false }],
          state: "NeedsConnecting",
        });
        const quest = yield* startMission({ text: "Hello" });
        yield* untilIdle(quest.missionId);
        expect(yield* listToolNames(quest.threadId)).not.toContain("applefake__list-events");
        expect(world.received.applefake).toHaveLength(0);
        yield* check();
        expect(yield* card()).toMatchObject({ apps: [{ permission: "Allowed" }, { isChosen: false }], state: "Ready" });
      }).pipe(Effect.provide(world.layer));
      yield* Effect.gen(function* () {
        expect(yield* card()).toMatchObject({
          apps: [{ permission: "NotAskedYet" }, { isChosen: false }],
          state: "NeedsConnecting",
        });
        const quest = yield* startMission({ text: "Hello again" });
        yield* untilIdle(quest.missionId);
        expect(yield* listToolNames(quest.threadId)).not.toContain("applefake__list-events");
        yield* check();
        expect(yield* card()).toMatchObject({ state: "Ready" });
      }).pipe(Effect.provide(world.build()));
    }),
  );

  it.live("withdraws the revoked app after a real-shaped stdio denial and leaves another app available", () =>
    Effect.gen(function* () {
      const standIn = join(import.meta.dirname, "../fixtures/stand-in-mcp-server.mjs");
      const upstream =
        "[list-events] Error: 12:42: execution error: Not authorized to send Apple events to Calendar. (-1743)";
      const errorFlag = join(temporary("outlore-apple-permission-"), "denied");
      const backend = yield* Effect.acquireRelease(
        stdioMcpBackend({
          command: [process.execPath, standIn],
          env: {
            STAND_IN_MCP_TOOLS: JSON.stringify([
              { errorFlag, errorText: upstream, name: "list-calendars" },
              { name: "read-mail" },
              { errorFlag, errorText: upstream, name: "list-events" },
            ]),
          },
          label: "Apple apps",
          usesAppleAutomation: true,
        }),
        (server) => server.close,
      );
      const world = yield* connectorWorld({
        backends: Layer.succeed(ConnectorBackends, { open: () => Effect.succeed(backend) }),
        entries: [appleLikeEntry],
      });
      yield* Effect.gen(function* () {
        yield* install("applefake", ["calendar", "mail"]);
        yield* check();
        yield* Effect.sync(() => writeFileSync(errorFlag, ""));
        const quest = yield* startMission({ text: "call applefake__list-events {}" });
        const detail = yield* untilIdle(quest.missionId);
        expect(replyOf(detail)).toContain("marked Needs connecting");
        expect(JSON.stringify(detail)).toContain("Calendar needs permission again");
        expect(JSON.stringify(detail)).not.toContain(upstream);
        expect(yield* card()).toMatchObject({
          apps: [{ permission: "NotAllowed" }, { permission: "Allowed" }],
          state: "NeedsConnecting",
        });
        expect(yield* listToolNames(quest.threadId)).not.toContain("applefake__list-events");
        expect(yield* listToolNames(quest.threadId)).toContain("applefake__read-mail");
        expect((yield* check()).apps).toContainEqual({ app: "calendar", status: "NotAllowed" });
        yield* Effect.sync(() => unlinkSync(errorFlag));
        expect((yield* check()).apps).toContainEqual({ app: "calendar", status: "Allowed" });
        expect(yield* card()).toMatchObject({ state: "Ready" });
        const recovered = yield* startMission({ text: "call applefake__list-events {}" });
        expect(replyOf(yield* untilIdle(recovered.missionId))).toContain("done list-events");
      }).pipe(Effect.provide(world.layer));
    }),
  );
});
