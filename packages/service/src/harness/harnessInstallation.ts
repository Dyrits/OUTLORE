import type { HarnessName } from "@outlore/contracts";
import { Effect } from "effect";
import { invalid, runShortCommand } from "../core/index.ts";
import { type HarnessFacts, harnessFacts } from "./harnessCatalog.ts";

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
  Exclude<HarnessFacts["installVia"], "script">,
  {
    readonly argsOf: (packageName: string) => ReadonlyArray<string>;
    readonly permissionAdvice: string;
    readonly prerequisite: string;
  }
>;

const officialScripts: Partial<Record<HarnessName, { url: string; args?: ReadonlyArray<string> }>> = {
  antigravity: { url: "https://antigravity.google/cli/install.sh" },
  cursor: { url: "https://cursor.com/install" },
  devin: { url: "https://cli.devin.ai/install.sh" },
  hermes: {
    args: ["--non-interactive", "--skip-browser", "--skip-computer-use"],
    url: "https://hermes-agent.nousresearch.com/install.sh",
  },
  muse: { url: "https://dev.meta.ai/install.sh" },
};

// Download completely before running so a failed transfer cannot execute a partial installer.
const runOfficialScript = [
  "installer=$(mktemp) || exit",
  "trap 'rm -f \"$installer\"' EXIT",
  "url=$1",
  "shift",
  'curl --fail --silent --show-error --location --proto "=https" --proto-redir "=https" --output "$installer" "$url" || exit',
  'bash "$installer" "$@" </dev/null',
].join("\n");

const outputDetailOf = (output: string) => output.trim().split("\n").slice(-3).join(" ");

/** Installs a harness using its official package or provider installer. */
export const installHarnessPackage = Effect.fnUntraced(function* (
  harness: HarnessName,
  run: typeof runShortCommand = runShortCommand,
  platform: NodeJS.Platform = process.platform,
) {
  const facts = harnessFacts[harness];
  if (facts.installVia === "script") {
    const script = officialScripts[harness];
    if (script === undefined || (platform !== "darwin" && platform !== "linux"))
      return yield* invalid(
        `Automatic installation of ${facts.label} is available on macOS and Linux. Install it on this host using the provider’s instructions, then press Refresh.`,
      );
    const result = yield* run(
      "bash",
      ["-c", runOfficialScript, "provider-installer", script.url, ...(script.args ?? [])],
      {},
      updateTimeoutMillis,
    );
    if (result.code !== 0) {
      const detail = outputDetailOf(result.output);
      const advice =
        result.code === null
          ? "The installer could not start or timed out. Make sure Bash and curl are installed."
          : "";
      return yield* invalid(`${facts.label} did not install. ${advice} ${detail}`.trim());
    }
    return;
  }
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
    const detail = outputDetailOf(result.output);
    const advice =
      result.code === null
        ? `${tool} could not run or timed out. Install ${installers[tool].prerequisite}, then try again.`
        : installers[tool].permissionAdvice;
    return yield* invalid(`${facts.label} did not install. ${advice} ${detail}`.trim());
  }
});
