import type { HarnessName } from "@outlore/contracts";
import type { Duration } from "effect";
import type { AcpProviderDefinition } from "../../src/harness/acpProviderDefinition.ts";
import { probeAcpProviderModels } from "../../src/harness/acpProviders.ts";
import { harnesses } from "../../src/harness/harnesses.ts";

// A provider's real registry entry started as a stand-in: the process, its prefix arguments and its environment knobs
// are the stand-in's, and everything else (argv, spawn environment, state home) is what production launches.

/** How a stand-in of an ACP provider starts. */
export type StandInOptions = {
  /** The stand-in's executable; Node, when absent. */
  readonly command?: string;
  /** For a probe: the account folder, or for a pinned home the home itself. A turn takes its home from `GEMINI_HOME`. */
  readonly configDirectory?: string;
  /** The stand-in's own knobs, added to the definition's spawn environment. */
  readonly env?: Record<string, string>;
  /** Arguments placed before the definition's own, to run a stand-in script. */
  readonly prefixArgs?: ReadonlyArray<string>;
};

/** The provider's registry entry's adapter, over the stand-in; the pinned home of Antigravity comes from `GEMINI_HOME`, as in the app. */
export const standInHarness = (name: HarnessName, options: StandInOptions & { readonly idleTimeout: Duration.Input }) =>
  harnesses[name].makeAdapter({
    command: options.command ?? "node",
    idleTimeout: options.idleTimeout,
    launch: {
      ...(options.env === undefined ? {} : { env: options.env }),
      ...(options.prefixArgs === undefined ? {} : { prefixArgs: options.prefixArgs }),
    },
    sandboxProblem: null,
  });

/** The provider's model probe over the stand-in, on the definition's launch. */
export const standInProbe = (provider: AcpProviderDefinition, options: StandInOptions) =>
  probeAcpProviderModels({
    command: options.command ?? "node",
    definition: provider,
    ...(options.configDirectory === undefined ? {} : { configDirectory: options.configDirectory }),
    ...(options.env === undefined ? {} : { env: options.env }),
    ...(options.prefixArgs === undefined ? {} : { prefixArgs: options.prefixArgs }),
  });
