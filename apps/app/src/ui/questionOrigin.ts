import type { Question } from "@outlore/contracts";

/** Separate quest and source-thread lines, so a long quest cannot truncate the thread. */
export const questionOriginOf = (
  question: Pick<Question, "missionTitle" | "threadTitle">,
): ReadonlyArray<{ key: string; title: string }> => [
  { key: "quest", title: question.missionTitle },
  { key: "thread", title: question.threadTitle },
];
