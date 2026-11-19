import type { CatalogEntry } from "./catalog.ts";

// The two connectors Outlore offers first (connectors specification, Composio and Apple apps). Their servers are not
// run by this build: the backends and the exact tool names come with blueprint step 4, read from the real servers.

/**
 * Composio: a hosted MCP server that runs any action of any connected app from inside one call. Its execution tools are
 * never `Read`: each call asks. The catalog names none yet, so every tool asks; a pure discovery tool (searching the
 * toolkits, reading a schema) is added by exact name, after reading what it does, in step 4 (blueprint, Composio).
 */
export const composioEntry: CatalogEntry = {
  apps: [],
  backend: { _tag: "Http", header: "x-consumer-api-key", url: "https://connect.composio.dev/mcp" },
  description:
    "Reach hundreds of web services (mail, calendars, issue trackers, chat) through your own Composio account.",
  id: "composio",
  licence: "MIT",
  name: "Composio",
  notice:
    "Composio is a service run by another company. It stores the sign-ins of the apps you connect through it and sees what their tools return. Outlore holds none of those sign-ins. You need your own Composio account and its key, which Outlore keeps in the Vault on this computer. You connect each app on Composio's own page, not in Outlore.",
  platform: "Any",
  secretKind: "API key",
  tools: {},
};

/**
 * Apple apps: the Mac's Calendar, Reminders, Notes, Contacts, Mail, Messages and Safari, through the pinned community
 * server (`mcp-icloud@2.1.4`, MIT, `MrGo2/icloud-mcp`; connectors specification, Technical notes), run as a stdio
 * child from the copy vendored with the service. Every tool is classified by its exact name after reading what its
 * handler does in that version's source — a name that reads as read-only may still write (`mark-as-read`,
 * `complete-reminder`) — and the server's own annotations are never read. The names and their apps are recorded from
 * the pinned version's real `tools/list` in `test/fixtures/appleServerListing.ts`; the auth tools have no app, so the
 * gateway never offers them (an app-based connector offers only tools whose app is chosen).
 */
export const appleEntry: CatalogEntry = {
  apps: [
    { id: "calendar", isDefault: true, name: "Calendar" },
    { id: "reminders", isDefault: true, name: "Reminders" },
    { id: "notes", isDefault: true, name: "Notes" },
    { id: "contacts", isDefault: true, name: "Contacts" },
    { id: "mail", isDefault: false, name: "Mail" },
    { id: "messages", isDefault: false, name: "Messages" },
    { id: "safari", isDefault: false, name: "Safari" },
  ],
  // The pinned server runs from the copy vendored with the service (packages/service/vendor/mcp-icloud.cjs) with a
  // system Node. USE_LOCAL_MODE is forced so a .env beside the vendored file cannot flip it to cloud mode.
  backend: { _tag: "Stdio", env: { USE_LOCAL_MODE: "true" }, server: "mcp-icloud", version: "2.1.4" },
  description:
    "Let threads work with this Mac's Calendar, Reminders, Notes and Contacts, and, if you choose, Mail, Messages and Safari.",
  id: "apple",
  licence: "MIT",
  name: "Apple apps",
  notice:
    "What a tool reads, such as an email's text, goes to the model provider of the thread that asks. macOS will ask you to allow each app you choose. Mail, Messages and Safari can read private content and reach other people, so they are off unless you choose them.",
  platform: "macOS",
  secretKind: null,
  tools: {
    // Auth tools: no app, so never offered; set-mode changes the server's mode, so it is a write.
    about: { app: null, class: "Read", summary: "What the server is and which mode it runs in" },
    "check-auth-status": { app: null, class: "Read", summary: "Whether the server is signed in and its current mode" },
    "close-safari-tab": { app: "safari", class: "Write", summary: "Closes a tab" },
    "complete-reminder": { app: "reminders", class: "Write", summary: "Marks a reminder complete or not" },
    "create-contact": { app: "contacts", class: "Write", summary: "Creates a contact" },
    "create-event": { app: "calendar", class: "Write", summary: "Creates an event" },
    "create-note": { app: "notes", class: "Write", summary: "Creates a note" },
    "create-reminder": { app: "reminders", class: "Write", summary: "Creates a reminder" },
    "delete-contact": { app: "contacts", class: "Write", summary: "Deletes a contact" },
    "delete-event": { app: "calendar", class: "Write", summary: "Deletes an event" },
    "delete-reminder": { app: "reminders", class: "Write", summary: "Deletes a reminder" },
    "get-current-safari-url": { app: "safari", class: "Read", summary: "Reads the current tab's address" },
    "list-calendars": { app: "calendar", class: "Read", summary: "Lists the calendars" },
    // Messages.
    "list-chats": { app: "messages", class: "Read", summary: "Lists the chats" },
    "list-contact-accounts": { app: "contacts", class: "Read", summary: "Lists the contact accounts" },
    "list-contact-groups": { app: "contacts", class: "Read", summary: "Lists the contact groups" },
    // Contacts.
    "list-contacts": { app: "contacts", class: "Read", summary: "Lists the contacts" },
    // Mail.
    "list-emails": { app: "mail", class: "Read", summary: "Lists the messages of a folder" },
    // Calendar.
    "list-events": { app: "calendar", class: "Read", summary: "Lists the events of a time range" },
    "list-folders": { app: "mail", class: "Read", summary: "Lists the mail folders" },
    // Notes.
    "list-note-folders": { app: "notes", class: "Read", summary: "Lists the note folders" },
    "list-notes": { app: "notes", class: "Read", summary: "Lists the notes of a folder" },
    // Reminders.
    "list-reminder-lists": { app: "reminders", class: "Read", summary: "Lists the reminder lists" },
    "list-reminders": { app: "reminders", class: "Read", summary: "Lists the reminders of a list" },
    // Safari.
    "list-safari-tabs": { app: "safari", class: "Read", summary: "Lists the open tabs" },
    "mark-as-read": { app: "mail", class: "Write", summary: "Marks a message read or unread" },
    "open-safari-url": { app: "safari", class: "Write", summary: "Opens an address in Safari" },
    "react-message": { app: "messages", class: "Write", summary: "Adds a reaction to a message" },
    "read-contact": { app: "contacts", class: "Read", summary: "Reads one contact's details" },
    "read-email": { app: "mail", class: "Read", summary: "Reads one message's full text" },
    "read-messages": { app: "messages", class: "Read", summary: "Reads the messages of a chat" },
    "read-note": { app: "notes", class: "Read", summary: "Reads one note's text" },
    "search-contacts": { app: "contacts", class: "Read", summary: "Searches the contacts" },
    "search-emails": { app: "mail", class: "Read", summary: "Searches messages by text" },
    "search-notes": { app: "notes", class: "Read", summary: "Searches the notes" },
    "search-reminders": { app: "reminders", class: "Read", summary: "Searches the reminders" },
    "send-email": { app: "mail", class: "Write", summary: "Sends a message" },
    "send-message": { app: "messages", class: "Write", summary: "Sends a message to a chat" },
    "set-mode": { app: null, class: "Write", summary: "Switches the server between local and cloud mode" },
    "update-event": { app: "calendar", class: "Write", summary: "Changes an event" },
    "update-reminder": { app: "reminders", class: "Write", summary: "Changes a reminder" },
  },
};

/** Every connector the Charter offers, in the order it lists them. */
export const defaultCatalog: ReadonlyArray<CatalogEntry> = [composioEntry, appleEntry];
