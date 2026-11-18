import type { HarnessName } from "@outlore/contracts";
import { Effect } from "effect";
import { invalid } from "../core/index.ts";
import { type HarnessFacts, harnessFacts } from "./harnessCatalog.ts";
import { runHarnessCommand } from "./lineProcess.ts";

/** How long a harness's own install or update command may run. */
export const updateTimeoutMillis = 5 * 60 * 1000;

/** How each installer is run, and what its failures tell the owner. */
const installers = {
  npm: {
    argsOf: (packageName: string) => ["install", "--global", `${packageName}@latest`],
    permissionAdvice: "Check npm's global installation permissions.",
    prerequisite: "Node.js and npm",
  },
  // Vibe is a Python package, installed with `uv tool install`, as its own documentation does.
  uv: {
    argsOf: (packageName: string) => ["tool", "install", "--python", "3.14", packageName],
    permissionAdvice: "Check uv's installation permissions.",
    prerequisite: "uv",
  },
} as const satisfies Record<
  HarnessFacts["installVia"],
  {
    readonly argsOf: (packageName: string) => ReadonlyArray<string>;
    readonly permissionAdvice: string;
    readonly prerequisite: string;
  }
>;

/** Installs an official harness package with the computer's npm (and its configured global prefix) or uv. */
export const installHarnessPackage = Effect.fnUntraced(function* (
  harness: HarnessName,
  run: typeof runHarnessCommand = runHarnessCommand,
  platform: NodeJS.Platform = process.platform,
) {
  const facts = harnessFacts[harness];
  const tool = facts.installVia;
  const args = installers[tool].argsOf(facts.packageName);
  // npm is a .cmd launcher on Windows; the command contains only catalog constants.
  const result = yield* run(
    platform === "win32" ? "cmd.exe" : tool,
    platform === "win32" ? ["/d", "/s", "/c", tool, ...args] : args,
    {},
    updateTimeoutMillis,
  );
  if (result.code !== 0) {
    const detail = result.output.trim().split("\n").slice(-3).join(" ");
    const advice =
      result.code === null
        ? `${tool} could not run or timed out. Install ${installers[tool].prerequisite}, then try again.`
        : installers[tool].permissionAdvice;
    return yield* invalid(`${facts.label} did not install. ${advice} ${detail}`.trim());
  }
});
