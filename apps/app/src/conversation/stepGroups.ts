import type { Activity, Message, Question } from "@outlore/contracts";

/** One step of a turn, separate from its chat messages: an action the thread ran or was allowed to run, or a tool call its harness reported. */
export type Step =
  | { _tag: "Action"; at: number; id: string; question: Question }
  | { _tag: "Call"; activity: Activity; at: number; id: string };

/** The outcomes that settle an action with no word from the owner worth a line of its own; a choice question stays in the conversation as agent bubbles with answers attached (CHG-0535). */
const isFoldedAction = (question: Question) =>
  question.choices === null &&
  question.outcome !== null &&
  !["Denied", "Discarded", "Withdrawn"].includes(question.outcome);

/** Settled actions grouped between incoming messages, with elapsed time from the message that began the turn. */
export const stepGroupsOf = (
  messages: ReadonlyArray<Message>,
  questions: ReadonlyArray<Question>,
  activities: ReadonlyArray<Activity>,
  isWorking: boolean,
) => {
  const groups: Array<{ isCurrent: boolean; seconds: number; steps: Array<Step> }> = [];
  const actions = [
    ...questions
      .filter(isFoldedAction)
      .map((question): Step => ({ _tag: "Action", at: question.askedAt, id: question.id, question })),
    ...activities.map((activity): Step => ({ _tag: "Call", activity, at: activity.at, id: `call:${activity.id}` })),
  ].sort((current, next) => current.at - next.at);
  let before: Message | null = null;
  const close = (isTrailing: boolean, until: number) => {
    const from = before?.sentAt ?? Number.NEGATIVE_INFINITY;
    const steps = actions.filter((action) => action.at >= from && action.at < until);
    const first = steps[0];
    const last = steps.at(-1);
    if (first !== undefined && last !== undefined)
      groups.push({
        isCurrent: isWorking && isTrailing,
        seconds: Math.max(0, Math.round((last.at - (before?.sentAt ?? first.at)) / 1000)),
        steps,
      });
  };
  for (const message of [...messages].sort((current, next) => current.sequence - next.sequence)) {
    if (message.sender !== "agent") {
      close(false, message.sentAt);
      before = message;
    }
  }
  close(true, Number.POSITIVE_INFINITY);
  return groups;
};
