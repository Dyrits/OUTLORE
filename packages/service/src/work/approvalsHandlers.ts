import { Effect, type Semaphore } from "effect";
import { listOpenQuestions } from "../policy/index.ts";
import type { Approvals } from "./approvalContracts.ts";
import { resolveChatter } from "./chatter.ts";
import type { HandlerDependencies, OwnerHandlers } from "./requestContext.ts";
import type { Suggestions } from "./suggestions.ts";

/** Requests that answer what an agent asked the owner, from the host's window or a paired device. */
export const approvalsHandlers = (
  { commands }: Pick<HandlerDependencies, "commands">,
  approvals: Approvals["Service"],
  suggestions: Suggestions["Service"],
  chatterDecisions: Semaphore.Semaphore,
  deviceLabel: string,
) =>
  ({
    AnswerChoices: (given) => approvals.answerChoices(given.questionId, given.answers, deviceLabel),
    AnswerQuestion: (given) => approvals.answer(given.questionId, given.answer, given.message, deviceLabel),
    AnswerSuggestion: (given) =>
      suggestions.answer(given.suggestionId, given.answer).pipe(
        Effect.tap(({ followUps }) => commands.apply(followUps)),
        Effect.map(({ value }) => value),
      ),
    ListOpenQuestions: () => listOpenQuestions,
    ResolveChatter: (given) => resolveChatter(given.id, given.choice).pipe(chatterDecisions.withPermit),
  }) satisfies OwnerHandlers<
    "AnswerChoices" | "AnswerQuestion" | "AnswerSuggestion" | "ListOpenQuestions" | "ResolveChatter"
  >;
