import type { BillingKind, TokenUsage } from "@outlore/contracts";
import type { Duration, Effect } from "effect";
import type { HarnessFailure, HarnessPrompt, RpcProcess, TurnRequest } from "../core/index.ts";
import type { AcpLaunch } from "./acpLaunch.ts";
import type { AcpPermissionContext } from "./acpPermissions.ts";
import type { AcpPromptFlight } from "./acpPrompt.ts";
import type { HarnessConnection } from "./harnessProcesses.ts";

export type { AcpLaunch } from "./acpLaunch.ts";
export type { AcpPermissionContext } from "./acpPermissions.ts";

// The Agent Client Protocol as Outlore speaks it to a harness that runs one agent process per thread (JSON-RPC 2.0, one
// message per line): one ACP session per thread, one `session/prompt` per turn. This module owns the protocol once:
// opening or reopening the session, falling back from a session the agent lost, the read loop, permissions and the
// owner's questions, the ask mode, usage and context, file edits and the tool server. A harness differs from another only
// by its dialect (below), so a fix to one of these reaches every harness that runs through it.

/**
 * What one harness does differently from the standard protocol, as small data and two hooks.
 * Anything not named here is the same for every ACP harness and lives in this module.
 */
export type AcpDialect = {
  /** Whether each spawned ACP process gets a fresh temporary directory as `TMPDIR`, `TMP`, and `TEMP`, removed when the process ends. */
  readonly hasIsolatedTempDir?: boolean;
  /**
   * A pattern matching a failure line the agent writes into an `agent_message_chunk` instead of returning a JSON-RPC error (such as Antigravity's inline quota warning).
   * When matched, the matched line is stripped from the reply and the prompt fails with `HarnessFailure`.
   */
  readonly inlineFailurePattern?: RegExp;
  /** The harness's name as the owner reads it. */
  readonly label: string;
  /** The process this turn's session runs in, or the reason it cannot run: some providers run only against an account folder. */
  readonly launchOf: (request: TurnRequest) => Effect.Effect<AcpLaunch, HarnessFailure>;
  /** The minimum agent version (`initialize`'s `agentInfo.version`) required before opening a session; an agent reporting an older version fails startup. */
  readonly minimumAgentVersion?: string;
  /**
   * Reads how the account is billed, once the session is open; a failure to read says nothing. Without it a turn's billing is unknown.
   */
  readonly readBilling?: (rpc: RpcProcess, sessionId: string) => Effect.Effect<BillingKind>;
  /** Where the agent's tool calls with this id prefix are questions to choose an answer to, not actions to approve; null when it has none. */
  readonly questionIdPrefix: string | null;
  /**
   * Whether a session the thread knows is reopened with `session/resume` when the agent advertises it:
   * resuming does not replay the session's tool calls to the client, which `session/load` does.
   */
  readonly canResumeSessions: boolean;
  /**
   * How the thread's tool server is given: see `acpToolServersOf`.
   * `launch`: the launch hands over the tool server and the starting context itself, through a configuration and a file the agent reads (OpenCode); the session is given neither.
   */
  readonly toolServer: "http" | "launch" | "negotiated";
  /**
   * How a prompt's usage is reported.
   * - `perPrompt`: each answer is that prompt's own; one that reports none leaves the turn's usage to the token counts of its
   *   `usage_update`s, and a turn with neither is unknown.
   * - `cumulative`: each answer sums the whole session, so the turn's usage is what grew; one that reports none is unknown.
   */
  readonly usage: "cumulative" | "perPrompt";
  /** Where a completed call's edits are read from: the standard `diff` blocks, plus what the harness's own results carry. */
  readonly fileEdits: "acp" | "opencode" | "vibe";
  /**
   * Whether the session's model and thinking level are set on the options it listed (the default), or always, as the options `model` and `effort`:
   * OpenCode lists an effort only for the model once chosen, so the effort is set after the model without being listed first.
   */
  readonly setsOptions?: "always" | "offered";
  /** The line a thread shows when the agent could not pick up the thread's earlier session; a standard line naming the harness when absent. */
  readonly lostSessionNote?: string;
  /** Whether a session the agent could not reopen is replaced by a new one; when this says no, the turn fails with the agent's refusal. Always replaced when absent. */
  readonly mayReplaceLostSession?: (launch: AcpLaunch) => boolean;
  /**
   * The namespace under which the agent takes the starting context as its system prompt (Antigravity: `antigravity`).
   * An agent that advertises `agentCapabilities._meta.<namespace>.systemPrompt.append` is given the context in `_meta.<namespace>.systemPrompt.append` of each `session/new`,
   * so the first prompt carries only the owner's message; an agent that does not advertise it is given the context in the first prompt as every agent is.
   */
  readonly systemPromptNamespace?: string;
  /** The turn's context is the token total of its last prompt's answer, not the agent's `usage_update`. */
  readonly isContextFromUsage?: boolean;
  /** Whether each tool call is a `ToolCall` event in the thread; true when absent. File edits are reported either way. */
  readonly shouldAnnounceToolCalls?: boolean;
  /**
   * The question the owner is asked about one permission request, from the request and the launch;
   * the standard question about the tool call, naming the file outside the folder, when absent.
   */
  readonly promptOf?: (context: AcpPermissionContext) => Effect.Effect<HarnessPrompt>;
  /**
   * The agent cancels its whole prompt when the owner refuses a permission, and ACP carries no message with a refusal:
   * each refusal is kept and told to the agent in a new prompt of the same turn, so the thread carries on without the action.
   * An interrupt ends the turn instead.
   */
  readonly shouldRepromptRefusals?: boolean;
  /**
   * The agent version (`initialize`'s `agentInfo.version`) from which a second `session/prompt` sent while one runs is a message into it:
   * the agent answers the running prompt `end_turn` and carries the turn on under the new one, leaving its running subagents and commands alone (Antigravity 1.5.0).
   * From that version a steered message is sent as that prompt; before it, with no version reported, or when absent, a steered message waits for the next turn.
   * Interrupting never changes: standard ACP's `session/cancel`.
   */
  readonly steersWithPromptFrom?: string;
};

/** How the unified ACP harness starts. */
export type AcpHarnessOptions = {
  /** The agent's executable. */
  readonly command: string;
  readonly dialect: AcpDialect;
  /** How long an idle thread keeps its process. */
  readonly idleTimeout: Duration.Input;
  /** Arguments placed before the dialect's own, used to run a stand-in script in checks. */
  readonly prefixArgs?: ReadonlyArray<string>;
};

/** A thread's running agent process, as the protocol opened it. */
export interface AcpConnection extends HarnessConnection {
  /** How the account is billed, read when the session opened; null when the dialect reads none. */
  readonly billing: BillingKind | null;
  /** Whether this agent takes a steered message as a second prompt: the dialect asks for it and the agent's version is at least the one it names. */
  readonly canSteerWithPrompt: boolean;
  /** Whether the agent advertised that it takes images (ACP `promptCapabilities.image`); false refuses them, null leaves it open. */
  readonly canTakeImages: boolean | null;
  /** The starting context, prepended to the first prompt of a session this process opened; null once given. */
  contextToGive: string | null;
  /** The running stretch of the turn's prompts, which a steered message joins; null between prompts. */
  flight: AcpPromptFlight | null;
  /** The thread's conversation so far, for a session opened in place of one the agent could not load; null once given. */
  handoverNotes: string | null;
  /** A `cumulative` dialect's session totals at the last prompt, so a turn's usage is the delta. */
  lastUsage: TokenUsage;
  /** The launch that started the process, for the dialect's judgement of permissions. */
  readonly launch: AcpLaunch;
  readonly rpc: RpcProcess;
  /** The messages steered into the running flight that the agent has not yet taken in, by their ids. */
  readonly steered: Array<string>;
  /** The tool calls seen so far, by id, so a permission request naming only an id can be judged. */
  readonly toolCalls: Map<string, unknown>;
}
