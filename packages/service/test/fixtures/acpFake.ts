import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";

// The one configurable ACP stand-in (acpFake.mjs) and what a check reads of it: its knobs, the environment that starts it, and its log.

/** The knobs of the stand-in; each is optional and the script's own defaults say what an absent one means. */
export type AcpFakeConfig = {
  /** The version `initialize` reports as `agentInfo.version`; absent, no `agentInfo`. */
  readonly agentVersion?: string;
  readonly cachedWriteTokens?: number;
  readonly contextSize?: number | null;
  readonly contextUsed?: number | null;
  readonly diff?: boolean;
  readonly form?: "config" | "models";
  readonly images?: boolean;
  readonly interaction?: boolean;
  readonly logEnv?: ReadonlyArray<string>;
  readonly mcpHttp?: boolean;
  readonly missingSession?: string;
  readonly mode?: "probe" | "turn";
  readonly models?: ReadonlyArray<readonly [string, string]>;
  readonly modes?: ReadonlyArray<string>;
  readonly noise?: boolean;
  readonly options?: ReadonlyArray<string>;
  readonly permissionOptions?: ReadonlyArray<{
    readonly kind: string;
    readonly name: string;
    readonly optionId: string;
  }>;
  readonly planUsedUp?: boolean;
  readonly probeSessionId?: string;
  readonly resume?: boolean;
  readonly resumeFails?: boolean;
  readonly sessionId?: string;
  readonly signedOut?: { readonly code: number; readonly message: string };
  /** `true`: every prompt runs until a cancel ends it; `"first"`: only the process's first prompt does. */
  readonly slow?: boolean | "first";
  /** A prompt that arrives while another runs steers it: the running one is answered `end_turn` (Antigravity 1.5). */
  readonly steerable?: boolean;
  readonly strict?: boolean;
  readonly systemPromptAppend?: boolean;
  readonly tool?: {
    readonly answerPrefix?: string;
    readonly id?: string;
    readonly kind?: string;
    readonly rawInput?: unknown;
    readonly title?: string;
  };
  readonly usage?: "context" | "none" | "response" | "update";
  /** What the one-shot `--print "/usage"` command prints (Antigravity); absent, it fails with exit code 1. */
  readonly usageReport?: string;
};

/** The stand-in script, run by Node in the provider executable's place. */
export const acpFakeScript = join(import.meta.dirname, "acpFake.mjs");

/** The environment that starts the stand-in with these knobs, logging to `log`. */
export const acpFakeEnv = (log: string, config: AcpFakeConfig = {}): Record<string, string> => ({
  ACP_FAKE: JSON.stringify(config),
  ACP_FAKE_LOG: log,
});

/** One line of the stand-in's log. */
export type AcpFakeEntry = {
  readonly exit?: boolean;
  readonly launch?: { readonly argv: ReadonlyArray<string>; readonly env: Record<string, string | null> };
  readonly method?: string;
  readonly params?: Record<string, unknown>;
  readonly strictAnswer?: string;
};

/** What the stand-in logged, in order; empty when it never started. */
export const readAcpFakeLog = (log: string): Array<AcpFakeEntry> =>
  existsSync(log)
    ? readFileSync(log, "utf8")
        .trim()
        .split("\n")
        .filter((line) => line !== "")
        .map((line) => JSON.parse(line) as AcpFakeEntry)
    : [];

/** The first request of one method the stand-in logged, or a failure naming the absent method. */
export const acpFakeRequest = (log: string, method: string) => {
  const entry = readAcpFakeLog(log).find((parsed) => parsed.method === method);
  if (entry === undefined) throw new Error(`the stand-in logged no ${method}`);
  return entry;
};

/** Every request of one method the stand-in logged. */
export const acpFakeRequests = (log: string, method: string) =>
  readAcpFakeLog(log).filter((entry) => entry.method === method);

/** Waits until the stand-in has logged an entry the check cares about. */
export const untilAcpFakeLogged = (log: string, predicate: (entry: AcpFakeEntry) => boolean) =>
  Effect.promise(async () => {
    for (let attempt = 0; attempt < 250; attempt += 1) {
      if (readAcpFakeLog(log).some(predicate)) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  });

/** The `[configId, value]` pairs the client set on the session, in order. */
export const configSetsLogged = (log: string) =>
  acpFakeRequests(log, "session/set_config_option").map((entry) => [entry.params?.configId, entry.params?.value]);
