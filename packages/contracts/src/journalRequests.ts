import { Schema } from "effect";
import { MissionId } from "./ids.ts";
import { RequestId } from "./records.ts";
import { MessageText } from "./texts.ts";

/** Reads a mission's journal. */
export const ReadJournal = Schema.TaggedStruct("ReadJournal", { missionId: MissionId });
/** The owner rewrites the briefing; refused when another rewrite came after `basedOn` (mission-journal, The user). */
export const RewriteBriefing = Schema.TaggedStruct("RewriteBriefing", {
  basedOn: Schema.Number,
  briefing: Schema.String,
  /** The entry recorded with the rewrite; null records "Rewrote the briefing". */
  entry: Schema.NullOr(Schema.String),
  missionId: MissionId,
  requestId: RequestId,
});
/** The owner adds a change log entry. */
export const AddJournalEntry = Schema.TaggedStruct("AddJournalEntry", {
  missionId: MissionId,
  requestId: RequestId,
  text: MessageText,
});
