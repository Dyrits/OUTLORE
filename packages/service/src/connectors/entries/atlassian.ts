import { type CatalogEntry, hostedOAuthEntryOf } from "../catalog.ts";

/**
 * Atlassian: the official remote MCP server at `mcp.atlassian.com/v2/mcp` covering Jira, Confluence, and Rovo.
 * Live-probed on 2026-11-26: returns HTTP 401 with RFC 9728 protected-resource metadata at `/v2/mcp`, RFC 8414 authorization server metadata on `auth.atlassian.com`, PKCE `S256`, and RFC 7591 dynamic client registration.
 * Atlassian's hosted server scopes tools dynamically by site and granted permissions, so `tools` stays empty and every runtime-discovered tool is Unclassified and asks the owner on each call until verified against a live listing.
 */
export const atlassianEntry: CatalogEntry = hostedOAuthEntryOf({
  description: "Search and work with Jira issues, Confluence pages, and Atlassian projects.",
  id: "atlassian",
  name: "Atlassian (Jira & Confluence)",
  notice:
    "Atlassian is a service run by another company. You sign in on Atlassian's own page in your browser, where Outlore requests the permissions Atlassian advertises, and Outlore keeps the OAuth session in the Vault on this computer. Atlassian sees every request a thread makes and returns issues and pages from your sites, which goes to the model provider of the thread. Because Atlassian's hosted tools depend on your site and scopes, Outlore asks before every call unless you grant a standing permission.",
  url: "https://mcp.atlassian.com/v2/mcp",
});
