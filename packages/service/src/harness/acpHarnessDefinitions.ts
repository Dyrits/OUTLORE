import type { ModelOption } from "@outlore/contracts";
import { Effect } from "effect";
import type { HarnessAdapter } from "../core/index.ts";
import { isComputerOnly } from "./accountIsolation.ts";
import { type AcpProviderDefinition, acpLaunchOf } from "./acpProviderDefinition.ts";
import { makeAcpProviderHarness, probeAcpProviderModels, readAcpProviderSignIn } from "./acpProviders.ts";
import { readAntigravityPlanLimits } from "./antigravityPlanLimits.ts";
import { antigravity as antigravityProvider } from "./antigravityProvider.ts";
import { cline as clineProvider } from "./clineProvider.ts";
import { copilot as copilotProvider } from "./copilotProvider.ts";
import { cursor as cursorProvider } from "./cursorProvider.ts";
import { devin as devinProvider } from "./devinProvider.ts";
import { harnessFacts } from "./harnessCatalog.ts";
import { type AdapterOptions, type HarnessDefinition, prefixOf, unknownSignIn } from "./harnessDefinition.ts";
import { hermes as hermesProvider } from "./hermesProvider.ts";

// The ACP provider harnesses (CHG-0645, provider-parity wave 5): each runs one long-lived ACP process of the generic adapter, so every sensitive action reaches the owner as a permission request and any other reverse request fails closed.
// All of them but Hermes take the computer's own sign-in only (their added-account surfaces are absent or unproven - their isolation is computerOnly).
// Their launch, model probe, sign-in and version gate all come from one definition each (acpProviderDefinition.ts), so none of them can drift from another.

/** One long-lived ACP process per thread, started from the provider's definition and resolved against each thread's account at its launch. */
const acpAdapterOf =
  (provider: AcpProviderDefinition) =>
  ({ command, idleTimeout, launch }: AdapterOptions) =>
    makeAcpProviderHarness({
      command,
      definition: provider,
      idleTimeout,
      ...(launch?.env === undefined ? {} : { env: launch.env }),
      ...prefixOf(launch),
    });

/** The models of a short-lived session probe on the provider's launch for one account; none when the CLI is absent, not signed in, or the account is not set up yet. */
const probedModelsOf = (provider: AcpProviderDefinition) => (command: string, configDirectory: string | null) =>
  probeAcpProviderModels({ command, configDirectory, definition: provider }).pipe(
    Effect.map((models): ReadonlyArray<ModelOption> => models),
    Effect.catch(() => Effect.succeed<ReadonlyArray<ModelOption>>([])),
  );

/** The Hermes ACP harness definition. */
export const hermesDefinition: HarnessDefinition = {
  ...harnessFacts.hermes,
  // Hermes runs through the generic ACP adapter: every permission request reaches the owner, modes are forced to "ask" where the provider offers them, and the account folder becomes HERMES_HOME (acpProviders.ts).
  makeAdapter: acpAdapterOf(hermesProvider),
  // Models come from the ACP probe against the account's own (prepared) home; its isolation refuses the computer's own Hermes directory, and a home that is not set up yet (no repair, no sign-in, no model) lists none yet.
  readModels: probedModelsOf(hermesProvider),
  // Hermes offers no machine-readable sign-in status a read-only command can answer; an account shows Unknown until its prepared home starts listing models.
  readSignIn: () => Effect.succeed(unknownSignIn),
};

/** The Antigravity ACP harness definition. */
export const antigravityDefinition: HarnessDefinition = {
  ...harnessFacts.antigravity,
  // The plan limits come from the CLI's own `/usage` command, which spends no tokens (antigravityPlanLimits.ts).
  makeAdapter: (options) =>
    acpAdapterOf(antigravityProvider)(options).pipe(
      Effect.map(
        (adapter): HarnessAdapter => ({
          ...adapter,
          // An account no folder can isolate has no limits of its own to read, so only the computer's own sign-in does.
          readPlanLimits: (_harness, configDirectory) =>
            configDirectory !== null && isComputerOnly(antigravityProvider.isolation)
              ? Effect.succeed(null)
              : readAntigravityPlanLimits({
                  command: options.command,
                  env: acpLaunchOf(antigravityProvider, {
                    configDirectory,
                    ...(options.launch?.env === undefined ? {} : { env: options.launch.env }),
                  }).env,
                  ...prefixOf(options.launch),
                }),
        }),
      ),
    ),
  // Models come from a short-lived session probe on the same launch a turn uses; none when the CLI is absent or not signed in.
  readModels: probedModelsOf(antigravityProvider),
  // The same session probe answers the sign-in: models listed means the login works.
  readSignIn: (command, configDirectory) =>
    readAcpProviderSignIn({ command, configDirectory, definition: antigravityProvider }),
};

/** The Cline ACP harness definition. */
export const clineDefinition: HarnessDefinition = {
  ...harnessFacts.cline,
  makeAdapter: acpAdapterOf(clineProvider),
  readModels: probedModelsOf(clineProvider),
  readSignIn: () => Effect.succeed(unknownSignIn),
};

/** The GitHub Copilot ACP harness definition. */
export const copilotDefinition: HarnessDefinition = {
  ...harnessFacts.copilot,
  makeAdapter: acpAdapterOf(copilotProvider),
  // A signed-out Copilot answers with no models rather than failing, so the probe failing at all (the CLI absent) reads as no models yet, exactly as upstream's signed-out shape does.
  readModels: probedModelsOf(copilotProvider),
  readSignIn: () => Effect.succeed(unknownSignIn),
};

/** The Cursor ACP harness definition. */
export const cursorDefinition: HarnessDefinition = {
  ...harnessFacts.cursor,
  makeAdapter: acpAdapterOf(cursorProvider),
  readModels: probedModelsOf(cursorProvider),
  readSignIn: () => Effect.succeed(unknownSignIn),
};

/** The Devin ACP harness definition. */
export const devinDefinition: HarnessDefinition = {
  ...harnessFacts.devin,
  makeAdapter: acpAdapterOf(devinProvider),
  // Devin lists models only when signed in, so both the signed-out probe and any probe failure read as none yet.
  readModels: probedModelsOf(devinProvider),
  readSignIn: () => Effect.succeed(unknownSignIn),
};
