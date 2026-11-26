import { type CatalogEntry, hostedServiceLicence, oauthSecretKind } from "../catalog.ts";

/**
 * Notion: the official remote MCP server at `mcp.notion.com/mcp`.
 * Live-probed on 2026-11-26: returns HTTP 401 with RFC 9728 protected-resource metadata, RFC 8414 issuer `https://mcp.notion.com`, PKCE `S256`, and RFC 7591 dynamic client registration.
 * Documented tool names are read from Notion's official MCP documentation on 2026-11-26; any additional tool the hosted server lists at runtime is Unclassified and asks on every call.
 */
export const notionEntry: CatalogEntry = {
  apps: [],
  backend: {
    _tag: "Http",
    header: "authorization",
    oauth: { clientName: "Outlore" },
    prefix: "Bearer ",
    shouldUseSession: true,
    url: "https://mcp.notion.com/mcp",
  },
  description: "Search, read, and, after a question, create or update pages, databases, and comments in Notion.",
  id: "notion",
  licence: hostedServiceLicence,
  name: "Notion",
  notice:
    "Notion is a service run by another company. You sign in on Notion's own page in your browser, and Outlore keeps the OAuth session in the Vault on this computer. Notion sees every request a thread makes and returns pages and databases from your workspace, which goes to the model provider of the thread. Limit the pages you share during sign-in to what threads need; Outlore asks before every write or unclassified tool.",
  platform: "Any",
  secretKind: oauthSecretKind,
  tools: {
    "notion-connector-search": {
      app: null,
      class: "Read",
      summary: "Searches connected external sources indexed in Notion",
    },
    "notion-create-comment": { app: null, class: "Write", summary: "Creates a comment on a Notion page or block" },
    "notion-create-database": { app: null, class: "Write", summary: "Creates a new Notion database" },
    "notion-create-pages": { app: null, class: "Write", summary: "Creates one or more pages in Notion" },
    "notion-duplicate-page": { app: null, class: "Write", summary: "Duplicates a Notion page" },
    "notion-fetch": { app: null, class: "Read", summary: "Reads the contents of a Notion page or database" },
    "notion-get-comments": { app: null, class: "Read", summary: "Reads comments on a Notion page or block" },
    "notion-get-groups": { app: null, class: "Read", summary: "Lists permission groups in the Notion workspace" },
    "notion-get-self": { app: null, class: "Read", summary: "Reads the signed-in Notion user and workspace" },
    "notion-get-teams": { app: null, class: "Read", summary: "Lists teamspaces in the Notion workspace" },
    "notion-get-tool-access": {
      app: null,
      class: "Read",
      summary: "Checks which Notion MCP tools are available for the signed-in user",
    },
    "notion-get-users": { app: null, class: "Read", summary: "Lists members and guests of the Notion workspace" },
    "notion-list-favorite-pages": { app: null, class: "Read", summary: "Lists favorite Notion pages" },
    "notion-list-page-backlinks": {
      app: null,
      class: "Read",
      summary: "Lists pages that link to or mention a Notion page",
    },
    "notion-list-private-pages": { app: null, class: "Read", summary: "Lists private Notion pages" },
    "notion-list-recent-pages": { app: null, class: "Read", summary: "Lists recently viewed or edited Notion pages" },
    "notion-list-shared-pages": { app: null, class: "Read", summary: "Lists shared Notion pages" },
    "notion-move-pages": { app: null, class: "Write", summary: "Moves Notion pages to a new parent" },
    "notion-query-meeting-notes": { app: null, class: "Read", summary: "Searches Notion meeting notes" },
    "notion-search": { app: null, class: "Read", summary: "Searches pages and databases in the Notion workspace" },
    "notion-update-database": { app: null, class: "Write", summary: "Updates a Notion database schema or properties" },
    "notion-update-page": { app: null, class: "Write", summary: "Updates a Notion page's content or properties" },
  },
};
