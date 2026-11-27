import { type CatalogEntry, hostedOAuthEntryOf } from "../catalog.ts";

/**
 * Linear: the official remote MCP server at `mcp.linear.app/mcp`.
 * Live-probed on 2026-11-26: returns HTTP 401 with RFC 9728 protected-resource metadata, RFC 8414 issuer `https://mcp.linear.app`, PKCE `S256`, and RFC 7591 dynamic client registration, and also accepts a static Linear API key via `Authorization: Bearer <key>`.
 * Linear publishes no complete static tool list without signing in, so `tools` stays empty and every runtime-discovered tool is Unclassified and asks the owner on each call until verified against a live listing.
 */
export const linearEntry: CatalogEntry = hostedOAuthEntryOf({
  description: "Search and manage Linear issues, projects, cycles, teams, and comments.",
  id: "linear",
  name: "Linear",
  notice:
    "Linear is a service run by another company. Sign in on Linear's page in your browser (requesting the permissions Linear advertises) or enter a Linear API key, which Outlore keeps in the Vault on this computer. Linear sees every request a thread makes and returns data from your workspace, which goes to the model provider of the thread. Because Linear's hosted tool list is discovered at sign-in, Outlore asks before every call unless you grant a standing permission.",
  secretKind: "API key",
  url: "https://mcp.linear.app/mcp",
});
