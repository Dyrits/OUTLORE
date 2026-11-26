import type { MissionDetail, ThreadId, ThreadState } from "@outlore/contracts";
import type { StyleProp, ViewStyle } from "react-native";
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
  onSelect,
  style,
}: {
  act: (request: Promise<unknown>) => Promise<void>;
  client: ServiceClient;
  detail: MissionDetail;
  onSelect: (threadId: ThreadId) => void;
  /** The look of each button, which a phone's header gives a larger target. */
  style?: StyleProp<ViewStyle>;
}) {
  if (!hasErrandActions(detail)) return null;
  const { thread } = detail;
  const isEmpty = detail.threads.find((candidate) => candidate.id === thread.id)?.isEmpty === true;
  return (
    <ErrandEndingButtons
      act={(work) => void act(work())}
      client={client}
      isEmpty={isEmpty}
      // A deleted errand leaves its pane for the conversation it hung from.
      onDeleted={() => thread.parentId !== null && onSelect(thread.parentId)}
      state={thread.state}
      style={style}
      threadId={thread.id}
    />
  );
}

export function ErrandEndingButtons({
  act,
  client,
  isDisabled = false,
  isEmpty = false,
  onDeleted,
  state,
  style,
  threadId,
  title,
}: {
  act: (work: () => Promise<unknown>) => void;
  client: ServiceClient;
  isDisabled?: boolean;
  /** Whether the errand holds nothing of its own, so archiving it deletes it. */
  isEmpty?: boolean;
  /** Called once an empty errand has been deleted. */
  onDeleted?: () => void;
  state: ThreadState;
  style?: StyleProp<ViewStyle>;
  threadId: ThreadId;
  title?: string;
}) {
  const isDone = state === "Fulfilled";
  const doneLabel = isDone ? "Mark as not done" : "Mark as done";
  return (
    <>
      <DoneButton
        isDisabled={isDisabled}
        isDone={isDone}
        label={title === undefined ? doneLabel : `${doneLabel}: ${title}`}
        onPress={() => act(() => client.request({ _tag: isDone ? "ReopenThread" : "MarkThreadDone", threadId }))}
        style={style}
      />
      <ArchiveButton
        isDelete={isEmpty}
        isDisabled={isDisabled}
        label={`${isEmpty ? "Delete" : "Archive"} errand${title === undefined ? "" : `: ${title}`}`}
        onPress={() =>
          act(() =>
            client.request({ _tag: "ArchiveThread", threadId }).then(() => (isEmpty ? onDeleted?.() : undefined)),
          )
        }
        style={style}
      />
    </>
  );
}
