import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { callTool, listToolNames } from "../fixtures/mcp.ts";
import { call, settle, startMission } from "../fixtures/service.ts";
import { idleWith, withHarnesses } from "../fixtures/standIns.ts";

describe("serving a thread's tools", () => {
  it.live("lists the thread tools without Claude Code's permission prompt tool", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const codex = yield* startMission({ harness: "codex", text: "Hello" });
      const claude = yield* startMission({ harness: "claude", text: "Hello" });
      yield* settle(codex.missionId, idleWith(1));
      const codexTools = yield* listToolNames(codex.threadId);
      const claudeTools = yield* listToolNames(claude.threadId);
      expect(codexTools).not.toContain("answer_prompt");
      expect(codexTools).toContain("request_approval");
      expect(claudeTools).toContain("answer_prompt");
    }).pipe(Effect.provide(layer));
  });

  it.live("refuses Claude Code's permission prompt tool to a harness that does not use it", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const codex = yield* startMission({ harness: "codex", text: "Hello" });
      yield* settle(codex.missionId, idleWith(1));
      const answered = yield* callTool(codex.threadId, "answer_prompt", {
        input: { command: "echo dummy" },
        tool_name: "Bash",
      });
      expect(answered.result.isError).toBe(true);
      expect(answered.result.content[0]?.text).toBe("This tool is not available to this thread.");
    }).pipe(Effect.provide(layer));
  });
});

describe("installing and updating harnesses", () => {
  it.live("offers an update only to a harness with a newer version, and updates it", () => {
    const { layer, updates } = withHarnesses();
    updates.available.codex = "0.167.0";
    return Effect.gen(function* () {
      const before = yield* call({ _tag: "ListHarnesses" });
      expect(before.harnesses.map((harness) => harness.update)).toEqual([null, "0.167.0", null]);
      const after = yield* call({ _tag: "UpdateHarness", harness: "codex" });
      expect(updates.updated).toEqual(["codex"]);
      expect(after.harnesses.map((harness) => harness.update)).toEqual([null, null, null]);
    }).pipe(Effect.provide(layer));
  });

  it.live("installs a missing harness and returns its refreshed status", () => {
    const { layer, missing } = withHarnesses();
    missing.add("codex");
    return Effect.gen(function* () {
      const before = yield* call({ _tag: "ListHarnesses" });
      expect(before.harnesses[1]?.problem).toBe("Not installed");
      const result = yield* call({ _tag: "InstallHarness", harness: "codex" });
      expect(missing.has("codex")).toBe(false);
      expect(result.harnesses[1]).toMatchObject({ problem: null, version: "fake" });
    }).pipe(Effect.provide(layer));
  });

  it.live("refuses installation over a working harness", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const result = yield* call({ _tag: "InstallHarness", harness: "codex" }).pipe(Effect.flip);
      expect(result.message).toContain("already installed");
    }).pipe(Effect.provide(layer));
  });
});
