import { Schema } from "effect";
import { maxDictationBytes } from "./dictation.ts";
import { AttachmentId } from "./ids.ts";

/** Adds a file to the message the owner is writing: it is checked, stored as a draft, and answered as a card. */
export const AddAttachment = Schema.TaggedStruct("AddAttachment", {
  /** The file's bytes, base64. */
  data: Schema.String,
  name: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(255)),
});
/** Removes a draft the owner took out of the message before sending it. */
export const DiscardAttachment = Schema.TaggedStruct("DiscardAttachment", { attachmentId: AttachmentId });
/** Reads an attached file's bytes; they never ride inside a conversation. */
export const ReadAttachment = Schema.TaggedStruct("ReadAttachment", { attachmentId: AttachmentId });

/** Asks whether the host can transcribe a dictation now, before the owner starts speaking. */
export const ReadDictation = Schema.TaggedStruct("ReadDictation", {});
/** Transcribes one dictated recording on the host; the recording is not kept. */
export const TranscribeDictation = Schema.TaggedStruct("TranscribeDictation", {
  /** The recording's bytes, base64: a 16 kHz, mono, 16-bit WAV file. */
  data: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(Math.ceil(maxDictationBytes / 3) * 4)),
});
