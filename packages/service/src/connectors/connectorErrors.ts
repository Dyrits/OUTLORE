import type { ConnectorErrorClass } from "./backend.ts";

// What a thread is told when a connector fails or a call is refused (connectors blueprint, Errors and secrecy): fixed
// sentences by class, never a server's own words.

/** The sentence a thread reads for each class of backend failure. */
export const failureSentenceOf = {
  Disconnected:
    "The connector's sign-in or permission was refused, so it is marked Needs connecting. Carry on without it.",
  Failed: "The connector could not do this. Carry on without it, or try something else.",
  InvalidArguments: "The connector did not accept these arguments. Check the tool's input and call it again.",
  Unreachable: "The connector could not be reached. Carry on without it.",
} as const satisfies Record<ConnectorErrorClass, string>;

/** The line a thread's conversation shows when a connector fails, naming the connector, for the classes that warn. */
export const warningOf = (name: string, errorClass: ConnectorErrorClass) =>
  errorClass === "Disconnected"
    ? `${name} needs connecting again, so this turn goes on without it.`
    : errorClass === "Unreachable"
      ? `${name} could not be reached, so this turn goes on without it.`
      : null;

/** What the owner reads under Needs connecting for a connector whose credentials were refused. */
export const needsReasonOf = (name: string) => `${name} refused its sign-in or permission. Connect it again.`;

/** The refusals a call can meet before it runs, as the thread reads them. */
export const refusals = {
  cancelled: "This connector is off for this thread.",
  cancelledAfterDispatch: "Stopped: this connector is off for this thread. The action may already have happened.",
  denied: (text: string) => text,
  noQuestion: "This thread is not at work, so nothing runs.",
  unknown: (name: string) => `Unknown tool: ${name}`,
  unreachable: "The connector could not be reached. Carry on without it.",
} as const;

/** Every spelling of a secret a server might echo back: raw, URL-encoded, base64 and base64url. */
const spellingsOf = (secret: string) => {
  const bytes = Buffer.from(secret);
  return [secret, encodeURIComponent(secret), bytes.toString("base64"), bytes.toString("base64url")];
};

/**
 * The text with every occurrence of each secret, in each spelling, replaced by `[redacted]`: the last guard on anything
 * that leaves the gateway, longest spellings first so a spelling containing another is replaced whole.
 */
export const redactedOf = (text: string, secrets: ReadonlyArray<string>) => {
  const spellings = secrets
    .filter((secret) => secret !== "")
    .flatMap(spellingsOf)
    .filter((spelling) => spelling !== "")
    .toSorted((first, second) => second.length - first.length);
  return spellings.reduce((current, spelling) => current.split(spelling).join("[redacted]"), text);
};

/** The most characters of a connector's answer a thread reads, cut with a note, as Code Mode cuts its runs. */
const maxAnswerCharacters = 24_000;

/** The answer cut to what a thread reads. */
export const cappedOf = (text: string) =>
  text.length <= maxAnswerCharacters
    ? text
    : `${text.slice(0, maxAnswerCharacters)}\n[Cut: ${text.length - maxAnswerCharacters} more characters.]`;
