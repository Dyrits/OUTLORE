import type {
  ApprovalLevel,
  AttachmentMediaType,
  BillingKind,
  Choice,
  ChoiceAnswers,
  EffortChoice,
  HarnessName,
  ModelChoice,
  TokenUsage,
} from "@outlore/contracts";
import { type Effect, Schema } from "effect";
import type { FileChange } from "./fileChanges.ts";

/** The patch, text or captured change a harness reports for a file edit. */
export type ReportedFileEdit =
  | { readonly patch: string; readonly movedTo: string | null }
  | { readonly pairs: ReadonlyArray<{ readonly previous: string; readonly next: string }> | null }
  | { readonly change: FileChange };

/** What a harness reports while a turn runs. */
export type HarnessEvent =
  /** A complete assistant message, to be saved. */
  | {
      readonly _tag: "Reply";
      /** The model that wrote it as the harness names it (such as `claude-sonnet-5-5`), when it reports one. */
      readonly model?: string | null;
      readonly text: string;
      /** What the model call behind this reply used, when the harness reports usage per call; null otherwise. */
      readonly usage?: TokenUsage | null;
    }
  /** The assistant message written so far, never saved. */
  | { readonly _tag: "Draft"; readonly text: string }
  /** A reported tool call, with the file edit when the harness reports it, to be saved as a step of the turn. */
  | {
      readonly _tag: "ToolCall";
      readonly id: string;
      readonly input: unknown;
      readonly toolName: string;
      readonly fileEdit?: ReportedFileEdit;
    }
  /** A message steered into the running turn was taken in by it (CHG-0039). */
  | { readonly _tag: "Delivered"; readonly messageId: string }
  /** A line for the thread's conversation from the adapter, not the model, saved and shown as handover lines are: such as a harness session that could not be continued (CHG-0208). */
  | { readonly _tag: "Notice"; readonly text: string };

/** An image attached to a message, as a harness takes it: the file where the service keeps it. */
export type ImageAttachment = {
  readonly mediaType: AttachmentMediaType;
  readonly name: string;
  readonly path: string;
};

/** A message to steer into a thread's running turn, by its identifier. */
export type SteeredMessage = {
  readonly id: string;
  readonly images: ReadonlyArray<ImageAttachment>;
  readonly text: string;
};

/** What a permission mode means (CHG-0617, CHG-0621), stated once by the table in work/threadPermissionMode.ts: every reader judges from these terms and never from the mode's name, so a new mode is one more row. */
export type ModeTerms = {
  readonly approvalLevel: ApprovalLevel;
  /** Whether a change of a file inside the thread's folder runs without a question although commands ask. */
  readonly areEditsUnasked: boolean;
  /** Whether the owner allowed commands to leave the sandbox without a question (CHG-0295). */
  readonly canWorkOutsideSandbox: boolean;
  /** Whether every tool call runs without a question, but a grant that widens the sandbox for the turn. */
  readonly isEverythingUnasked: boolean;
};

/** How a thread's actions are approved on its harness, as its turn runs and as the preview counts it (CHG-0301): built once by work/approvalTerms.ts and rendered for the thread by harness/instructions.ts. */
export type ApprovalTerms = ModeTerms & {
  /** Whether the thread's harness runs it inside a sandbox it enforces here, as its adapter reports (`containmentOf`). */
  readonly containment: Containment;
  /** Each kind of standing permission that applies to the thread, once and sorted, such as "Run outside the sandbox": never their targets, so a grant changes what the thread is told only when its kind is new. */
  readonly permissionKinds: ReadonlyArray<string>;
};

/** What a thread may use in a turn, and how its actions are approved (CHG-0031). */
export type ThreadAccess = ApprovalTerms & {
  /** The connector tools the thread's harness lists this turn, by the name it lists them under (`<connector>__<tool>`); none under Code Mode. */
  readonly connectorTools: ReadonlyArray<string>;
  /** Whether the thread works in a workspace, whose sandbox may fetch dependencies (CHG-0034). */
  readonly isInWorkspace: boolean;
  /** The thread's own MCP endpoint serving the thread tools, and Claude Code's permission prompt tool (ADR 0005). */
  readonly mcpUrl: string;
  /** The thread tools the thread uses without asking, named as Claude Code lists them (`mcp__outlore__…`). */
  readonly unaskedTools: ReadonlyArray<string>;
  /** Whether the thread's tools are listed under Code Mode this turn (connectors specification, Code Mode). */
  readonly isUsingCodeMode: boolean;
};

/** One action a harness asks permission for, named as Claude Code names its tools (`Bash`, `Edit`, …). */
export type HarnessPrompt = {
  /** Choices decoded by the adapter; never passed through action-approval policy. */
  readonly choices?: ReadonlyArray<Choice>;
  /** Set on the question a harness asks before starting in a thread folder that is a link or resolves outside its root (harness/threadFolder.ts). */
  readonly folderCheck?: { readonly pointsTo: string; readonly startsIn: string | null };
  readonly input: unknown;
  /** Set by an adapter whose harness asks only to go beyond its active sandbox (Codex's escalations): the action would run outside it. */
  readonly isOutsideSandbox?: boolean;
  /** Set by an adapter running this thread without the sandbox it otherwise runs in, as the owner allowed (OpenCode on a folder that points outside its workspace): the action asks as for a harness no sandbox protects. */
  readonly isUnsandboxed?: boolean;
  readonly toolName: string;
};

/** Whether a harness's tool execution runs inside a sandbox it enforces on this computer at an approval level (sandbox-first autonomy). */
export type Containment = "Sandboxed" | "Unprotected";

/** The owner's answer to a harness prompt: whether the action may run, and what to tell the harness otherwise. */
export type PromptAnswer = {
  /** What the owner chose for a prompt that asked them to choose, one list per question (CHG-0299). */
  readonly answers?: ChoiceAnswers;
  readonly isAllowed: boolean;
  readonly text: string;
};

/** Everything one turn of a thread needs from Outlore. */
export type TurnRequest = {
  readonly access: ThreadAccess;
  /** Asks the owner, through Approvals, about one action the harness wants to run, waiting with no time limit (action-approval). */
  readonly askOwner: (prompt: HarnessPrompt) => Effect.Effect<PromptAnswer, HarnessFailure>;
  /** Waits until the caller has finished recording this turn so a background wake can be admitted. */
  readonly awaitSettlement?: Effect.Effect<void>;
  /** The provider account's own folder, where the harness keeps its sign-in and sessions, or null for the harness's own sign-in on this computer (provider-accounts). */
  readonly configDirectory: string | null;
  /** The starting context: the thread's workspace, or its scratch folder, with the folder's own instructions. */
  readonly context: string;
  /** Reads the thread's conversation before this turn, as a handover gives it to a session that starts with none (work/handover.ts readConversationSoFar); null when there is none. */
  readonly conversationSoFar: Effect.Effect<string | null>;
  readonly cwd: string;
  readonly effort: EffortChoice;
  /** The folder `cwd` must lie in: the workspace's own folder for a thread in a workspace (then `cwd` itself, stored by its real path), or the scratch root for a thread in its mission's scratch folder. */
  readonly folderRoot: string;
  readonly harness: HarnessName;
  /** The images attached to the turn's messages, in order (message-attachments). */
  readonly images: ReadonlyArray<ImageAttachment>;
  /** Set for a turn that has no message of its own: the harness woke itself, such as Claude Code when a background command ended, and Outlore runs what it then does as a turn. */
  readonly isBackgroundWake?: boolean;
  readonly model: ModelChoice;
  /** What changes from turn to turn, such as the budget line, given with the turn's message rather than in the starting context, so a change does not restart the harness; null when there is none. */
  readonly note: string | null;
  readonly onEvent: (event: HarnessEvent) => Effect.Effect<void>;
  /** The harness session to continue, or null for the thread's first turn. */
  readonly sessionId: string | null;
  readonly text: string;
  readonly threadId: string;
};

/** How a turn ended, with what it cost. */
export type TurnOutcome = {
  /** How the turn was billed; `Unknown` when the harness cannot tell (budget-control, Billing kind). */
  readonly billing: BillingKind;
  /** What the thread's context held after the turn's latest model call (input, cached input, and output tokens), for the context gauge (thread-panel); absent or null when the harness did not report it. */
  readonly context?: number | null;
  /** The context window, in tokens, the harness reported for the model that ran the turn (Claude Code's `modelUsage[model].contextWindow`, Codex's `modelContextWindow`); absent or null when it reported none, as OpenCode does, which keeps the fallback (thread-panel, The context gauge). */
  readonly contextWindow?: number | null;
  /** The turn's API-key cost when the harness reports one; null counts the turn's tokens as subscription spending (budget-control, Budgets; provisional, work-in-progress Batch 11). */
  readonly cost: number | null;
  /** Whether the turn ended because it was interrupted (thread-messaging, Interruptions). */
  readonly isInterrupted: boolean;
  readonly sessionId: string;
  /** Null when the harness reported no usage; shown as unknown, never guessed. */
  readonly usage: TokenUsage | null;
};

/** A child process or harness could not do what was asked of it, with the reason the owner reads. */
export class HarnessFailure extends Schema.TaggedError<HarnessFailure>()("HarnessFailure", {
  code: Schema.optional(Schema.Number),
  reason: Schema.String,
}) {}

/** One plan limit as a harness reports it: a window of so many minutes, how much is used, and when it resets (seconds). */
export type PlanLimitReport = {
  readonly label?: string;
  readonly resetsAtSeconds: number;
  readonly usedPercent: number;
  readonly windowMinutes: number;
};

/** What a harness reports of the plan behind an account: how it is billed, and the limits of a subscription (none for an API key). */
export type PlanLimitsReport = {
  readonly billing: BillingKind;
  readonly windows: ReadonlyArray<PlanLimitReport>;
};

/** Takes the work a harness process began on its own; false when the thread may not work now. */
export type BackgroundWakeListener = (threadId: string) => Effect.Effect<boolean>;
