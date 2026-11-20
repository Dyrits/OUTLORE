import type { MessageId, QuestionId, ThreadId } from "@outlore/contracts";
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

/** Finds the newest open request or the named message in the inverted conversation list. */
export const targetIndexOf = (entries: ReadonlyArray<Entry>, target: ChronicleTarget): number => {
  const newest = [...entries].reverse();
  const latestMessage = () => newest.findIndex((entry) => entry._tag === "Message");
  const index = newest.findIndex((entry) =>
    target.questionId !== null
      ? entry._tag === "Question" && entry.question.id === target.questionId && entry.question.outcome === null
      : target.messageId !== null && entry._tag === "Message" && entry.message.id === target.messageId,
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
