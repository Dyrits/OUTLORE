import { type CatalogEntry, hostedServiceLicence, oauthSecretKind } from "../catalog.ts";

/**
 * monday.com: the official remote MCP server at `mcp.monday.com/mcp`.
 * Live-probed on 2026-11-26: returns HTTP 401 with RFC 9728 protected-resource metadata, RFC 8414 issuer `https://auth.monday.com/mcp`, PKCE `S256`, and RFC 7591 dynamic client registration.
 * monday.com publishes no complete static tool list without signing in, so `tools` stays empty and every runtime-discovered tool is Unclassified and asks the owner on each call until verified against a live listing.
 */
export const mondayEntry: CatalogEntry = {
  apps: [],
  backend: {
    _tag: "Http",
    header: "authorization",
    oauth: { clientName: "Outlore" },
    prefix: "Bearer ",
    shouldUseSession: true,
    url: "https://mcp.monday.com/mcp",
  },
  description: "Search and manage monday.com boards, items, columns, and project updates.",
  id: "monday",
  licence: hostedServiceLicence,
  name: "monday.com",
  notice:
    "monday.com is a service run by another company. You sign in on monday.com's own page in your browser, and Outlore keeps the OAuth session in the Vault on this computer. monday.com sees every request a thread makes and returns board and item data from your account, which goes to the model provider of the thread. Because monday.com's hosted tool list is discovered at sign-in, Outlore asks before every call unless you grant a standing permission.",
  platform: "Any",
  secretKind: oauthSecretKind,
  tools: {},
};
