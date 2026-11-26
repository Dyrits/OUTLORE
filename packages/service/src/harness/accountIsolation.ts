// How an account's own folder isolates a harness's sign-in and sessions (provider-accounts, ADR 0011).
// Each harness declares it once, in its facts or its ACP definition, and every surface derives from that one value:
// the launch, the sign-in command, the sign-in read, the model probe, the plan limits, and whether the Workshop offers "+ Add account".

/**
 * What an account folder can do for one harness.
 * - `computerOnly`: no per-account state home is verified, so only the computer's own sign-in is offered and no folder redirects anything.
 * - `directory`: the account's folder is the harness's state home; `envOf` names every environment variable that points the harness at it, since some need two or more.
 *   `isConfiguredHomeRequired` means an empty folder cannot serve: it must be repaired, signed in and given a default model first.
 */
export type AccountIsolation =
  | { readonly kind: "computerOnly"; readonly reason: string }
  | {
      readonly kind: "directory";
      readonly envOf: (accountDirectory: string) => Readonly<Record<string, string>>;
      readonly isConfiguredHomeRequired?: boolean;
    };

/** A harness that takes the computer's own sign-in only, with the reason no account folder can isolate it. */
export const computerOnlyIsolation = (reason: string): AccountIsolation => ({ kind: "computerOnly", reason });

/** The common isolation: one variable holds the account's folder. */
export const singleVarIsolation = (variable: string, isConfiguredHomeRequired = false): AccountIsolation => ({
  envOf: (accountDirectory) => ({ [variable]: accountDirectory }),
  kind: "directory",
  ...(isConfiguredHomeRequired ? { isConfiguredHomeRequired } : {}),
});

/** Whether the harness refuses accounts the owner adds beside the computer's own sign-in. */
export const isComputerOnly = (isolation: AccountIsolation): boolean => isolation.kind === "computerOnly";

/** Whether an account folder must be configured before the harness serves anything, so a launch or probe without one cannot run. */
export const needsConfiguredHomeOf = (isolation: AccountIsolation): boolean =>
  isolation.kind === "directory" && isolation.isConfiguredHomeRequired === true;

/** The environment that points a harness at an account's folder; empty for the computer's own sign-in and for a harness no folder can isolate. */
export const isolationEnvOf = (
  isolation: AccountIsolation,
  configDirectory: string | null,
): Readonly<Record<string, string>> =>
  configDirectory === null || isolation.kind === "computerOnly" ? {} : isolation.envOf(configDirectory);
