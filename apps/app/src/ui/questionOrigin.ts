import type { Question } from "@outlore/contracts";

/** The quest and source thread of a question shown outside its conversation. */
export const questionOriginOf = (question: Pick<Question, "missionTitle" | "threadTitle">): string =>
  `${question.missionTitle} · ${question.threadTitle}`;
