import type { Duration } from "effect";
import { type AcpProviderDefinition, acpLaunchOf } from "../../src/harness/acpProviderDefinition.ts";
import { makeAcpProviderHarness, probeAcpProviderModels } from "../../src/harness/acpProviders.ts";

// A provider's real definition started as a stand-in: the process, its prefix arguments and its environment knobs
// are the stand-in's, and everything else (argv, spawn environment, state home) is what production launches.

/** How a stand-in of an ACP provider starts. */
export type StandInOptions = {
  /** The stand-in's executable; Node, when absent. */
  readonly command?: string;
  /** The account folder, or for a pinned home the home itself. */
  readonly configDirectory?: string;
  /** The stand-in's own knobs, added to the definition's spawn environment. */
  readonly env?: Record<string, string>;
  /** Arguments placed before the definition's own, to run a stand-in script. */
  readonly prefixArgs?: ReadonlyArray<string>;
};

const launchOf = (provider: AcpProviderDefinition, options: StandInOptions) =>
  acpLaunchOf(provider, {
    ...(options.configDirectory === undefined ? {} : { configDirectory: options.configDirectory }),
    ...(options.env === undefined ? {} : { env: options.env }),
  });

/** The provider's harness over the stand-in. */
export const standInHarness = (
  provider: AcpProviderDefinition,
  options: StandInOptions & { readonly idleTimeout: Duration.Input },
) =>
  makeAcpProviderHarness({
    command: options.command ?? "node",
    idleTimeout: options.idleTimeout,
    ...(options.prefixArgs === undefined ? {} : { prefixArgs: options.prefixArgs }),
    profile: launchOf(provider, options),
  });

/** The provider's model probe over the stand-in. */
export const standInProbe = (provider: AcpProviderDefinition, options: StandInOptions) =>
  probeAcpProviderModels({
    command: options.command ?? "node",
    ...(options.prefixArgs === undefined ? {} : { prefixArgs: options.prefixArgs }),
    profile: launchOf(provider, options),
  });
