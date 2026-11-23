import { describe, expect, it } from "@effect/vitest";
import type { HarnessName } from "@outlore/contracts";
import { Effect } from "effect";
import type { runShortCommand } from "../../src/core/index.ts";
import { installHarnessPackage } from "../../src/harness/harnessInstallation.ts";

describe("installing harness packages", () => {
  const packages: ReadonlyArray<readonly [HarnessName, string]> = [
    ["claude", "@anthropic-ai/claude-code"],
    ["codex", "@openai/codex"],
    ["opencode", "opencode-ai"],
    ["cline", "cline"],
    ["copilot", "@github/copilot"],
    ["pi", "@earendil-works/pi-coding-agent"],
  ];
  for (const [harness, packageName] of packages) {
    it.effect(`installs ${harness} from its official package`, () =>
      Effect.gen(function* () {
        const calls: Array<unknown> = [];
        const run: typeof runShortCommand = (...args) => {
          calls.push(args);
          return Effect.succeed({ code: 0, output: "installed", stdout: "installed" });
        };
        yield* installHarnessPackage(harness, run, "darwin");
        expect(calls).toEqual([["npm", ["install", "--global", `${packageName}@latest`], {}, 300000]]);
      }),
    );
  }

  const scripts: ReadonlyArray<readonly [HarnessName, string]> = [
    ["antigravity", "https://antigravity.google/cli/install.sh"],
    ["cursor", "https://cursor.com/install"],
    ["devin", "https://cli.devin.ai/install.sh"],
    ["hermes", "https://hermes-agent.nousresearch.com/install.sh"],
    ["muse", "https://dev.meta.ai/install.sh"],
  ];
  for (const [harness, url] of scripts) {
    it.effect(`runs the official ${harness} installer on macOS and Linux`, () =>
      Effect.gen(function* () {
        const calls: Array<unknown> = [];
        const run: typeof runShortCommand = (command, args, environment, timeout) => {
          calls.push({ command, environment, options: args.slice(4), timeout, url: args[3] });
          expect(args[0]).toBe("-c");
          expect(args[1]).toContain("curl");
          return Effect.succeed({ code: 0, output: "installed", stdout: "installed" });
        };
        for (const platform of ["darwin", "linux"] as const) {
          yield* installHarnessPackage(harness, run, platform);
        }
        const options = harness === "hermes" ? ["--non-interactive", "--skip-browser", "--skip-computer-use"] : [];
        expect(calls).toEqual([
          { command: "bash", environment: {}, options, timeout: 300000, url },
          { command: "bash", environment: {}, options, timeout: 300000, url },
        ]);
      }),
    );
  }

  it.effect("reports npm failures with the last output lines", () =>
    Effect.gen(function* () {
      const run: typeof runShortCommand = () =>
        Effect.succeed({ code: 1, output: "first\none\ntwo\nEACCES", stdout: "" });
      const failure = yield* installHarnessPackage("codex", run).pipe(Effect.flip);
      expect(failure.message).toContain("global installation permissions");
      expect(failure.message).toContain("one two EACCES");
    }),
  );

  it.effect("explains the npm prerequisite when the command cannot run", () =>
    Effect.gen(function* () {
      const run: typeof runShortCommand = () => Effect.succeed({ code: null, output: "", stdout: "" });
      const failure = yield* installHarnessPackage("claude", run).pipe(Effect.flip);
      expect(failure.message).toContain("Install Node.js and npm");
    }),
  );

  it.effect("uses the Windows command launcher for npm", () =>
    Effect.gen(function* () {
      const calls: Array<unknown> = [];
      const run: typeof runShortCommand = (...args) => {
        calls.push(args);
        return Effect.succeed({ code: 0, output: "", stdout: "" });
      };
      yield* installHarnessPackage("opencode", run, "win32");
      expect(calls).toEqual([
        ["cmd.exe", ["/d", "/s", "/c", "npm", "install", "--global", "opencode-ai@latest"], {}, 300000],
      ]);
    }),
  );

  it.effect("installs Mistral Vibe with uv, and names uv as the prerequisite", () =>
    Effect.gen(function* () {
      const calls: Array<unknown> = [];
      const run: typeof runShortCommand = (...args) => {
        calls.push(args);
        return Effect.succeed({ code: null, output: "", stdout: "" });
      };
      const failure = yield* installHarnessPackage("vibe", run, "darwin").pipe(Effect.flip);
      expect(calls).toEqual([["uv", ["tool", "install", "--python", "3.14", "mistral-vibe"], {}, 300000]]);
      expect(failure.message).toContain("Install uv, then try again.");
    }),
  );
});
