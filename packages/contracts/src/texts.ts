import { Schema } from "effect";

// Names the owner gives or reads, and the text of a message (budget-control, rituals, requests).

/** A name the owner gives or reads — a title, label, or realm name — of one to eighty characters. */
export const NameText = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(80));

/** Required text the owner writes, such as a message or a Ritual's instruction: at most a hundred thousand characters. */
export const MessageText = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(100_000));

/** The text of an owner's message: possibly empty (files attached, or still typing) and at most a hundred thousand characters (message-attachments). */
export const OwnerMessageText = Schema.String.check(Schema.isMaxLength(100_000));
