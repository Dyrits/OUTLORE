import { type CatalogEntry, hostedOAuthEntryOf } from "../catalog.ts";

/**
 * Intercom: the official remote MCP server at `mcp.intercom.com/mcp`.
 * Live-probed on 2026-11-26: returns HTTP 401 with RFC 9728 protected-resource metadata, RFC 8414 issuer `https://mcp.intercom.com`, PKCE `S256`, and RFC 7591 dynamic client registration.
 * Intercom publishes no complete static tool list without signing in, so `tools` stays empty and every runtime-discovered tool is Unclassified and asks the owner on each call until verified against a live listing.
 */
export const intercomEntry: CatalogEntry = hostedOAuthEntryOf({
  description: "Search and work with Intercom customer conversations, contacts, and help center articles.",
  id: "intercom",
  name: "Intercom",
  notice:
    "Intercom is a service run by another company. You sign in on Intercom's own page in your browser, where Outlore requests the permissions Intercom advertises, and Outlore keeps the OAuth session in the Vault on this computer. Intercom sees every request a thread makes and returns customer conversations and contact records, which goes to the model provider of the thread. Because Intercom's hosted tool list is discovered at sign-in, Outlore asks before every call unless you grant a standing permission.",
  url: "https://mcp.intercom.com/mcp",
});
