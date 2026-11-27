import { type HarnessName, harnessDescriptors, harnessLabels, harnessNames } from "@outlore/contracts";
import { Record } from "effect";
import { isComputerOnly, isolationEnvOf } from "./accountIsolation.ts";
import { keyEnvironmentOf } from "./accountKeys.ts";
import { acpHarnessServiceFacts } from "./acpHarnessFacts.ts";
import { type AcpSignInCommand, acpSignInOf, type VersionGate } from "./acpProviderDefinition.ts";
import { acpProviders } from "./acpProviderRoster.ts";
import {
  claudeCheapestModel,
  claudeModels,
  type HarnessServiceFacts,
  nativeHarnessServiceFacts,
  type SandboxAdvice,
} from "./nativeHarnessFacts.ts";

export { claudeCheapestModel, claudeModels, harnessLabels, harnessNames, type SandboxAdvice };

// What Outlore knows of each harness without running it (provider-accounts).
// The registry (harnesses.ts) adds how each one runs; these facts stay apart so the modules a harness's adapter needs can read them.

/** A harness's own sign-in command: its arguments and the environment it runs with. */
export type SignInCommand = AcpSignInCommand;

/** What Outlore knows of one harness without running it. */
export type HarnessFacts = Omit<
  HarnessServiceFacts,
  "legacyExecutable" | "sandboxAdvice" | "signInArgs" | "signInEnv"
> & {
  /** The usual model company when the model's own identifier names none, derived from `harnessDescriptors`. */
  readonly company: string;
  /** The harness's name as the owner reads it, derived from `harnessDescriptors`. */
  readonly label: string;
  /** An older executable name preferred when already installed on `PATH`, or null when none exists. */
  readonly legacyExecutable: string | null;
  /** How to leave this harness's sandbox, or null when no native sandbox escalation applies. */
  readonly sandboxAdvice: SandboxAdvice | null;
  /** The harness's own sign-in command for one account's folder with its environment, or null when none is verified. */
  readonly signIn: (configDirectory: string | null) => SignInCommand | null;
  /** The generation the executable must report to run, or null when no gate is verified; `inspect` refuses a version it rejects. */
  readonly versionGate: VersionGate | null;
};

const harnessServiceFacts = {
  ...acpHarnessServiceFacts,
  ...nativeHarnessServiceFacts,
} as const satisfies Record<HarnessName, HarnessServiceFacts>;

/** Each harness's facts, by name, with its shared label and company derived from `@outlore/contracts`. */
export const harnessFacts: Record<HarnessName, HarnessFacts> = Record.map(
  harnessServiceFacts,
  (facts: HarnessServiceFacts, name): HarnessFacts => ({
    ...facts,
    company: harnessDescriptors[name].company,
    label: harnessDescriptors[name].label,
    legacyExecutable: facts.legacyExecutable ?? null,
    sandboxAdvice: facts.sandboxAdvice ?? null,
    signIn: (configDirectory) => {
      const provider = acpProviders[name];
      if (provider !== undefined) return acpSignInOf(provider, { configDirectory });
      if (facts.signInArgs == null) return null;
      return {
        args: facts.signInArgs,
        env: { ...accountEnvironmentOf(name, configDirectory), ...facts.signInEnv },
        shouldKeepPath: false,
      };
    },
    versionGate: acpProviders[name]?.version ?? null,
  }),
);

/** The environment variable that overrides a harness's executable path. */
export const commandEnvVarOf = (harness: HarnessName): string => `OUTLORE_${harness.toUpperCase()}_PATH`;

/** The default executable for a harness, preferring its legacy binary when one is installed. */
export const defaultCommandOf = (harness: HarnessName, hasExecutable: (executable: string) => boolean): string => {
  const facts = harnessFacts[harness];
  return facts.legacyExecutable !== null && hasExecutable(facts.legacyExecutable)
    ? facts.legacyExecutable
    : facts.defaultExecutable;
};

/** Whether a harness refuses the accounts the owner adds beside the computer's own sign-in: its isolation is `computerOnly`. */
export const refusesAddedAccounts = (harness: HarnessName): boolean => isComputerOnly(harnessFacts[harness].isolation);

/** The environment that points a harness at an account's folder; empty for the computer's own sign-in. */
export const accountEnvironmentOf = (harness: HarnessName, configDirectory: string | null): Record<string, string> => ({
  ...isolationEnvOf(harnessFacts[harness].isolation, configDirectory),
  // An API key account's key and endpoint, read from the Vault by the service (accountKeys.ts).
  ...keyEnvironmentOf(configDirectory),
});
