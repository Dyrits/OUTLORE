import { Schema } from "effect";
import { maxAttachmentsPerMessage } from "./attachments.ts";
import { AttachmentId } from "./ids.ts";

/** The files an owner's message carries, added beforehand with `AddAttachment`; absent is none. */
export const AttachmentIds = Schema.optionalKey(
  Schema.Array(AttachmentId).check(Schema.isMaxLength(maxAttachmentsPerMessage)),
);
