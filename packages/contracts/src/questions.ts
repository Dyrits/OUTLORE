import { Schema } from "effect";
import { MissionId, PermissionId, QuestionId, ThreadId, WorkspaceId } from "./ids.ts";

// Approval questions and standing permissions (action-approval).

/** How much asks for approval: sensitive actions only, or also commands and edits (action-approval, Approval level; CHG-0035). */
export const ApprovalLevel = Schema.Literals(["RiskyOnly", "CommandsAndEdits"]);
export type ApprovalLevel = typeof ApprovalLevel.Type;

/** Who raised a question: the thread through `request_approval`, or the harness's own permission prompt. */
export const QuestionSource = Schema.Literals(["Thread", "Harness"]);
export type QuestionSource = typeof QuestionSource.Type;

/** How a question ended; null while it is open. */
export const QuestionOutcome = Schema.Literals([
  "Allowed",
  "AlwaysAllowed",
  "Denied",
  "Discarded",
  "Withdrawn",
  "AllowedByMessage",
  "AllowedByPermission",
  /** A harness prompt that is not a sensitive action, run without a question (CHG-0035). */
  "AllowedAutomatically",
  /** A choice question the owner answered (CHG-0299). */
  "Answered",
  /** A choice question the owner chose not to answer (CHG-0299). */
  "Skipped",
]);
export type QuestionOutcome = typeof QuestionOutcome.Type;

/** One option a choice question offers. */
export const ChoiceOption = Schema.Struct({ description: Schema.String, label: Schema.String });
export type ChoiceOption = typeof ChoiceOption.Type;

/**
 * One question a thread asks the owner to answer by choosing (CHG-0299), in the shape Claude Code's AskUserQuestion,
 * Codex's request_user_input and OpenCode's question tool share: a short header, the question, and its options.
 */
export const Choice = Schema.Struct({
  /** Whether the owner may type an answer of their own instead of an option (Claude Code always allows it). */
  allowsOther: Schema.Boolean,
  header: Schema.String,
  /** Whether several options may be chosen. */
  multiple: Schema.Boolean,
  options: Schema.Array(ChoiceOption),
  question: Schema.String,
});
export type Choice = typeof Choice.Type;

/** What the owner answered to each choice, in order: one list per choice, of the options' labels or their own text. */
export const ChoiceAnswers = Schema.Array(Schema.Array(Schema.String));
export type ChoiceAnswers = typeof ChoiceAnswers.Type;

/** One approval question about one action, or one set of choices, open or recorded. */
export const Question = Schema.Struct({
  /** What the owner answered to each choice, in order (the options' labels or typed text); null until answered, and when skipped. */
  answers: Schema.NullOr(ChoiceAnswers),
  askedAt: Schema.Number,
  /** The questions to choose answers to; null for an approval question (Allow, Always allow, Deny). */
  choices: Schema.NullOr(Schema.Array(Choice)),
  /** The exact command, file, or target. */
  details: Schema.String,
  /** Where it was answered, such as "host window" or a paired device's name; null while open or when no person answered. */
  device: Schema.NullOr(Schema.String),
  id: QuestionId,
  /** The owner's message on a denial, if any. */
  message: Schema.NullOr(Schema.String),
  missionId: MissionId,
  missionTitle: Schema.String,
  outcome: Schema.NullOr(QuestionOutcome),
  /** The command pattern Always allow would save, such as `git push *`. */
  pattern: Schema.NullOr(Schema.String),
  /** The short sentence Always allow would save, such as "Push code to GitHub". */
  permission: Schema.NullOr(Schema.String),
  resolvedAt: Schema.NullOr(Schema.Number),
  source: QuestionSource,
  /** One natural-language sentence: what the thread wants to do and why. */
  summary: Schema.String,
  threadId: ThreadId,
});
export type Question = typeof Question.Type;

/** A standing permission the owner granted with Always allow. */
export const StandingPermission = Schema.Struct({
  createdAt: Schema.Number,
  id: PermissionId,
  /** The mission it applies to, for threads with no workspace; null otherwise. */
  missionId: Schema.NullOr(MissionId),
  missionTitle: Schema.NullOr(Schema.String),
  pattern: Schema.String,
  sentence: Schema.String,
  /** The workspace it applies to; null for a mission's permission. Both null: everywhere. */
  workspaceId: Schema.NullOr(WorkspaceId),
  workspaceName: Schema.NullOr(Schema.String),
});
export type StandingPermission = typeof StandingPermission.Type;

/** The standing permissions and the answers history, as the Permissions view shows them. */
export const PermissionsView = Schema.Struct({
  /** Answered, discarded, and withdrawn questions, newest first. */
  history: Schema.Array(Question),
  level: ApprovalLevel,
  permissions: Schema.Array(StandingPermission),
  /** Why the sandbox is unavailable, so the default level asks for every prompt; null when available. */
  sandboxProblem: Schema.NullOr(Schema.String),
});
export type PermissionsView = typeof PermissionsView.Type;
