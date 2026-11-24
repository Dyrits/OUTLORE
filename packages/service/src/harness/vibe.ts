import { type Duration, Effect, Result } from "effect";
import { fieldOf, type HarnessAdapter } from "../core/index.ts";
import { type AcpDialect, makeAcpHarness } from "./acpHarness.ts";
import { billingOf, childEnvironment, readVibePlanLimits } from "./vibeAccount.ts";

// Mistral Vibe through `vibe-acp`, its Agent Client Protocol server (`agent-client-protocol` 0.11.0, schema v1.16.0,
// probed in mistral-vibe 3.1.3 and 3.1.4): one process per thread, one ACP session per Outlore thread, one
// `session/prompt` per turn. The protocol itself is acpHarness.ts's; this file is what Vibe does differently.

/** How the Vibe adapter starts its harness. */
export type VibeOptions = {
  /** The ACP server executable; `vibe-acp` on the PATH by default. */
  readonly command: string;
  /** How long an idle thread keeps its process. */
  readonly idleTimeout: Duration.Input;
  /** Arguments placed before the adapter's own, used to run a stand-in script in checks. */
  readonly prefixArgs?: ReadonlyArray<string>;
};

/**
 * Vibe's dialect.
 * It runs against the turn's account folder as `VIBE_HOME` and takes only the HTTP tool server, validating the entry and answering -32602 Invalid params to a stdio one.
 * Its prompt answers sum the whole session, its results carry the edited file's contents, and `_account/read` says how the account is billed (a subscription when it says nothing).
 */
const vibeDialect: AcpDialect = {
  fileEdits: "vibe",
  label: "Mistral Vibe",
  launchOf: (request) => Effect.succeed({ args: [], env: childEnvironment(request.configDirectory) }),
  questionIdPrefix: null,
  readBilling: (rpc, sessionId) =>
    rpc.request("_account/read", { sessionId }).pipe(
      Effect.result,
      Effect.map((account) =>
        Result.isSuccess(account) ? billingOf(fieldOf(account.success, "plan")) : "Subscription",
      ),
    ),
  resumesSessions: false,
  toolServer: "http",
  usage: "cumulative",
};

/**
 * Runs each thread in one long-lived `vibe-acp` process, closed with the scope that made it. Vibe runs without a
 * sandbox Outlore enforces here, so its adapter reports Unprotected: every tool call it asks about asks the owner.
 */
export const makeVibeHarness = (options: VibeOptions) =>
  Effect.map(
    makeAcpHarness({
      command: options.command,
      dialect: vibeDialect,
      idleTimeout: options.idleTimeout,
      ...(options.prefixArgs === undefined ? {} : { prefixArgs: options.prefixArgs }),
    }),
    (adapter) =>
      ({
        ...adapter,
        readPlanLimits: (_harness, configDirectory) =>
          readVibePlanLimits(options.command, configDirectory, options.prefixArgs ?? []).pipe(
            Effect.catch(() => Effect.succeed(null)),
          ),
      }) satisfies HarnessAdapter,
  );
