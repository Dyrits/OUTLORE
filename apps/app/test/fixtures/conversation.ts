import { type MissionDetail, MissionId, type ThreadSummary } from "@outlore/contracts";

/** Builds the conversation fields the feed exercises. */
export const detailOf = (
  threads: ReadonlyArray<ThreadSummary>,
  selectedId: string,
  handovers: ReadonlyArray<{ at: number; id: string; text: string }> = [],
) =>
  ({
    activities: [],
    budgetEvents: [],
    handovers,
    loreChanges: [],
    messages: [
      { id: "first", sender: "user", sentAt: 10, text: "first" },
      { id: "second", sender: "user", sentAt: 30, text: "second" },
    ],
    mission: { id: MissionId.make("mission") },
    questions: [],
    suggestions: [],
    thread: { id: selectedId },
    threads,
  }) as unknown as MissionDetail;
