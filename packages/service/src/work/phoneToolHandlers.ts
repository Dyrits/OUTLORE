import { type PhoneToolName, phoneGroupOf } from "@outlore/contracts";
import { Effect } from "effect";
import { toolRefusal, toolText } from "../core/index.ts";
import type { PhoneLink } from "./phoneLink.ts";
import { type ToolHandlers, threadTools } from "./threadTools.ts";

/** What a phone's value is told to the model as: text as it is, anything else as JSON. */
const textOf = (value: unknown) => (typeof value === "string" ? value : (JSON.stringify(value) ?? "Done."));

/**
 * The phone tools' handlers: each runs its call on the owner's phone through the phone link and answers with the
 * phone's value, or with the one sentence saying why nothing happened. There is no approval path: the switch on the
 * phone is the consent (phone-control).
 */
export const phoneToolsOf = (link: PhoneLink["Service"]) => {
  const run = (tool: PhoneToolName, given: { readonly phone?: string }, args: unknown) =>
    link.call(phoneGroupOf[tool], tool, args, given.phone).pipe(
      Effect.map((value) => toolText(textOf(value))),
      Effect.catchTag("PhoneRefusal", (refusal) => Effect.succeed(toolRefusal(refusal.reason))),
    );
  return {
    phone_clipboard_read: (_threadId, given) => run("phone_clipboard_read", given, {}),
    phone_clipboard_write: (_threadId, given) => run("phone_clipboard_write", given, { text: given.text }),
    phone_info: (_threadId, given) => run("phone_info", given, {}),
    phone_location: (_threadId, given) => run("phone_location", given, {}),
    phone_notify: (_threadId, given) =>
      run(
        "phone_notify",
        given,
        given.title === undefined ? { text: given.text } : { text: given.text, title: given.title },
      ),
    phone_open: (_threadId, { app, url, ...given }) => {
      // The phone opens one thing: a link or an app, never both and never neither.
      if ((app === undefined) === (url === undefined)) return Effect.succeed(threadTools.phone_open.invalid);
      return run("phone_open", given, url === undefined ? { app } : { url });
    },
  } satisfies Pick<ToolHandlers, PhoneToolName>;
};
