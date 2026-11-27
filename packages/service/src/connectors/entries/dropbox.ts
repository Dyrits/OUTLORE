import { type CatalogEntry, hostedOAuthEntryOf } from "../catalog.ts";

/**
 * Dropbox: the official remote MCP server at `mcp.dropbox.com/mcp`.
 * Live-probed on 2026-11-26: returns HTTP 401 with RFC 9728 protected-resource metadata, RFC 8414 issuer `https://www.dropbox.com`, PKCE `S256`, and RFC 7591 dynamic client registration.
 * Dropbox publishes no complete static tool list without signing in, so `tools` stays empty and every runtime-discovered tool is Unclassified and asks the owner on each call until verified against a live listing.
 */
export const dropboxEntry: CatalogEntry = hostedOAuthEntryOf({
  description: "Search and work with files and folders in your Dropbox account.",
  id: "dropbox",
  name: "Dropbox",
  notice:
    "Dropbox is a service run by another company. You sign in on Dropbox's own page in your browser, where Outlore requests the permissions Dropbox advertises, and Outlore keeps the OAuth session in the Vault on this computer. Dropbox sees every request a thread makes and returns file contents and metadata from your account, which goes to the model provider of the thread. Because Dropbox's hosted tool list is discovered at sign-in, Outlore asks before every call unless you grant a standing permission.",
  url: "https://mcp.dropbox.com/mcp",
});
