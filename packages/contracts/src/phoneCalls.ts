import { Schema } from "effect";

/** What a thread may ask of the owner's phone, as the phone's own settings group it (phone-control). */
export const PhoneGroup = Schema.Literals(["Information", "Location", "Clipboard", "Open", "Notify"]);
export type PhoneGroup = typeof PhoneGroup.Type;

/** The `phone_*` tools of step 1, each belonging to one group. */
export const PhoneToolName = Schema.Literals([
  "phone_info",
  "phone_location",
  "phone_clipboard_read",
  "phone_clipboard_write",
  "phone_open",
  "phone_notify",
]);
export type PhoneToolName = typeof PhoneToolName.Type;

/** The group a tool belongs to, so the phone checks its switch and the host offers the tool only while it is on. */
export const phoneGroupOf = {
  phone_clipboard_read: "Clipboard",
  phone_clipboard_write: "Clipboard",
  phone_info: "Information",
  phone_location: "Location",
  phone_notify: "Notify",
  phone_open: "Open",
} as const satisfies Record<PhoneToolName, PhoneGroup>;

/** How long the host waits for a phone's answer to a call. */
export const phoneCallLimitMillis = 30_000;

/**
 * What the host sends one paired phone: a tool to run. The phone checks the tool's group switch, runs it and answers
 * with `AnswerPhoneCall`. `deviceId` names the phone it is for; a screen that is not that phone ignores the frame.
 */
export const PhoneCall = Schema.TaggedStruct("PhoneCall", {
  args: Schema.Unknown,
  callId: Schema.String,
  deviceId: Schema.String,
  tool: PhoneToolName,
});
export type PhoneCall = typeof PhoneCall.Type;

/** A call's result: the value the tool returns, or one plain sentence saying why the phone did nothing. */
export const PhoneOutcome = Schema.Union([
  Schema.TaggedStruct("Done", { value: Schema.Unknown }),
  Schema.TaggedStruct("Refused", { reason: Schema.String }),
]);
export type PhoneOutcome = typeof PhoneOutcome.Type;

/**
 * A phone tells the host which groups its owner has switched on, on connecting and at each change; the host offers
 * a thread the tools of these groups only. Paired devices only: a host window, a thread or Chronicler cannot send it.
 */
export const SetPhoneTools = Schema.TaggedStruct("SetPhoneTools", { groups: Schema.Array(PhoneGroup) });
/** A phone's answer to a `PhoneCall`; paired devices only. */
export const AnswerPhoneCall = Schema.TaggedStruct("AnswerPhoneCall", {
  callId: Schema.String,
  outcome: PhoneOutcome,
});
