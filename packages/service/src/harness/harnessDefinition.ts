import type { EffortChoice, ModelOption } from "@outlore/contracts";
import type { Duration, Effect, Scope } from "effect";
import type { HarnessAdapter, ServiceFailure } from "../core/index.ts";
import type { HarnessFacts } from "./harnessCatalog.ts";
import type { SignInStatus } from "./harnessTools.ts";
import type { OpenCodeSandbox } from "./openCodeSandbox.ts";

// Shared types and helpers for harness definitions in the registry (provider-accounts).

/**
 * What a check replaces about how a harness starts, so a stand-in runs through the registry's own registration glue (Muse's update flag, Hermes's account home, Antigravity's pinned home, the tool-server wiring) and only the executable differs.
 * Each field is one a stand-in needs; the app never sets any of them.
 */
export type LaunchOverride = {
  /**
   * Environment added to the process's own, such as a stand-in's knobs; it wins over the registration's.
   * Only the adapters that give their process an environment of its own take it: Muse, Pi and the ACP providers.
   * The rest start with the service's environment, which a check sets directly.
   */
  readonly env?: Record<string, string>;
  /** Where each OpenCode thread's starting context is written; the service's data folder by default. */
  readonly instructionsFolder?: string;
  /** The sandbox OpenCode runs in instead of the one detected for this host, or null to run it unwrapped. */
  readonly openCodeSandbox?: OpenCodeSandbox | null;
  /** Arguments placed before the harness's own, to run a stand-in script in the executable's place. */
  readonly prefixArgs?: ReadonlyArray<string>;
  /** The Claude Code settings file read for the owner's rules, in place of the computer's own. */
  readonly userSettingsPath?: string;
};

/** What every harness's turn adapter is started with in the app. */
export type AdapterOptions = {
  /** The executable. */
  readonly command: string;
  /** The service's own folder, where a wrapped OpenCode keeps its state; the system's temporary folder when left out. */
  readonly dataDirectory?: string;
  /** How long an idle thread keeps its process. */
  readonly idleTimeout: Duration.Input;
  /** What a check replaces about how the harness starts; absent in the app. */
  readonly launch?: LaunchOverride;
  /** Why the sandbox cannot run here, or null (CHG-0031). */
  readonly sandboxProblem: string | null;
  /** The Vault's folder, hidden from every sandbox (ADR 0022); none when left out, in checks. */
  readonly vaultFolder?: string;
};

/** One harness: its facts, its turn adapter, and its tool's answers about sign-in and models. */
export interface HarnessDefinition extends HarnessFacts {
  /** The adapter running the harness's turns, whose processes close with the scope that made it. */
  readonly makeAdapter: (options: AdapterOptions) => Effect.Effect<HarnessAdapter, never, Scope.Scope>;
  /**
   * The effort levels the harness offers for one model, for a harness whose model list does not hold them; the others give them with each model (`ModelOption.efforts`).
   * Fails when the harness could not be asked, which is not the same as a model that has none (empty).
   */
  readonly readEfforts?: (
    command: string,
    configDirectory: string | null,
    model: string,
  ) => Effect.Effect<ReadonlyArray<EffortChoice>, ServiceFailure>;
  /** The models the harness offers with an account's sign-in, its default first. */
  readonly readModels: (command: string, configDirectory: string | null) => Effect.Effect<ReadonlyArray<ModelOption>>;
  /** Who the harness's tool says is signed in for an account (null for the computer's own), on the isolation its launch uses; never a credential. */
  readonly readSignIn: (command: string, configDirectory: string | null) => Effect.Effect<SignInStatus>;
}

/** The prefix arguments of an override, as the adapters' options take them. */
export const prefixOf = (launch: LaunchOverride | undefined) =>
  launch?.prefixArgs === undefined ? {} : { prefixArgs: launch.prefixArgs };

/** The unknown sign-in status returned when a harness offers no read-only sign-in probe. */
export const unknownSignIn: SignInStatus = { detail: null, signIn: "Unknown" };

/** The signed-out status returned when a harness reports no active sign-in. */
export const signedOut: SignInStatus = { detail: null, signIn: "SignedOut" };
