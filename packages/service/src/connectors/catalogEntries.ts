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
 * Apple apps: the Mac's Calendar, Reminders, Notes, Contacts, Mail, Messages and Safari, through a pinned community
 * server (`MrGo2/icloud-mcp`, MIT; connectors specification, Technical notes). Each tool is classified by its exact name
 * and the app it belongs to once the pinned version's listing is read in step 4; until then the catalog names none, so
 * no tool has a known app and none is offered (an app's choice cannot be enforced on a tool whose app is unknown).
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
  backend: { _tag: "Stdio", command: ["npx", "-y", "mcp-icloud@2.1.4"], version: "2.1.4" },
  description:
    "Let threads work with this Mac's Calendar, Reminders, Notes and Contacts, and, if you choose, Mail, Messages and Safari.",
  id: "apple",
  licence: "MIT",
  name: "Apple apps",
  notice:
    "What a tool reads, such as an email's text, goes to the model provider of the thread that asks. macOS will ask you to allow each app you choose. Mail, Messages and Safari can read private content and reach other people, so they are off unless you choose them.",
  platform: "macOS",
  secretKind: null,
  tools: {},
};

/** Every connector the Charter offers, in the order it lists them. */
export const defaultCatalog: ReadonlyArray<CatalogEntry> = [composioEntry, appleEntry];
