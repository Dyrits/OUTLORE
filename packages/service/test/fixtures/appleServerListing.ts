// The tools/list of the pinned Apple server, mcp-icloud@2.1.4, as run over stdio with a system Node on
// 2026-11-19 (local AppleScript mode; the listing needs no Apple access). Recorded from the real server, so a
// version bump that adds or renames a tool fails the pinning test in appleCatalog.test.ts, which asks the catalog
// to name every tool this lists. The opt-in live test there re-runs the vendored server (OUTLORE_LIVE_APPLE_SERVER=1).

/** The server the listing came from, as it named itself in its opening exchange. */
export const recordedAppleServer = { name: "icloud-mcp", version: "2.1.4" } as const;

/** The protocol revision the exchange negotiated. */
export const recordedAppleProtocolVersion = "2025-11-25";

/** Every tool name the pinned version lists, in the server's own order. */
export const recordedAppleToolNames: ReadonlyArray<string> = [
  "about",
  "check-auth-status",
  "set-mode",
  "list-emails",
  "read-email",
  "send-email",
  "search-emails",
  "mark-as-read",
  "list-folders",
  "list-events",
  "create-event",
  "update-event",
  "delete-event",
  "list-calendars",
  "list-contacts",
  "search-contacts",
  "read-contact",
  "create-contact",
  "delete-contact",
  "list-contact-accounts",
  "list-contact-groups",
  "list-reminder-lists",
  "list-reminders",
  "create-reminder",
  "update-reminder",
  "complete-reminder",
  "delete-reminder",
  "search-reminders",
  "list-note-folders",
  "list-notes",
  "read-note",
  "create-note",
  "search-notes",
  "list-chats",
  "read-messages",
  "send-message",
  "react-message",
  "list-safari-tabs",
  "get-current-safari-url",
  "open-safari-url",
  "close-safari-tab",
];
