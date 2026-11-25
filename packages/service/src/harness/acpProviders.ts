import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Duration, Effect, Queue } from "effect";
import {
  fieldOf,
  HarnessFailure,
  reducedEnvironmentOf,
  startRpcProcess,
  type TurnRequest,
  textFieldOf,
} from "../core/index.ts";
import { type AcpDialect, makeAcpHarness } from "./acpHarness.ts";
import { type AcpProviderDefinition, type AcpProviderProfile, acpLaunchOf } from "./acpProviderDefinition.ts";
import { acpInitializeParams } from "./acpSession.ts";
import type { SignInStatus } from "./harnessTools.ts";

// ACP (Agent Client Protocol) providers beyond the harnesses Outlore already runs: audited provider definitions
// (acpProviderDefinition.ts), a read-only model probe, and the turn adapter, which is the shared ACP protocol
// (acpHarness.ts) in the dialect of the provider's launch profile.

/** A model advertised by an ACP session. */
export type AcpProviderModel = { readonly id: string; readonly label: string };

/** Probe a fresh session without sending a prompt or exposing the thread's MCP server. */
export const probeAcpProviderModels = Effect.fnUntraced(function* (options: {
  readonly command: string;
  readonly profile: AcpProviderProfile;
  readonly prefixArgs?: ReadonlyArray<string>;
  /** Keep JSON-RPC error codes when the caller needs to distinguish authentication failures. */
  readonly preserveProviderErrors?: boolean;
  /**
   * A caller-supplied state home for profiles that need one configured (`needsConfiguredStateHome`): the
   * probe uses it as the profile's state home verbatim, neither creating nor removing it, so a prepared
   * account home can be probed instead of an empty redirect.
   */
  readonly stateHome?: string;
}) {
  const stateHomeEnv = options.profile.stateHomeEnv;
  if (
    stateHomeEnv !== undefined &&
    options.profile.needsConfiguredStateHome === true &&
    options.stateHome === undefined
  )
    return yield* new HarnessFailure({
      reason: `${options.profile.label} reads its models only from a configured state home: give the account's ${stateHomeEnv} folder as stateHome.`,
    });
  const cwd = yield* Effect.sync(() => mkdtempSync(join(tmpdir(), "outlore-acp-probe-")));
  return yield* Effect.gen(function* () {
    const stateHome = stateHomeEnv === undefined ? null : (options.stateHome ?? join(cwd, "state-home"));
    if (stateHome !== null && options.stateHome === undefined)
      yield* Effect.sync(() => mkdirSync(stateHome, { recursive: true }));
    const rpc = yield* startRpcProcess({
      args: [...(options.prefixArgs ?? []), ...options.profile.args],
      command: options.command,
      cwd,
      env: reducedEnvironmentOf({
        ...options.profile.env,
        ...(stateHome === null || stateHomeEnv === undefined ? {} : { [stateHomeEnv]: stateHome }),
      }),
      isJsonRpc2: true,
      isTreeKilled: true,
      label: options.profile.label,
    });
    return yield* Effect.gen(function* () {
      const probeFailure = (step: string) =>
        Effect.mapError((failure: unknown) =>
          options.preserveProviderErrors === true && failure instanceof HarnessFailure
            ? failure
            : new HarnessFailure({ reason: `${options.profile.label} did not answer ${step} in time.` }),
        );
      yield* rpc
        .request("initialize", acpInitializeParams)
        .pipe(Effect.timeout("20 seconds"), probeFailure("initialize"));
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
  readonly definition: AcpProviderDefinition;
  /** Extra environment for the launch, such as a stand-in's knobs in checks. */
  readonly env?: Record<string, string>;
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
    preserveProviderErrors: true,
    ...(options.prefixArgs === undefined ? {} : { prefixArgs: options.prefixArgs }),
    profile: acpLaunchOf(options.definition, options.env === undefined ? {} : { env: options.env }),
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
  /** How long an idle thread keeps its process. */
  readonly idleTimeout: Duration.Input;
  /** Arguments placed before the profile's own, used to run a stand-in script in checks. */
  readonly prefixArgs?: ReadonlyArray<string>;
  readonly profile: AcpProviderProfile;
};

/**
 * The dialect of a provider the generic adapter runs, from its launch profile.
 * The profile's account-folder rule decides where its state lives; the protocol departures its definition names ride along as data.
 */
const dialectOf = (profile: AcpProviderProfile): AcpDialect => ({
  fileEdits: "acp",
  label: profile.label,
  launchOf: Effect.fnUntraced(function* (request: TurnRequest) {
    const stateHomeEnv = profile.stateHomeEnv;
    // A provider whose home must be configured runs only against its account folder: without one it would
    // fall back to the user's own provider directory (unrepaired, or worse, holding the owner's sign-in),
    // so the turn fails instead of starting.
    if (stateHomeEnv !== undefined && profile.needsConfiguredStateHome === true && request.configDirectory === null)
      return yield* new HarnessFailure({
        reason: `${profile.label} runs against the account folder, and this thread has none to be its ${stateHomeEnv} state home.`,
      });
    return {
      args: profile.args,
      // The account's own folder becomes the provider's state home, so its sign-in, sessions, config, and MCP
      // inheritance stay with the account (provider-accounts); without one, the provider uses its own default.
      env: reducedEnvironmentOf({
        ...profile.env,
        ...(stateHomeEnv === undefined || request.configDirectory === null
          ? {}
          : { [stateHomeEnv]: request.configDirectory }),
      }),
    };
  }),
  questionIdPrefix: profile.protocol?.questionIdPrefix ?? null,
  resumesSessions: profile.protocol?.resumesSessions === true,
  ...(profile.protocol?.systemPromptNamespace === undefined
    ? {}
    : { systemPromptNamespace: profile.protocol.systemPromptNamespace }),
  ...(profile.protocol?.steersWithPromptFrom === undefined
    ? {}
    : { steersWithPromptFrom: profile.protocol.steersWithPromptFrom }),
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
    dialect: dialectOf(options.profile),
    idleTimeout: options.idleTimeout,
    ...(options.prefixArgs === undefined ? {} : { prefixArgs: options.prefixArgs }),
  });
