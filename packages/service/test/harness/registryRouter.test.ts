import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { afterEach, vi } from "vitest";
import { acpMcpBridgePathOf } from "../../src/harness/acpMcpBridge.ts";
import { settle, startMission } from "../fixtures/service.ts";
import { answerOpen, idleWith, withHarnesses } from "../fixtures/standIns.ts";

// The test router is the app's own (`makeHarnessRouter`), so what the registry wraps around a launch reaches the stand-ins.
// Each check below reads what a stand-in saw of a registration fact that only the registry sets: none of them could pass on a router built beside it.

afterEach(() => vi.unstubAllEnvs());

type Seen = Record<string, unknown>;

describe("the test router runs the registry's registration glue", () => {
  it.live("starts Muse with the registry's update suppression", () => {
    const { layer, logged } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "muse", text: "Hello" });
      yield* settle(started.missionId, idleWith(1));
      const hosts = (logged() as Array<Seen>).filter((entry) => "noAutoUpdate" in entry);
      expect(hosts.map((entry) => entry.noAutoUpdate)).toEqual(["1"]);
    }).pipe(Effect.provide(layer));
  });

  it.live("starts Antigravity on one pinned home in its argv and its environment, with the tool server bridged", () => {
    vi.stubEnv("GEMINI_HOME", "/stand-in/gemini-home");
    const { layer, logged } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "antigravity", text: "Hello" });
      yield* answerOpen("Allow");
      yield* settle(started.missionId, idleWith(2));
      const session = logged().find((entry) => entry.method === "session/new");
      expect(session?.launch?.argv).toEqual([
        "acp",
        "--gemini-dir=/stand-in/gemini-home",
        "--app-data-dir=antigravity-acp",
      ]);
      expect(session?.launch?.env.GEMINI_HOME).toBe("/stand-in/gemini-home");
      expect(session?.launch?.env.AGY_CLI_DISABLE_AUTO_UPDATE).toBe("true");
      // The fake advertises no HTTP MCP support, so the registry's adapter hands over the stdio bridge to the thread's own tool server.
      const params = (session?.params ?? {}) as { mcpServers?: Array<{ args: Array<string> }> };
      expect(params.mcpServers).toHaveLength(1);
      expect(params.mcpServers?.[0]?.args[0]).toBe(acpMcpBridgePathOf());
    }).pipe(Effect.provide(layer));
  });
});
