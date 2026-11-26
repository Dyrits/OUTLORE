import { Option, Schema } from "effect";
import type { PhoneOpenTarget } from "./phoneDeviceTypes";

const Text = Schema.Struct({ text: Schema.String });
const Notification = Schema.Struct({ text: Schema.String, title: Schema.optionalKey(Schema.String) });
const Opening = Schema.Struct({ app: Schema.optionalKey(Schema.String), url: Schema.optionalKey(Schema.String) });

/** The title a notification carries when the thread gives none. */
const defaultNotificationTitle = "Outlore";

/** What a tool's arguments gave, or the one sentence saying what the call lacks. */
export type PhoneArguments<Value> =
  | { readonly _tag: "Valid"; readonly value: Value }
  | {
      readonly _tag: "Invalid";
      readonly reason: string;
    };

const valid = <Value>(value: Value): PhoneArguments<Value> => ({ _tag: "Valid", value });
const invalid = (reason: string): PhoneArguments<never> => ({ _tag: "Invalid", reason });

/** The text `phone_clipboard_write` puts on the clipboard. */
export const clipboardTextOf = (args: unknown): PhoneArguments<string> =>
  Option.match(Schema.decodeUnknownOption(Text)(args), {
    onNone: () => invalid("The call needs the text to put on the clipboard."),
    onSome: (decoded) => valid(decoded.text),
  });

/** What `phone_notify` shows: its text, and its title or "Outlore". */
export const notificationOf = (args: unknown): PhoneArguments<{ text: string; title: string }> =>
  Option.match(Schema.decodeUnknownOption(Notification)(args), {
    onNone: () => invalid("The call needs the notification's text."),
    onSome: (decoded) => {
      const title = decoded.title?.trim() ?? "";
      return valid({ text: decoded.text, title: title === "" ? defaultNotificationTitle : title });
    },
  });

/** What `phone_open` opens: the link in `url`, else the app named in `app`. */
export const openingOf = (args: unknown): PhoneArguments<PhoneOpenTarget> =>
  Option.match(Schema.decodeUnknownOption(Opening)(args), {
    onNone: () => invalid("The call needs a link in `url` or an app name in `app`."),
    onSome: (decoded) => {
      const url = decoded.url?.trim() ?? "";
      const name = decoded.app?.trim() ?? "";
      if (url !== "") return valid<PhoneOpenTarget>({ _tag: "Link", url });
      if (name !== "") return valid<PhoneOpenTarget>({ _tag: "App", name });
      return invalid("The call needs a link in `url` or an app name in `app`.");
    },
  });
