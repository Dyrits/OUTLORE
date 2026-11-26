import type { PhoneToolName } from "@outlore/contracts";
import { Schema } from "effect";
import { toolRefusal } from "../core/index.ts";
import { definitionOf, optionalText, text } from "./toolDefinition.ts";

// The thread tools that use the owner's paired phone (phone-control, ADR 0028), defined once beside the others
// (threadTools.ts). The paired app on the phone runs each call, and only while the owner has switched that kind of use
// on, on the phone: no call asks for approval here, the switch on the phone is the consent.

/** What every phone tool's description tells the model about where its result goes and who allows the tool. */
const phoneNotice =
  " Runs on the owner's paired phone, only while the owner has switched this kind of phone use on in Outlore on the phone, and only while that phone has Outlore open. The result reaches your model provider like any tool result. When it is off or no phone is connected, the call fails at once with a sentence you can relay to the owner.";

const phone = optionalText(
  "The paired phone to use, by the name the owner gave it in Outlore. Leave out while exactly one phone is connected with this kind of use on; with several connected the call fails naming them.",
);

/** The apps `phone_open` opens by name and the link schemes it opens, as the phone app accepts them. */
const openableApps = [
  "calendar",
  "dialer",
  "email",
  "maps",
  "messages",
  "settings",
  "spotify",
  "telegram",
  "whatsapp",
  "youtube",
];
const openableSchemes = ["http", "https", "mailto", "tel", "sms", "geo"];

/** A phone tool's description with what every one of them tells the model. */
const described = (description: string) => description + phoneNotice;

/** The phone tools, by name. */
export const phoneToolDefinitions = {
  phone_clipboard_read: definitionOf({
    description: described("Read the text on the phone's clipboard."),
    invalid: toolRefusal("Invalid arguments: phone, when given, is the name of a paired phone."),
    isUnasked: true,
    schema: Schema.Struct({ phone }),
  }),
  phone_clipboard_write: definitionOf({
    description: described("Replace the text on the phone's clipboard, so the owner can paste it there."),
    invalid: toolRefusal("Invalid arguments: give text to put on the clipboard."),
    isUnasked: true,
    schema: Schema.Struct({ phone, text: text("The text to put on the clipboard.") }),
  }),
  phone_info: definitionOf({
    description: described(
      "Read the phone's battery level and charging state, network kind, device model and time zone.",
    ),
    invalid: toolRefusal("Invalid arguments: phone, when given, is the name of a paired phone."),
    isUnasked: true,
    schema: Schema.Struct({ phone }),
  }),
  phone_location: definitionOf({
    description: described(
      "Read the phone's current position and its accuracy. Android may ask the owner for the location permission the first time.",
    ),
    invalid: toolRefusal("Invalid arguments: phone, when given, is the name of a paired phone."),
    isUnasked: true,
    schema: Schema.Struct({ phone }),
  }),
  phone_notify: definitionOf({
    description: described(
      "Show a notification on the phone with a text and, optionally, a title, to tell the owner something. Android may ask the owner for the notification permission the first time.",
    ),
    invalid: toolRefusal("Invalid arguments: give the notification's text, and a title if you want one."),
    isUnasked: true,
    schema: Schema.Struct({
      phone,
      text: text("The notification's text."),
      title: optionalText('The notification\'s title. "Outlore" when left out.'),
    }),
  }),
  phone_open: definitionOf({
    description: described(
      `Open a link, or an installed app, on the phone. Give exactly one of url and app. Links open only with the schemes ${openableSchemes.join(", ")}. Apps open by these names only: ${openableApps.join(", ")}.`,
    ),
    invalid: toolRefusal("Invalid arguments: give exactly one of url and app."),
    isUnasked: true,
    schema: Schema.Struct({
      app: optionalText(`The app to open, one of: ${openableApps.join(", ")}. Leave out when you give url.`),
      phone,
      url: optionalText(
        `The link to open, with one of the schemes ${openableSchemes.join(", ")}. Leave out when you give app.`,
      ),
    }),
  }),
} satisfies Record<PhoneToolName, unknown>;

/** Whether a tool name is one of the phone tools. */
export const isPhoneToolName = (name: string): name is PhoneToolName => Object.hasOwn(phoneToolDefinitions, name);
