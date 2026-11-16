import type { HarnessName } from "@outlore/contracts";
import { Effect } from "effect";
import { invalid } from "../core/index.ts";
import { harnessFacts } from "./harnessCatalog.ts";
import { runHarnessCommand } from "./lineProcess.ts";

/** How long a harness's own install or update command may run. */
export const updateTimeoutMillis = 5 * 60 * 1000;

/** Installs an official harness package using the computer's npm and its configured global prefix. */
export const installHarnessPackage = Effect.fnUntraced(function* (
  harness: HarnessName,
  run: typeof runHarnessCommand = runHarnessCommand,
  platform: NodeJS.Platform = process.platform,
) {
  const facts = harnessFacts[harness];
  const args = ["install", "--global", `${facts.packageName}@latest`];
  // npm is a .cmd launcher on Windows; the command contains only catalog constants.
  const result = yield* run(
    platform === "win32" ? "cmd.exe" : "npm",
    platform === "win32" ? ["/d", "/s", "/c", "npm", ...args] : args,
    {},
    updateTimeoutMillis,
  );
  if (result.code !== 0) {
    const detail = result.output.trim().split("\n").slice(-3).join(" ");
    return yield* invalid(
      `${facts.label} did not install. ${result.code === null ? "npm could not run or timed out. Install Node.js and npm, then try again. " : "Check npm's global installation permissions. "}${detail}`.trim(),
    );
  }
});
