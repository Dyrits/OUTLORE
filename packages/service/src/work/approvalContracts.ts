import type { Answer, Choice, Question } from "@outlore/contracts";
import { Context, type Effect } from "effect";
import type { SqlError } from "effect/sql";
import type { ToolUse } from "../connectors/index.ts";
import type { HarnessPrompt, ServiceFailure } from "../core/index.ts";

/** What a thread passes to `request_approval`: one action, said in plain language, with its exact target. */
export type ApprovalRequest = {
  /** One sentence: what the thread wants to do and why. */
  readonly action: string;
  /** The exact command, file, or target. */
  readonly command: string;
  /** Whether the owner is explicitly being asked to run this command without the sandbox. */
  readonly isOutsideSandbox?: boolean;
};

/** The question a harness asks before starting in a thread folder that is a link (harness/threadFolder.ts). */
export type FolderQuestion = {
  /** The folder found to be a link or to resolve outside its root. */
  readonly folder: string;
  readonly pointsTo: string;
  /** The real path the harness starts in when allowed, then counted as the thread's folder; null for none. */
  readonly startsIn: string | null;
  readonly summary: string;
};

/** The answer a thread or the harness receives. */
export type Decision = {
  readonly isAllowed: boolean;
  /** Told to the thread: the refusal, the owner's message, or how to proceed. */
  readonly text: string;
};

/** An owner's choice is an answer, or an explicit absence of an answer, never permission for an action. */
export type ChoiceDecision =
  | { readonly _tag: "Answered"; readonly answers: ReadonlyArray<ReadonlyArray<string>> }
  | { readonly _tag: "Skipped"; readonly text: string };

/** Owns approval questions: asking, the owner's answers, one-time allowances, and withdrawal. */
export class Approvals extends Context.Service<
  Approvals,
  {
    readonly answer: (
      questionId: string,
      answer: Answer,
      message: string | null,
      device: string,
    ) => Effect.Effect<Question, ServiceFailure | SqlError.SqlError>;
    /** Holds the turn for the owner's choices, independently of permission policy. */
    readonly askChoices: (
      threadId: string,
      choices: ReadonlyArray<Choice>,
      toolUseId?: string | null,
    ) => Effect.Effect<ChoiceDecision>;
    /** Answers a choice question, or skips it with null. */
    readonly answerChoices: (
      questionId: string,
      answers: ReadonlyArray<ReadonlyArray<string>> | null,
      device: string,
    ) => Effect.Effect<Question, ServiceFailure | SqlError.SqlError>;
    /**
     * Answers a harness's permission prompt: unasked inside an enforced sandbox, asked when it leaves the sandbox or
     * none protects the harness. `isOutsideSandbox` comes from the adapter, for a harness that asks only to leave it;
     * `isUnsandboxed`, for a thread its adapter runs without the sandbox it otherwise runs in.
     */
    readonly answerPrompt: (
      threadId: string,
      prompt: HarnessPrompt,
      /** The harness's id of the call, when it gives one. */
      toolUseId?: string | null,
      /** The run the prompt comes from, whose one-time allowances it may take; the thread's id, its main run, when left out. */
      runKey?: string,
    ) => Effect.Effect<Decision>;
    /** Asks the owner to allow one exact command once, in the run's turn (the thread's main run when `runKey` is left out). */
    readonly requestApproval: (threadId: string, request: ApprovalRequest, runKey?: string) => Effect.Effect<Decision>;
    /**
     * Asks about one call to a connector's tool that is not read-only, or is not classified: a standing permission of the
     * capability `useConnectorTool` for that tool of that connector answers it, else Allow, Always allow or Deny.
     */
    readonly askToolUse: (threadId: string, use: ToolUse) => Effect.Effect<Decision>;
    /**
     * Asks once, Allow or Deny, before a harness starts in a thread folder that is a link: never saves a standing
     * permission, and none answers it. Allowed with `startsIn`, the edit check counts that real path as the thread's
     * folder while the folder still points there.
     */
    readonly askAboutFolder: (threadId: string, question: FolderQuestion) => Effect.Effect<Decision>;
    /**
     * Asks once, Allow or Deny, about an exact structural action the service derived; never saves a command
     * allowance or standing permission.
     */
    readonly confirmAction: (threadId: string, summary: string, details: string) => Effect.Effect<Decision>;
    /** Records a structural action the service let run unasked, with its evidence, as a line in the thread. */
    readonly recordDecision: (
      threadId: string,
      summary: string,
      details: string,
      outcome: "AllowedByMessage" | "AllowedByPermission",
      evidence: string,
    ) => Effect.Effect<void>;
    /** Forgets the run's one-time allowances, and no other run's: an approval lasts only the turn it was given in. */
    readonly endTurn: (runKey: string) => Effect.Effect<void>;
    readonly withdraw: (threadId: string) => Effect.Effect<void>;
  }
>()("outlore/Approvals") {}
