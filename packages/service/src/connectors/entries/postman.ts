import { type CatalogEntry, hostedServiceLicence, oauthSecretKind } from "../catalog.ts";

/**
 * Postman: the official remote MCP server at `mcp.postman.com/mcp`.
 * Live-probed on 2026-11-26: returns HTTP 401 with RFC 9728 protected-resource metadata, RFC 8414 issuer `https://mcp.postman.com`, PKCE `S256`, and RFC 7591 dynamic client registration.
 * Postman publishes no complete static tool list without signing in, so `tools` stays empty and every runtime-discovered tool is Unclassified and asks the owner on each call until verified against a live listing.
 */
export const postmanEntry: CatalogEntry = {
  apps: [],
  backend: {
    _tag: "Http",
    header: "authorization",
    oauth: { clientName: "Outlore" },
    prefix: "Bearer ",
    shouldUseSession: true,
    url: "https://mcp.postman.com/mcp",
  },
  description: "Inspect and manage Postman workspaces, API collections, environments, and specs.",
  id: "postman",
  licence: hostedServiceLicence,
  name: "Postman",
  notice:
    "Postman is a service run by another company. You sign in on Postman's own page in your browser, and Outlore keeps the OAuth session in the Vault on this computer. Postman sees every request a thread makes and returns collections and environment data from your workspaces, which goes to the model provider of the thread. Because Postman's hosted tool list is discovered at sign-in, Outlore asks before every call unless you grant a standing permission.",
  platform: "Any",
  secretKind: oauthSecretKind,
  tools: {},
};
