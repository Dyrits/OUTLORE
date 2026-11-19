import type { CatalogEntry } from "./catalog.ts";

// The two connectors Outlore offers first (connectors specification, Composio and Apple apps). The servers are not run
// by this build: the Composio entry's tools are the seven it publishes on its own page and in its repo (research note,
// 2026-11-19); the Apple apps entry's tools are classified once the pinned version's listing is read (blueprint step 4,
// second half), so it names none and therefore offers none yet.

/**
 * Composio: the hosted MCP server at `connect.composio.dev/mcp` offers exactly seven meta-tools (documentation/research/
 * composio-mcp-2026-11-19.md), by which a thread reaches any app the owner connected on Composio's own page. The two
 * discovery tools are `Read`, verified pure discovery against the repo's own words; the five that act, connect or run
 * code are `Write`, so each call asks: one search can name a tool that writes, so discovery is where trusting stops.
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
  tools: {
    COMPOSIO_GET_TOOL_SCHEMAS: {
      app: null,
      class: "Read",
      summary: "Read the input schema of a tool Composio's search returned, by its exact name.",
    },
    COMPOSIO_MANAGE_CONNECTIONS: {
      app: null,
      class: "Write",
      summary: "Create, list, rename or remove the sign-ins to an app that Composio's service holds.",
    },
    COMPOSIO_MULTI_EXECUTE_TOOL: {
      app: null,
      class: "Write",
      summary: "Run one or more of the apps' tools through Composio, up to fifty at once.",
    },
    COMPOSIO_REMOTE_BASH_TOOL: {
      app: null,
      class: "Write",
      summary: "Run shell commands in Composio's remote sandbox, on files it holds there.",
    },
    COMPOSIO_REMOTE_WORKBENCH: {
      app: null,
      class: "Write",
      summary: "Run Python in Composio's remote sandbox, also as a notebook across calls.",
    },
    COMPOSIO_SEARCH_TOOLS: {
      app: null,
      class: "Read",
      summary: "Search Composio's catalog of app tools for a request, and see which apps are already connected.",
    },
    COMPOSIO_WAIT_FOR_CONNECTIONS: {
      app: null,
      class: "Write",
      summary: "Wait for you to finish a sign-in to an app that Composio started, before the thread goes on.",
    },
  },
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
