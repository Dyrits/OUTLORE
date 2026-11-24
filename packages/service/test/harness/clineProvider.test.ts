import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "@effect/vitest";
import { Effect } from "effect";
import type { HarnessEvent } from "../../src/core/index.ts";
import { cline } from "../../src/harness/clineProvider.ts";
import { type AcpFakeConfig, acpFakeEnv, acpFakeRequest, acpFakeScript } from "../fixtures/acpFake.ts";
import { standInHarness, standInProbe } from "../fixtures/providerStandIns.ts";
import { turnRequestOf } from "../fixtures/turns.ts";

// Fixture checks of the Cline harness against the one configurable ACP stand-in, acpFake.mjs: the launch carries the pinned argv
// and environment (the local session backend and the CLI's self-update suppression), and a turn mediates its tool calls through the owner exactly as the generic ACP adapter does.

const models = [["Claude Sonnet 4.6", "anthropic/claude-sonnet-4.6"]] as const;
/** The launch surface the stand-in records: the local session backend and the self-update suppression. */
const logEnv = ["CLINE_SESSION_BACKEND_MODE", "CLINE_NO_AUTO_UPDATE"];
const configOf = (mode: "probe" | "turn"): AcpFakeConfig => ({ logEnv, mode, models, usage: "update" });

const probeOf = (log: string) =>
  standInProbe(cline, {
    command: "node",
    env: acpFakeEnv(log, configOf("probe")),
    prefixArgs: [acpFakeScript],
  }).pipe(Effect.runPromise);

describe("probing the cline CLI", () => {
  it("reads the session's models with the pinned argv and environment", async () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-cline-probe-"));
    const log = join(directory, "calls");
    try {
      const models = await probeOf(log);
      expect(models).toEqual([{ id: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6" }]);
      await vi.waitFor(() => expect(readFileSync(log, "utf8")).toContain('"exit":true'));
      const entry = acpFakeRequest(log, "session/new");
      expect(entry.launch?.argv).toEqual(["--acp"]);
      expect(entry.launch?.env.CLINE_SESSION_BACKEND_MODE).toBe("local");
      expect(entry.launch?.env.CLINE_NO_AUTO_UPDATE).toBe("1");
      expect(entry.params?.mcpServers).toEqual([]);
    } finally {
      rmSync(directory, { force: true, maxRetries: 5, recursive: true, retryDelay: 50 });
    }
  });
});

describe("running a thread on the cline CLI", () => {
  const harnessOf = (log: string) =>
    standInHarness("cline", {
      command: "node",
      env: acpFakeEnv(log, configOf("turn")),
      idleTimeout: "10 minutes",
      prefixArgs: [acpFakeScript],
    });

  it.live("mediates a tool permission request the owner allows", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-cline-turn-"));
    const log = join(directory, "calls");
    const events: Array<HarnessEvent> = [];
    return Effect.gen(function* () {
      const harness = yield* harnessOf(log);
      const outcome = yield* harness.runTurn(
        turnRequestOf({ onEvent: (event) => Effect.sync(() => events.push(event)), text: "run git push" }),
      );
      expect(outcome.isInterrupted).toBe(false);
      expect(events.filter((event) => event._tag === "Reply").map((event) => event.text)).toEqual([
        "Working",
        "tool was allow_once",
      ]);
      expect(events).toContainEqual({
        _tag: "ToolCall",
        id: "call-1",
        input: { command: "git push origin main" },
        toolName: "git push",
      });
      expect(acpFakeRequest(log, "session/prompt").launch?.argv).toEqual(["--acp"]);
    }).pipe(
      Effect.scoped,
      Effect.ensuring(
        Effect.sync(() => rmSync(directory, { force: true, maxRetries: 5, recursive: true, retryDelay: 50 })),
      ),
    );
  });

  it.live("answers a denial with the provider's reject option and carries the turn on", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-cline-turn-"));
    const log = join(directory, "calls");
    const events: Array<HarnessEvent> = [];
    return Effect.gen(function* () {
      const harness = yield* harnessOf(log);
      const outcome = yield* harness.runTurn(
        turnRequestOf({
          askOwner: () => Effect.succeed({ isAllowed: false, text: "" }),
          onEvent: (event) => Effect.sync(() => events.push(event)),
          text: "run git push",
        }),
      );
      expect(outcome.isInterrupted).toBe(false);
      expect(events.filter((event) => event._tag === "Reply").map((event) => event.text)).toEqual([
        "Working",
        "tool was reject_once",
      ]);
    }).pipe(
      Effect.scoped,
      Effect.ensuring(
        Effect.sync(() => rmSync(directory, { force: true, maxRetries: 5, recursive: true, retryDelay: 50 })),
      ),
    );
  });
});
