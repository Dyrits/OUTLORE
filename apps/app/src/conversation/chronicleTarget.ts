import type { ChronicleItem, MessageId, QuestionId, ThreadId } from "@outlore/contracts";
import { createContext } from "react";
import type { Entry } from "./entries";

/** A Chronicle entry to reveal after its conversation opens. */
export type ChronicleTarget = {
  threadId: ThreadId | null;
  messageId: MessageId | null;
  questionId: QuestionId | null;
  waitingAt: number | null;
};

/** Carries a target from the Chronicle to the selected conversation. */
export const ChronicleTargetContext = createContext<ChronicleTarget | null>(null);

/** Points a Chronicle item at its conversation and, when supplied, its exact entry. */
export const targetOf = (
  item: Pick<ChronicleItem, "at" | "kind" | "messageId" | "questionId" | "threadId">,
): ChronicleTarget => ({
  messageId: item.threadId === null ? null : item.messageId,
  questionId: item.threadId === null ? null : (item.questionId ?? null),
  threadId: item.threadId,
  // Older hosts omitted the question ID but sent its timestamp.
  waitingAt: item.threadId !== null && item.kind === "Waiting" && item.questionId === undefined ? item.at : null,
});

/** A quest-level target belongs to its top thread. */
export const matchesThread = (target: ChronicleTarget, threadId: ThreadId, isTopThread: boolean): boolean =>
  target.threadId === null ? isTopThread : target.threadId === threadId;

/** Finds the newest open request or the named message in the inverted conversation list. */
export const targetIndexOf = (entries: ReadonlyArray<Entry>, target: ChronicleTarget): number => {
  const newest = [...entries].reverse();
  const latestMessage = () => newest.findIndex((entry) => entry._tag === "Message");
  const index = newest.findIndex((entry) =>
    target.questionId !== null
      ? entry._tag === "Question" && entry.question.id === target.questionId && entry.question.outcome === null
      : target.messageId !== null &&
        entry._tag === "Message" &&
        // A Companion's answer is drawn in the frame of its message, so its entry is that message's.
        (entry.message.id === target.messageId ||
          (entry.answers ?? []).some((answer) => answer.message.id === target.messageId)),
  );
  if (index >= 0) return index;
  if (target.questionId === null && target.waitingAt !== null) {
    const waiting = newest
      .filter((entry) => entry._tag === "Question" && entry.question.outcome === null && entry.at === target.waitingAt)
      .sort((current, next) => current.key.localeCompare(next.key))[0];
    if (waiting !== undefined) return newest.indexOf(waiting);
  }
  return latestMessage();
};
