import { tmpdir } from "node:os";
import type { BillingKind, EffortChoice, ModelOption } from "@outlore/contracts";
import { Effect, Result } from "effect";
import {
  fieldOf,
  HarnessFailure,
  type PlanLimitReport,
  type PlanLimitsReport,
  type RpcProcess,
  reducedEnvironmentOf,
  startRpcProcess,
  textFieldOf,
} from "../core/index.ts";
import { acpInitializeParams } from "./acpSession.ts";
import { accountEnvironmentOf } from "./harnessCatalog.ts";

// What Mistral Vibe's `vibe-acp` says about an account (its models, its sign-in, its plan), read in one short
// session and closed again, and the pieces its turn sessions share (provider-accounts, budget-control).

/** The child's environment, signed in with the turn's account (provider-accounts). */
export const childEnvironment = (configDirectory: string | null) =>
  reducedEnvironmentOf(accountEnvironmentOf("vibe", configDirectory));

/** How the account is billed, from the `plan` of its `_account/read` answer; Subscription until it says `api`. */
export const billingOf = (plan: unknown): BillingKind =>
  textFieldOf(plan, "kind") === "api" ? "ApiKey" : "Subscription";

/** The thinking levels a list from Vibe says, as its strings that are not "default"; empty when it says none. */
const thinkingLevelsOf = (levels: unknown): ReadonlyArray<EffortChoice> =>
  Array.isArray(levels)
    ? levels.flatMap(
        (levelOrOption): Array<EffortChoice> =>
          typeof levelOrOption === "string" && levelOrOption !== "default" ? [levelOrOption] : [],
      )
    : [];

/** The thinking levels the session's own `thinking` config option offers: what a build that reports none per model
 * (the 3.1.3 release) offers every model alike, so a model without levels of its own takes them. */
const sessionThinkingLevelsOf = (configOptions: ReadonlyArray<unknown>): ReadonlyArray<EffortChoice> => {
  for (const option of configOptions) {
    if (textFieldOf(option, "id") !== "thinking") continue;
    const options = fieldOf(option, "options");
    return Array.isArray(options)
      ? options.flatMap((candidate): Array<EffortChoice> => {
          const value = textFieldOf(candidate, "value");
          return value !== null && value !== "default" ? [value] : [];
        })
      : [];
  }
  return [];
};

/** One model of Vibe's `model` config option: its alias, its label, and its thinking levels: its own when the model
 * option says them, else the session's. */
const modelOptionOf = (option: unknown, sessionLevels: ReadonlyArray<EffortChoice>): ModelOption | null => {
  const value = textFieldOf(option, "value");
  if (value === null) return null;
  // Newer Vibe carries each model's thinking levels in the option's `_meta` under `mistral.ai/thinking`; a build
  // that says none (the 3.1.3 release) offers them on the session's own `thinking` option, for every model alike.
  const thinking = fieldOf(fieldOf(option, "_meta"), "mistral.ai/thinking");
  const own = thinkingLevelsOf(fieldOf(thinking, "levels"));
  const efforts = own.length > 0 ? own : sessionLevels;
  return {
    ...(efforts.length > 0 ? { efforts } : {}),
    id: value,
    label: textFieldOf(option, "name") ?? value,
  };
};

/** The `model` config option of a session's config options, or no models when the answer holds none; a model that
 * says no thinking levels of its own takes the ones the session's `thinking` option offers. */
const modelOptionListOf = (configOptions: unknown): ReadonlyArray<ModelOption> => {
  if (!Array.isArray(configOptions)) return [];
  const sessionLevels = sessionThinkingLevelsOf(configOptions);
  return configOptions.flatMap((option) => {
    const options = textFieldOf(option, "id") === "model" ? fieldOf(option, "options") : null;
    return Array.isArray(options) ? options.flatMap((candidate) => modelOptionOf(candidate, sessionLevels) ?? []) : [];
  });
};

/** Vibe's budget resets monthly, so its one plan window is a 30-day one. */
const budgetWindowMinutes = 30 * 24 * 60;

/** The plan and budget of a `_account/read` answer (mistral-vibe 3.1.3 `AccountView`): null when it reports none. */
export const vibePlanLimitsOf = (body: unknown): PlanLimitsReport | null => {
  const budget = fieldOf(body, "budget");
  const percent = fieldOf(budget, "usagePercentage");
  const resetAt = textFieldOf(budget, "resetAt");
  if (typeof percent !== "number" || resetAt === null) return null;
  const resetsAtMillis = Date.parse(resetAt);
  if (Number.isNaN(resetsAtMillis)) return null;
  const window: PlanLimitReport = {
    resetsAtSeconds: resetsAtMillis / 1000,
    usedPercent: percent,
    windowMinutes: budgetWindowMinutes,
  };
  return { billing: billingOf(fieldOf(body, "plan")), windows: [window] };
};

/** Who the account is signed in as, from `_identity/read` and `_account/read`; never a credential. */
const signInOf = (identity: unknown, account: unknown): { detail: string | null; signIn: "SignedIn" | "SignedOut" } => {
  const email = textFieldOf(identity, "email");
  const plan = fieldOf(account, "plan");
  const planName = textFieldOf(plan, "title") ?? textFieldOf(plan, "name");
  if (email === null && textFieldOf(account, "status") !== "ready") return { detail: null, signIn: "SignedOut" };
  return { detail: [email, planName].filter((part) => part !== null).join(" · ") || null, signIn: "SignedIn" };
};

/**
 * Runs one short `vibe-acp` process and answers with what its one session says, and what `read` asks of it.
 * The session is opened in the system's temporary folder with no MCP servers and closed again.
 */
const probeVibe = Effect.fnUntraced(function* <Answer>(
  command: string,
  configDirectory: string | null,
  prefixArgs: ReadonlyArray<string>,
  read: (rpc: RpcProcess, sessionId: string) => Effect.Effect<Answer, HarnessFailure>,
) {
  const rpc = yield* startRpcProcess({
    args: [...prefixArgs],
    command,
    cwd: tmpdir(),
    env: childEnvironment(configDirectory),
    isJsonRpc2: true,
    label: "Mistral Vibe",
  });
  return yield* Effect.gen(function* () {
    yield* rpc.request("initialize", acpInitializeParams);
    const created = yield* rpc
      .request("session/new", { cwd: tmpdir(), mcpServers: [] })
      .pipe(Effect.timeout("20 seconds"));
    const sessionId = textFieldOf(created, "sessionId");
    if (sessionId === null) return yield* new HarnessFailure({ reason: "Mistral Vibe started no session." });
    return { answer: yield* read(rpc, sessionId), session: created };
  }).pipe(Effect.ensuring(Effect.sync(() => rpc.close())));
});

/** Vibe's models for an account, from the `model` config option of one short session's answer. */
export const listVibeModels = Effect.fnUntraced(
  function* (command: string, configDirectory: string | null, prefixArgs: ReadonlyArray<string> = []) {
    const probed = yield* probeVibe(command, configDirectory, prefixArgs, () => Effect.void);
    return modelOptionListOf(fieldOf(probed.session, "configOptions"));
  },
  // A harness that could not be asked lists no models; the harness's own default still runs.
  Effect.catch(() => Effect.succeed<ReadonlyArray<ModelOption>>([])),
);

/** Who Vibe's account is signed in as, read through its own ACP extensions; never a credential. */
export const readVibeSignIn = Effect.fnUntraced(
  function* (command: string, configDirectory: string | null, prefixArgs: ReadonlyArray<string> = []) {
    const { answer } = yield* probeVibe(command, configDirectory, prefixArgs, (rpc, sessionId) =>
      Effect.gen(function* () {
        const identity = yield* rpc.request("_identity/read", { sessionId }).pipe(Effect.result);
        const account = yield* rpc.request("_account/read", { sessionId }).pipe(Effect.result);
        return {
          account: Result.isSuccess(account) ? account.success : null,
          identity: Result.isSuccess(identity) ? identity.success : null,
        };
      }),
    );
    return signInOf(answer.identity, answer.account);
  },
  Effect.catch(() => Effect.succeed({ detail: null, signIn: "Unknown" as const })),
);

/** The limits of the plan behind an account, from one short session's `_account/read`; null when it reports none. */
export const readVibePlanLimits = (
  command: string,
  configDirectory: string | null,
  prefixArgs: ReadonlyArray<string>,
) =>
  probeVibe(command, configDirectory, prefixArgs, (rpc, sessionId) => rpc.request("_account/read", { sessionId })).pipe(
    Effect.map((probed) => vibePlanLimitsOf(probed.answer)),
  );
