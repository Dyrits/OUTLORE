import { Schema } from "effect";
import { MissionId, ThreadId, WorkspaceId } from "./ids.ts";

export const ChronicleItem = Schema.Struct({
  at: Schema.Number,
  id: Schema.String,
  kind: Schema.Literals(["RealmOpened", "QuestOpened", "Finished", "Archived", "Waiting", "Failed"]),
  missionId: Schema.NullOr(MissionId),
  realmId: Schema.NullOr(WorkspaceId),
  threadId: Schema.NullOr(ThreadId),
  title: Schema.String,
});
export type ChronicleItem = typeof ChronicleItem.Type;
