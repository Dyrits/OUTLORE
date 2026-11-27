import { type KeyProviderName, keyProviders } from "@outlore/contracts";

// API key accounts (provider-accounts): the environment a key account adds to its harness's process.
// The key itself lives only in the Vault; the service reads it once per start or change and holds the finished
// environment here, in memory, keyed by the account's folder, because every launch, probe and sign-in read already
// asks `accountEnvironmentOf` for an account's folder and cannot wait on the Vault.

const environments = new Map<string, Readonly<Record<string, string>>>();

/** Remembers the environment of the key account whose folder this is. */
export const rememberKeyEnvironment = (
  configDirectory: string,
  environment: Readonly<Record<string, string>>,
): void => {
  environments.set(configDirectory, environment);
};

/** Forgets a key account's environment, as its key was removed or its account was. */
export const forgetKeyEnvironment = (configDirectory: string): void => {
  environments.delete(configDirectory);
};

/** The environment a key account adds to its harness's process; empty for the computer's own sign-in and for a sign-in account. */
export const keyEnvironmentOf = (configDirectory: string | null): Readonly<Record<string, string>> =>
  configDirectory === null ? {} : (environments.get(configDirectory) ?? {});

/** Whether the service holds a key environment for this account folder, so its key was read from the Vault. */
export const hasKeyEnvironment = (configDirectory: string): boolean => environments.has(configDirectory);

/**
 * The environment that points Claude Code at a provider with the account's key.
 * - Anthropic's own API takes the key as `ANTHROPIC_API_KEY`; every other provider takes it as `ANTHROPIC_AUTH_TOKEN` beside its endpoint, with the other credential variable emptied so an inherited key is never sent beside it (as T3 Code and OpenBot do).
 * - Claude Code's own scrub keeps the key out of the commands it runs (`CLAUDE_CODE_SUBPROCESS_ENV_SCRUB`).
 * - A third-party endpoint maps Claude's three model families onto the provider's models, so a background call to the small model never names one the endpoint does not know.
 */
export const claudeKeyEnvironmentOf = (
  provider: KeyProviderName,
  key: string,
  modelIds: ReadonlyArray<string>,
): Readonly<Record<string, string>> => {
  const { baseUrl } = keyProviders[provider];
  const main = modelIds[0];
  const small = modelIds[1] ?? main;
  return {
    ...(baseUrl === null
      ? { ANTHROPIC_API_KEY: key, ANTHROPIC_AUTH_TOKEN: "" }
      : {
          ANTHROPIC_API_KEY: "",
          ANTHROPIC_AUTH_TOKEN: key,
          ANTHROPIC_BASE_URL: baseUrl,
          API_TIMEOUT_MS: "3000000",
          CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
          ...(main === undefined
            ? {}
            : {
                ANTHROPIC_DEFAULT_HAIKU_MODEL: small ?? main,
                ANTHROPIC_DEFAULT_OPUS_MODEL: main,
                ANTHROPIC_DEFAULT_SONNET_MODEL: main,
              }),
        }),
    CLAUDE_CODE_SUBPROCESS_ENV_SCRUB: "1",
  };
};
