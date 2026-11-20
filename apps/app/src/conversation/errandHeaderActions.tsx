import type { MissionDetail } from "@outlore/contracts";
import type { ServiceClient } from "../foundation/client";
import { ArchiveButton } from "../ui/archiveButton";
import { DoneButton } from "../ui/questHeaderButtons";

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
  const { thread } = detail;
  if (thread.parentId === null || detail.threads.find((candidate) => candidate.id === thread.id)?.isArchived === true) {
    return null;
  }
  const isDone = thread.state === "Done";
  return (
    <>
      <ArchiveButton
        label="Archive errand"
        onPress={() => act(client.request({ _tag: "ArchiveThread", threadId: thread.id }))}
      />
      <DoneButton
        isDisabled={isDone}
        isDone={isDone}
        label={isDone ? "Done" : "Mark as done"}
        onPress={() => act(client.request({ _tag: "MarkThreadDone", threadId: thread.id }))}
      />
    </>
  );
}
