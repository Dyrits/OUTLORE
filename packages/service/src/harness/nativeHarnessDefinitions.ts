import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EffortChoice, ModelOption } from "@outlore/contracts";
import { Effect, Queue } from "effect";
import { fieldOf, reducedEnvironmentOf, runShortCommand, startRpcProcess, textFieldOf } from "../core/index.ts";
import { makeClaudeHarness } from "./claude.ts";
import { makeCodexHarness } from "./codex.ts";
import { accountEnvironmentOf, claudeModels, harnessFacts } from "./harnessCatalog.ts";
import {
  type AdapterOptions,
  type HarnessDefinition,
  prefixOf,
  signedOut,
  unknownSignIn,
} from "./harnessDefinition.ts";
import type { SignInStatus } from "./harnessTools.ts";
import { makeMuseHarness } from "./muse.ts";
import { listMuseModels, readMuseSignIn } from "./museAccount.ts";
import { detectOpenCodeSandbox, xdgHomesOf } from "./openCodeSandbox.ts";
import { listOpenCodeEfforts, makeOpenCodeHarness } from "./opencode.ts";
import { makePiHarness } from "./pi.ts";
import { probePiModels } from "./piRpc.ts";
import { makeVibeHarness } from "./vibe.ts";
import { listVibeModels, readVibeSignIn } from "./vibeAccount.ts";

// Harness definitions for the native-protocol adapters (Claude Code, Codex, OpenCode, Vibe, Muse, Pi).

/** The effort levels Codex offers for one model, as its list says, lowest first. */
const codexEffortsOf = (model: unknown): Array<EffortChoice> => {
  const supported = fieldOf(model, "supportedReasoningEfforts");
  if (!Array.isArray(supported)) return [];
  return supported.flatMap((option): Array<EffortChoice> => {
    const level = textFieldOf(option, "reasoningEffort");
    return level !== null && level !== "default" ? [level] : [];
  });
};

/** Codex's models, read from its app server's own list. */
const listCodexModels = Effect.fnUntraced(
  function* (command: string, configDirectory: string | null) {
    const rpc = yield* startRpcProcess({
      args: ["app-server"],
      command,
      cwd: tmpdir(),
      env: reducedEnvironmentOf(accountEnvironmentOf("codex", configDirectory)),
      isJsonRpc2: false,
      label: "Codex",
    });
    const listed = yield* Effect.gen(function* () {
      yield* rpc.request("initialize", {
        capabilities: { experimentalApi: true, requestAttestation: false },
        clientInfo: { name: "outlore", title: "Outlore", version: "0.0.0" },
      });
      rpc.notify("initialized", {});
      return yield* rpc.request("model/list", {});
    }).pipe(Effect.timeout("20 seconds"), Effect.ensuring(Effect.sync(() => rpc.close())));
    yield* Queue.shutdown(rpc.incoming);
    const data = fieldOf(listed, "data");
    return Array.isArray(data)
      ? data.flatMap((model): Array<ModelOption> => {
          const id = textFieldOf(model, "id");
          return id === null || fieldOf(model, "hidden") === true
            ? []
            : [{ efforts: codexEffortsOf(model), id, label: textFieldOf(model, "displayName") ?? id }];
        })
      : [];
  },
  Effect.catch(() => Effect.succeed<ReadonlyArray<ModelOption>>([])),
);

/** The Claude Code harness definition. */
export const claudeDefinition: HarnessDefinition = {
  ...harnessFacts.claude,
  makeAdapter: ({ command, idleTimeout, launch, sandboxProblem, vaultFolder }) =>
    makeClaudeHarness({
      command,
      idleTimeout,
      sandboxProblem,
      ...prefixOf(launch),
      ...(launch?.userSettingsPath === undefined ? {} : { userSettingsPath: launch.userSettingsPath }),
      ...(vaultFolder === undefined ? {} : { vaultFolder }),
    }),
  readModels: () => Effect.succeed(claudeModels),
  readSignIn: Effect.fnUntraced(function* (command: string, configDirectory: string | null) {
    const { stdout } = yield* runShortCommand(
      command,
      ["auth", "status", "--json"],
      accountEnvironmentOf("claude", configDirectory),
    );
    let status: unknown = null;
    try {
      status = JSON.parse(stdout);
    } catch {
      return unknownSignIn;
    }
    if (fieldOf(status, "loggedIn") !== true) return signedOut;
    const plan = textFieldOf(status, "subscriptionType");
    const email = textFieldOf(status, "email");
    return {
      detail: [email, plan === null ? null : `Claude ${plan}`].filter((part) => part !== null).join(" · ") || null,
      signIn: "SignedIn",
    } satisfies SignInStatus;
  }),
};

/** The Codex harness definition. */
export const codexDefinition: HarnessDefinition = {
  ...harnessFacts.codex,
  makeAdapter: ({ command, idleTimeout, launch, vaultFolder }) =>
    makeCodexHarness({
      command,
      idleTimeout,
      ...prefixOf(launch),
      ...(vaultFolder === undefined ? {} : { vaultFolder }),
    }),
  readModels: (command, configDirectory) => listCodexModels(command, configDirectory),
  readSignIn: (command, configDirectory) =>
    runShortCommand(command, ["login", "status"], accountEnvironmentOf("codex", configDirectory)).pipe(
      Effect.map(({ code, output }): SignInStatus => {
        const text = output.trim();
        if (code === null) return unknownSignIn;
        return code === 0 && /logged in/i.test(text)
          ? { detail: text.replace(/^logged in using /i, "") || null, signIn: "SignedIn" }
          : signedOut;
      }),
    ),
};

/** The OpenCode harness definition. */
export const opencodeDefinition: HarnessDefinition = {
  ...harnessFacts.opencode,
  makeAdapter: Effect.fnUntraced(function* ({
    command,
    dataDirectory,
    idleTimeout,
    launch,
    sandboxProblem,
    vaultFolder,
  }: AdapterOptions) {
    const homes = yield* xdgHomesOf;
    return yield* makeOpenCodeHarness({
      command,
      idleTimeout,
      ...(launch?.instructionsFolder === undefined ? {} : { instructionsFolder: launch.instructionsFolder }),
      ...prefixOf(launch),
      sandbox:
        launch?.openCodeSandbox !== undefined
          ? launch.openCodeSandbox
          : detectOpenCodeSandbox({
              homes,
              ...(vaultFolder === undefined ? {} : { hidden: [vaultFolder] }),
              platform: process.platform,
              root: join(dataDirectory ?? tmpdir(), "opencode-sandbox"),
              sandboxProblem,
            }),
    });
  }),
  readEfforts: listOpenCodeEfforts,
  readModels: (command, configDirectory) =>
    runShortCommand(command, ["models"], accountEnvironmentOf("opencode", configDirectory)).pipe(
      Effect.map(({ stdout }) =>
        stdout
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => /^[\w.-]+\/\S+$/.test(line))
          .map((id) => ({ id, label: id })),
      ),
    ),
  // OpenCode lists one line per stored sign-in, each naming its provider.
  readSignIn: (command, configDirectory) =>
    runShortCommand(command, ["auth", "list"], accountEnvironmentOf("opencode", configDirectory)).pipe(
      Effect.map(({ code, stdout }): SignInStatus => {
        if (code === null) return unknownSignIn;
        const providers = stdout
          .split("\n")
          .filter((line) => /\bstored\b/.test(line))
          .map((line) => line.split(/\s{2,}/)[0]?.trim() ?? "")
          .filter((name) => name !== "");
        return providers.length === 0 ? signedOut : { detail: providers.join(", "), signIn: "SignedIn" };
      }),
    ),
};

/** The Mistral Vibe harness definition. */
export const vibeDefinition: HarnessDefinition = {
  ...harnessFacts.vibe,
  makeAdapter: ({ command, idleTimeout, launch }) => makeVibeHarness({ command, idleTimeout, ...prefixOf(launch) }),
  readModels: (command, configDirectory) => listVibeModels(command, configDirectory),
  readSignIn: (command, configDirectory) => readVibeSignIn(command, configDirectory),
};

/** The Muse harness definition. */
export const museDefinition: HarnessDefinition = {
  ...harnessFacts.muse,
  // Muse runs through its MSP adapter: every approval reaches the owner, a turn that cannot be mediated stops rather than guessing, and the CLI's self-update stays suppressed (muse.ts).
  makeAdapter: ({ command, idleTimeout, launch }) =>
    makeMuseHarness({ command, env: { MUSE_NO_AUTO_UPDATE: "1", ...launch?.env }, idleTimeout, ...prefixOf(launch) }),
  // The models come from a short-lived `muse serve` host's own list; none when the CLI is not installed.
  readModels: (command) =>
    listMuseModels(command).pipe(Effect.catch(() => Effect.succeed<ReadonlyArray<ModelOption>>([]))),
  // The device sign-in needs a terminal and the account probe rides experimental MSP, so an account shows Unknown until a live check proves a surface.
  readSignIn: () => readMuseSignIn(),
};

/** The Pi harness definition. */
export const piDefinition: HarnessDefinition = {
  ...harnessFacts.pi,
  // Pi runs fail-closed: every tool source of its own is denied for good on each turn, every question it asks is answered cancelled, and a turn that runs a tool anyway ends as a breach (piTools.ts); nothing Outlore has not approved ever runs (CHG-0644, provider-parity wave 3).
  makeAdapter: ({ command, idleTimeout, launch }) =>
    makePiHarness({
      command,
      idleTimeout,
      ...(launch?.env === undefined ? {} : { env: launch.env }),
      ...prefixOf(launch),
      provider: "pi",
    }),
  // Models come from a short-lived RPC probe of the running CLI - against the account's own directory for an added account, against the computer's own Pi otherwise; none when the CLI is absent or not signed in yet.
  readModels: (command, configDirectory) =>
    probePiModels({
      command,
      ...(configDirectory === null ? {} : { configDirectory }),
      provider: "pi",
    }).pipe(
      Effect.map((models): ReadonlyArray<ModelOption> => models),
      Effect.catch(() => Effect.succeed<ReadonlyArray<ModelOption>>([])),
    ),
  // Pi offers no sign-in status a read-only command answers; an account shows Unknown until its models list.
  readSignIn: () => Effect.succeed(unknownSignIn),
};
