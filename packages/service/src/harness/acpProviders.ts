import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Duration, Effect, Queue } from "effect";
import { fieldOf, HarnessFailure, reducedEnvironmentOf, type TurnRequest, textFieldOf } from "../core/index.ts";
import { needsConfiguredHomeOf } from "./accountIsolation.ts";
import { type AcpDialect, makeAcpHarness } from "./acpHarness.ts";
import { checkAcpAgentVersion, startAcpRpcProcess } from "./acpLaunch.ts";
import { type AcpProviderDefinition, acpLaunchOf } from "./acpProviderDefinition.ts";
import { acpInitializeParams } from "./acpSession.ts";
import type { SignInStatus } from "./harnessTools.ts";

// ACP (Agent Client Protocol) providers beyond the harnesses Outlore already runs: audited provider definitions
// (acpProviderDefinition.ts), a read-only model probe, and the turn adapter, which is the shared ACP protocol
// (acpHarness.ts) in the dialect of the provider's definition.

/** A model advertised by an ACP session. */
export type AcpProviderModel = { readonly id: string; readonly label: string };

/** How a model probe starts. */
export type AcpProbeOptions = {
  readonly command: string;
  /** The account's folder the probe runs against, or null/absent for the computer's own sign-in; the definition's isolation decides what it redirects. */
  readonly configDirectory?: string | null;
  readonly definition: AcpProviderDefinition;
  /** Extra environment for the launch, such as a stand-in's knobs in checks. */
  readonly env?: Readonly<Record<string, string>>;
  readonly prefixArgs?: ReadonlyArray<string>;
  /** Keep JSON-RPC error codes when the caller needs to distinguish authentication failures. */
  readonly preserveProviderErrors?: boolean;
};

/**
 * Probe a fresh session without sending a prompt or exposing the thread's MCP server.
 * It launches on the same isolation a turn does, so an account's probe reads the account's own sign-in and models.
 * A provider whose account folder must be configured is never probed without one: its own default folder is the owner's.
 */
export const probeAcpProviderModels = Effect.fnUntraced(function* (options: AcpProbeOptions) {
  const definition = options.definition;
  if (needsConfiguredHomeOf(definition.isolation) && (options.configDirectory ?? null) === null)
    return yield* new HarnessFailure({
      reason: `${definition.label} reads its models only from an account's configured folder: give the account's folder as configDirectory.`,
    });
  const launch = acpLaunchOf(definition, {
    ...(options.configDirectory === undefined ? {} : { configDirectory: options.configDirectory }),
    ...(options.env === undefined ? {} : { env: options.env }),
  });
  const cwd = yield* Effect.sync(() => mkdtempSync(join(tmpdir(), "outlore-acp-probe-")));
  return yield* Effect.gen(function* () {
    const rpc = yield* startAcpRpcProcess({
      args: [...(options.prefixArgs ?? []), ...launch.args],
      command: options.command,
      cwd,
      env: reducedEnvironmentOf(launch.env, launch.scrubEnvPrefixes),
      ...(launch.hasIsolatedTempDir === true ? { hasIsolatedTempDir: true } : {}),
      label: launch.label,
    });
    return yield* Effect.gen(function* () {
      const probeFailure = (step: string) =>
        Effect.mapError((failure: unknown) =>
          options.preserveProviderErrors === true && failure instanceof HarnessFailure
            ? failure
            : new HarnessFailure({ reason: `${launch.label} did not answer ${step} in time.` }),
        );
      const initialized = yield* rpc
        .request("initialize", acpInitializeParams)
        .pipe(Effect.timeout("20 seconds"), probeFailure("initialize"));
      yield* checkAcpAgentVersion(initialized, launch.protocol?.minimumAgentVersion, launch.label);
      const session = yield* rpc
        .request("session/new", { cwd, mcpServers: [] })
        .pipe(Effect.timeout("20 seconds"), probeFailure("session/new"));
      const models = fieldOf(fieldOf(session, "models"), "availableModels");
      if (Array.isArray(models))
        return models.flatMap((model): Array<AcpProviderModel> => {
          const id = textFieldOf(model, "modelId");
          return id === null ? [] : [{ id, label: textFieldOf(model, "name") ?? id }];
        });
      const config = fieldOf(session, "configOptions");
      if (!Array.isArray(config)) return [];
      return config.flatMap((option): Array<AcpProviderModel> => {
        const choices = textFieldOf(option, "id") === "model" ? fieldOf(option, "options") : null;
        if (!Array.isArray(choices)) return [];
        return choices.flatMap((choice): Array<AcpProviderModel> => {
          const id = textFieldOf(choice, "value");
          return id === null ? [] : [{ id, label: textFieldOf(choice, "name") ?? id }];
        });
      });
    }).pipe(Effect.ensuring(Effect.sync(() => rpc.close()).pipe(Effect.andThen(Queue.shutdown(rpc.incoming)))));
  }).pipe(Effect.ensuring(Effect.sync(() => rmSync(cwd, { force: true, recursive: true }))));
});

/** How a probe-based sign-in read starts. */
export type AcpSignInReadOptions = {
  readonly command: string;
  /** The account's folder the sign-in is read for, or null/absent for the computer's own. */
  readonly configDirectory?: string | null;
  readonly definition: AcpProviderDefinition;
  /** Extra environment for the launch, such as a stand-in's knobs in checks. */
  readonly env?: Readonly<Record<string, string>>;
  /** Arguments placed before the provider's own, used to run a stand-in script in checks. */
  readonly prefixArgs?: ReadonlyArray<string>;
};

/**
 * Reads a provider's sign-in from the session probe that lists models, on the same launch a turn uses.
 * A session with models reports signed in, and the provider's own signed-out error code reports signed out.
 * An empty list or any other failure reports unknown.
 */
export const readAcpProviderSignIn = (options: AcpSignInReadOptions): Effect.Effect<SignInStatus> =>
  probeAcpProviderModels({
    command: options.command,
    definition: options.definition,
    preserveProviderErrors: true,
    ...(options.configDirectory === undefined ? {} : { configDirectory: options.configDirectory }),
    ...(options.env === undefined ? {} : { env: options.env }),
    ...(options.prefixArgs === undefined ? {} : { prefixArgs: options.prefixArgs }),
  }).pipe(
    Effect.map((models): SignInStatus => ({ detail: null, signIn: models.length > 0 ? "SignedIn" : "Unknown" })),
    Effect.catch((failure) =>
      Effect.succeed<SignInStatus>({
        detail: null,
        signIn:
          failure instanceof HarnessFailure &&
          options.definition.signedOutCode !== null &&
          failure.code === options.definition.signedOutCode
            ? "SignedOut"
            : "Unknown",
      }),
    ),
  );

/** How the generic ACP adapter starts one provider's harness. */
export type AcpProviderHarnessOptions = {
  /** The provider's ACP executable. */
  readonly command: string;
  /** The provider's definition, resolved against each thread's own account at its launch. */
  readonly definition: AcpProviderDefinition;
  /** Extra environment for every launch, such as a stand-in's knobs in checks. */
  readonly env?: Readonly<Record<string, string>>;
  /** How long an idle thread keeps its process. */
  readonly idleTimeout: Duration.Input;
  /** Arguments placed before the definition's own, used to run a stand-in script in checks. */
  readonly prefixArgs?: ReadonlyArray<string>;
};

/**
 * The dialect of a provider the generic adapter runs, from its definition.
 * Each thread's launch resolves the definition against that thread's account, so its isolation decides where the state lives; the protocol departures the definition names ride along as data.
 */
const dialectOf = (
  definition: AcpProviderDefinition,
  env: Readonly<Record<string, string>> | undefined,
): AcpDialect => ({
  fileEdits: "acp",
  ...(definition.hasIsolatedTempDir === true ? { hasIsolatedTempDir: true } : {}),
  label: definition.label,
  launchOf: Effect.fnUntraced(function* (request: TurnRequest) {
    // A provider whose home must be configured runs only against its account folder: without one it would
    // fall back to the user's own provider directory (unrepaired, or worse, holding the owner's sign-in),
    // so the turn fails instead of starting.
    if (needsConfiguredHomeOf(definition.isolation) && request.configDirectory === null)
      return yield* new HarnessFailure({
        reason: `${definition.label} runs against the account folder, and this thread has none to be its state home.`,
      });
    // The account's own folder becomes the provider's state home, so its sign-in, sessions, config, and MCP
    // inheritance stay with the account (provider-accounts); without one, the provider uses its own default.
    const launch = acpLaunchOf(definition, {
      configDirectory: request.configDirectory,
      ...(env === undefined ? {} : { env }),
    });
    return { args: launch.args, env: reducedEnvironmentOf(launch.env, launch.scrubEnvPrefixes) };
  }),
  ...(definition.protocol?.inlineFailurePattern === undefined
    ? {}
    : { inlineFailurePattern: definition.protocol.inlineFailurePattern }),
  ...(definition.protocol?.minimumAgentVersion === undefined
    ? {}
    : { minimumAgentVersion: definition.protocol.minimumAgentVersion }),
  canResumeSessions: definition.protocol?.canResumeSessions === true,
  questionIdPrefix: definition.protocol?.questionIdPrefix ?? null,
  ...(definition.protocol?.systemPromptNamespace === undefined
    ? {}
    : { systemPromptNamespace: definition.protocol.systemPromptNamespace }),
  ...(definition.protocol?.steersWithPromptFrom === undefined
    ? {}
    : { steersWithPromptFrom: definition.protocol.steersWithPromptFrom }),
  toolServer: "negotiated",
  usage: "perPrompt",
});

/**
 * Runs each thread in one long-lived process of the provider's ACP server, closed with the scope that made it (acpHarness.ts).
 * These providers run without a sandbox Outlore enforces here, so the adapter reports Unprotected: every tool
 * call it asks about asks the owner.
 */
export const makeAcpProviderHarness = (options: AcpProviderHarnessOptions) =>
  makeAcpHarness({
    command: options.command,
    dialect: dialectOf(options.definition, options.env),
    idleTimeout: options.idleTimeout,
    ...(options.prefixArgs === undefined ? {} : { prefixArgs: options.prefixArgs }),
  });
