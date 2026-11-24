import { execFileSync } from "node:child_process";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { vi } from "vitest";
import { terminalSignInScript } from "../../src/harness/harnessTools.ts";
import { HarnessTools, liveHarnessToolsLayer } from "../../src/index.ts";
import { callTool, listToolNames } from "../fixtures/mcp.ts";
import { call, settle, startMission, temporary } from "../fixtures/service.ts";
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
  it.live("updates Vibe without starting its interactive interface", () => {
    const calls: Array<unknown> = [];
    return Effect.gen(function* () {
      const tools = yield* HarnessTools;
      yield* tools.update("vibe");
      expect(calls).toEqual([["uv", ["tool", "upgrade", "mistral-vibe"], {}, 300000]]);
    }).pipe(
      Effect.provide(
        liveHarnessToolsLayer(
          {
            antigravity: "antigravity",
            claude: "claude",
            cline: "cline",
            codex: "codex",
            copilot: "copilot",
            cursor: "cursor",
            devin: "devin",
            hermes: "hermes",
            muse: "muse",
            opencode: "opencode",
            pi: "pi",
            vibe: "vibe-acp",
          },
          (...args) => {
            calls.push(args);
            return Effect.succeed({ code: 0, output: "", stdout: "" });
          },
        ),
      ),
    );
  });

  it.live("refuses Update on a harness that has no update command of its own", () => {
    const calls: Array<unknown> = [];
    return Effect.gen(function* () {
      const tools = yield* HarnessTools;
      // Muse's and Pi's CLIs have none: nothing runs, and the owner reads how their releases arrive instead.
      const failure = yield* tools.update("muse").pipe(Effect.flip);
      expect(failure.message).toContain("Muse has no update command");
      expect(failure.message).toContain("Refresh");
      const pi = yield* tools.update("pi").pipe(Effect.flip);
      expect(pi.message).toContain("Pi has no update command");
      expect(calls).toEqual([]);
    }).pipe(
      Effect.provide(
        liveHarnessToolsLayer(
          {
            antigravity: "antigravity",
            claude: "claude",
            cline: "cline",
            codex: "codex",
            copilot: "copilot",
            cursor: "cursor",
            devin: "devin",
            hermes: "hermes",
            muse: "muse",
            opencode: "opencode",
            pi: "pi",
            vibe: "vibe-acp",
          },
          (...args) => {
            calls.push(args);
            return Effect.succeed({ code: 0, output: "", stdout: "" });
          },
        ),
      ),
    );
  });

  it.live("offers an update only to a harness with a newer version, and updates it", () => {
    const { layer, updates } = withHarnesses();
    updates.available.codex = "0.167.0";
    return Effect.gen(function* () {
      const before = yield* call({ _tag: "ListHarnesses" });
      expect(before.harnesses.map((harness) => harness.update)).toEqual([
        null,
        "0.167.0",
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      ]);
      const after = yield* call({ _tag: "UpdateHarness", harness: "codex" });
      expect(updates.updated).toEqual(["codex"]);
      expect(after.harnesses.map((harness) => harness.update)).toEqual([
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      ]);
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

describe("signing in to a harness", () => {
  it.live("runs a sign-in without a terminal to its end, and a terminal one is opened and left to the window", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const claude = yield* call({ _tag: "SignInAccount", accountId: null, harness: "claude" });
      expect(claude?.harnesses.map((harness) => harness.name)).toEqual([
        "claude",
        "codex",
        "opencode",
        "vibe",
        "hermes",
        "muse",
        "pi",
        "cursor",
        "copilot",
        "cline",
        "devin",
        "antigravity",
      ]);
      expect(yield* call({ _tag: "SignInAccount", accountId: null, harness: "opencode" })).toBeNull();
    }).pipe(Effect.provide(layer));
  });

  // The live tool runs the sign-in on macOS only; elsewhere it tells the owner the command.
  it.live.skipIf(process.platform !== "darwin")(
    "waits for the harness's own sign-in in the account's folder, with no window",
    () => {
      const folder = temporary("outlore-sign-in-test-");
      const log = join(folder, "log");
      const command = join(folder, "claude");
      writeFileSync(
        command,
        `#!/bin/sh\necho "$CLAUDE_CONFIG_DIR $*" > ${JSON.stringify(log)}\nif [ -f ${JSON.stringify(join(folder, "fail"))} ]; then echo one; echo two; echo 'no way'; exit 1; fi\necho 'Login successful'\n`,
      );
      chmodSync(command, 0o755);
      return Effect.gen(function* () {
        const tools = yield* HarnessTools;
        expect(yield* tools.openSignIn("claude", "/accounts/second")).toBe("Finished");
        expect(readFileSync(log, "utf8").trim()).toBe("/accounts/second auth login");
        writeFileSync(join(folder, "fail"), "");
        const failure = yield* tools.openSignIn("claude", null).pipe(Effect.flip);
        expect(failure.message).toBe("Claude Code did not sign in. one two no way");
      }).pipe(
        Effect.provide(
          liveHarnessToolsLayer({
            antigravity: "antigravity",
            claude: command,
            cline: "cline",
            codex: "codex",
            copilot: "copilot",
            cursor: "cursor",
            devin: "devin",
            hermes: "hermes",
            muse: "muse",
            opencode: "opencode",
            pi: "pi",
            vibe: "vibe-acp",
          }),
        ),
      );
    },
  );

  it("makes a terminal window that closes itself only after a sign-in that succeeded", () => {
    const script = terminalSignInScript({
      command: "'opencode' auth login",
      environment: ["XDG_DATA_HOME='/accounts/x'"],
      label: "OpenCode",
      path: "/tmp/outlore-sign-in/opencode.command",
    });
    expect(() => execFileSync("sh", ["-n"], { input: script })).not.toThrow();
    const [success, failure] = script.split("\nelse\n");
    expect(success).toContain("osascript");
    expect(failure).not.toContain("osascript");
    expect(failure).toContain("Sign-in did not finish");
    expect(script).toContain("export XDG_DATA_HOME='/accounts/x'");
    expect(script).toContain('exit "$status"');
  });

  it.live("offers Gemini's ACP sign-in while Devin still needs its own surface", () => {
    return Effect.gen(function* () {
      const tools = yield* HarnessTools;
      const failure = yield* tools.openSignIn("devin", null).pipe(Effect.flip);
      expect(failure.message).toContain("Devin has no sign-in command of its own");
      expect(failure.message).toContain("press Refresh");
      const folder = temporary("outlore-gemini-sign-in-");
      const captured = join(folder, "captured");
      const opener = join(folder, "open");
      writeFileSync(opener, `#!/bin/sh\n/bin/cat "$1" > ${JSON.stringify(captured)}\n/bin/rm "$1"\n`, {
        mode: 0o755,
      });
      const path = `${folder}:${process.env.PATH}`;
      vi.stubEnv("PATH", path);
      vi.stubEnv("GEMINI_HOME", join(folder, "Gemini's state"));
      try {
        const home = `${folder}/Gemini'\\''s state`;
        const expected = `'antigravity' acp '--gemini-dir=${home}' --app-data-dir=antigravity-acp --login`;
        if (process.platform === "darwin") {
          expect(yield* tools.openSignIn("antigravity", null)).toBe("Opened");
          const script = readFileSync(captured, "utf8");
          expect(script).toContain(expected);
          // The sign-in runs on the launch's own environment: the update squeeze and the one home the flag also names.
          expect(script).toContain("export AGY_CLI_DISABLE_AUTO_UPDATE='true'");
          expect(script).toContain(`export GEMINI_HOME='${home}'`);
          expect(script).toContain(`export PATH='${path}'`);
        } else {
          const manual = yield* tools.openSignIn("antigravity", null).pipe(Effect.flip);
          expect(manual.message).toBe(
            `Open a terminal on this computer and run: AGY_CLI_DISABLE_AUTO_UPDATE='true' GEMINI_HOME='${home}' ${expected}`,
          );
        }
      } finally {
        vi.unstubAllEnvs();
      }
    }).pipe(
      Effect.provide(
        liveHarnessToolsLayer({
          antigravity: "antigravity",
          claude: "claude",
          cline: "cline",
          codex: "codex",
          copilot: "copilot",
          cursor: "cursor",
          devin: "devin",
          hermes: "hermes",
          muse: "muse",
          opencode: "opencode",
          pi: "pi",
          vibe: "vibe-acp",
        }),
      ),
    );
  });
});
