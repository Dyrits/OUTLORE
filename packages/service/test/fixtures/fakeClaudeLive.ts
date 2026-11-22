import { readFileSync } from "node:fs";
import { Effect } from "effect";
import type { RunCommand } from "../../src/harness/vaultDenial.ts";

/**
 * A stand-in for `claude` in the live Vault-denial probe: `--version` answers, `/bin/cat` reads for real, and each
 * `-p` turn answers with what its settings would let the sandbox read: with the Vault's folder denied, the marker is
 * not read (unless the test says otherwise, to make the probe fail), without the denial both files are read.
 */
export const fakeClaudeLiveRun =
  (
    version: string,
    options: {
      readonly deniedTurnReadsMarker?: boolean;
      readonly openTurnReadsMarker?: boolean;
      readonly isNotInstalled?: boolean;
    } = {},
  ): RunCommand =>
  (command, args) => {
    if (options.isNotInstalled === true) return Effect.succeed({ code: null, output: "", stdout: "" });
    if (command === "/bin/cat") {
      try {
        const stdout = readFileSync(args[0] as string, "utf8");
        return Effect.succeed({ code: 0, output: stdout, stdout });
      } catch {
        return Effect.succeed({ code: 1, output: "", stdout: "" });
      }
    }
    if (args.includes("--version"))
      return Effect.succeed({ code: 0, output: `${version} (Claude Code)\n`, stdout: `${version} (Claude Code)\n` });
    const prompt = args[args.indexOf("-p") + 1] ?? "";
    // The probe's prompt quotes each command in backticks, as in "`cat /a path with spaces`", so a path from a
    // sandbox whose temp folder has spaces stays whole (vaultDenials.ts writes the prompt).
    const paths = [...prompt.matchAll(/`cat ([^`]+)`/g)].map((match) => match[1] as string);
    const controlPath = paths[0];
    const markerPath = paths[1];
    if (controlPath === undefined || markerPath === undefined)
      return Effect.succeed({ code: 1, output: "", stdout: "" });
    const settings = JSON.parse(args[args.indexOf("--settings") + 1] ?? "{}") as {
      sandbox?: { filesystem?: { denyRead?: ReadonlyArray<string> } };
    };
    const denied = (settings.sandbox?.filesystem?.denyRead?.length ?? 0) > 0;
    const control = readFileSync(controlPath, "utf8");
    const marker = readFileSync(markerPath, "utf8");
    const readsMarker = denied ? (options.deniedTurnReadsMarker ?? false) : (options.openTurnReadsMarker ?? true);
    const answer = readsMarker ? `${control}\n${marker}` : `${control}\nerror: cannot read ${markerPath}`;
    const stdout = JSON.stringify({ result: answer });
    return Effect.succeed({ code: 0, output: stdout, stdout });
  };
