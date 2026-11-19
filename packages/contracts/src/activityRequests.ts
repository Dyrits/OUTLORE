import { Schema } from "effect";
import { ThreadId } from "./ids.ts";

/**
 * Reads the diff of a call that modified a file, when the owner opens its step (action-approval, A modified file's
 * diff). The diff never rides in the mission detail, so the steps list stays small.
 */
export const ReadFileDiff = Schema.TaggedStruct("ReadFileDiff", {
  /** The harness's own identifier of the call, as the step lists it. */
  activityId: Schema.String.check(Schema.isMinLength(1)),
  threadId: ThreadId,
});
