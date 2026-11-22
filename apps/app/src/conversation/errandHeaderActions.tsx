import type { MissionDetail, ThreadId, ThreadState } from "@outlore/contracts";
import type { ServiceClient } from "../foundation/client";
import { ArchiveButton } from "../ui/archiveButton";
import { DoneButton } from "../ui/questHeaderButtons";

/** Whether the errand shows its archive and completion controls: not on a quest's own thread, nor once archived. */
export function hasErrandActions(detail: MissionDetail): boolean {
  const { thread } = detail;
  return (
    thread.parentId !== null && detail.threads.find((candidate) => candidate.id === thread.id)?.isArchived !== true
  );
}

/** Shows the active errand's own archive and completion controls using the quest header icons. */
export function ErrandHeaderActions({
  act,
  client,
  detail,
}: {
  act: (request: Promise<unknown>) => Promise<void>;
  client: ServiceClient;
  detail: MissionDetail;
}) {
  if (!hasErrandActions(detail)) return null;
  const { thread } = detail;
  return (
    <ErrandEndingButtons act={(work) => void act(work())} client={client} state={thread.state} threadId={thread.id} />
  );
}

export function ErrandEndingButtons({
  act,
  client,
  isDisabled = false,
  state,
  threadId,
  title,
}: {
  act: (work: () => Promise<unknown>) => void;
  client: ServiceClient;
  isDisabled?: boolean;
  state: ThreadState;
  threadId: ThreadId;
  title?: string;
}) {
  const isDone = state === "Fulfilled";
  const doneLabel = isDone ? "Mark as not done" : "Mark as done";
  return (
    <>
      <ArchiveButton
        isDisabled={isDisabled}
        label={title === undefined ? "Archive errand" : `Archive errand: ${title}`}
        onPress={() => act(() => client.request({ _tag: "ArchiveThread", threadId }))}
      />
      <DoneButton
        isDisabled={isDisabled}
        isDone={isDone}
        label={title === undefined ? doneLabel : `${doneLabel}: ${title}`}
        onPress={() => act(() => client.request({ _tag: isDone ? "ReopenThread" : "MarkThreadDone", threadId }))}
      />
    </>
  );
}
