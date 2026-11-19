import type { ApplePermissionReport, ApplePermissionStatus } from "@outlore/contracts";
import { Cause, Effect, Exit, Option } from "effect";
import type { BackendFailure, ConnectorBackend } from "./backend.ts";
import type { CatalogEntry } from "./catalog.ts";

// The Apple permission check (connectors blueprint, Apple permission): macOS grants Automation to a program, and the
// program that talks to Calendar is the connector's own child process, not the host. So the permission is asked and
// checked through that same process chain: the host calls one harmless read tool of each chosen app through the
// connector's backend — the very child the calls run on — and reports what the outcome says. An `osascript` run by
// the host directly would prove a different program's grant. This runs on the host's own window only
// (RequestApplePermission is host-only), and it cannot be exercised inside a thread's sandbox, where Apple Events
// are blocked; the unit tests use a fake backend, and the owner runs the real probe on their Mac.

/**
 * The harmless read tool called for an app: its first Read tool in the catalog, which a test checks is a Read of that
 * app. Listing the calendars, folders or chats asks for nothing more than the app's listing.
 */
export const probeToolOf = (entry: CatalogEntry, app: string): string | null => {
  // Prefer listing folders or tabs over reading messages or the active page.
  const preferred = app === "mail" ? "list-folders" : app === "safari" ? "list-safari-tabs" : null;
  if (preferred !== null && entry.tools[preferred]?.app === app && entry.tools[preferred]?.class === "Read")
    return preferred;
  for (const [name, tool] of Object.entries(entry.tools)) if (tool.app === app && tool.class === "Read") return name;
  return null;
};

/**
 * macOS's words when Automation is refused: an Apple event the program may not send (errAEEventNotPermitted, -1743),
 * or a Privacy & Security denial. Matched only to sort the outcome; the words never leave the service.
 */
export const isApplePermissionDenied = (text: string) =>
  /(?:^|\D)-1743\b|errAEEventNotPermitted|not authorized to send Apple events|not permitted to send Apple events|Full Disk Access required\. Grant it to the terminal/i.test(
    text,
  );

/** One app's status from the outcome of its probe call: allowed when it answered, refused when macOS said no. */
const statusOf = (outcome: Exit.Exit<string, BackendFailure>): ApplePermissionStatus => {
  if (Exit.isSuccess(outcome)) return "Allowed";
  const failure = Cause.findErrorOption(outcome.cause);
  if (Option.isNone(failure)) return "NotAskedYet";
  const error = failure.value;
  if (error.class === "Disconnected") return "NotAllowed";
  if (error.class === "Failed" && isApplePermissionDenied(error.upstream)) return "NotAllowed";
  // Anything else — the child could not start, the call timed out while the macOS prompt waits — is not a grant.
  return "NotAskedYet";
};

/**
 * Asks for each chosen app's permission through the connector's backend, one app at a time so the macOS prompts
 * come one at a time. The backend is the one the connector's calls run on; its `close` stays with the caller.
 */
export const applePermissionReportOf = (
  entry: CatalogEntry,
  apps: ReadonlyArray<string>,
  backend: ConnectorBackend,
): Effect.Effect<ApplePermissionReport> =>
  Effect.gen(function* () {
    const reports = yield* Effect.forEach(
      apps,
      Effect.fnUntraced(function* (app) {
        const tool = probeToolOf(entry, app);
        if (tool === null) return { app, status: "NotAskedYet" as const };
        const outcome = yield* Effect.exit(backend.call(tool, {}, null));
        return { app, status: statusOf(outcome) };
      }),
      { concurrency: 1 },
    );
    return { apps: reports };
  });
