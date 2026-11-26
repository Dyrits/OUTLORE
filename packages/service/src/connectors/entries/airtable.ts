import { type CatalogEntry, hostedServiceLicence, oauthSecretKind } from "../catalog.ts";

/**
 * Airtable: the official remote MCP server at `mcp.airtable.com/mcp`.
 * Live-probed on 2026-11-26: returns HTTP 401 with RFC 9728 protected-resource metadata, RFC 8414 issuer `https://airtable.com/oauth2/v1`, PKCE `S256`, and RFC 7591 dynamic client registration.
 * Airtable publishes no complete static tool list without signing in, so `tools` stays empty and every runtime-discovered tool is Unclassified and asks the owner on each call until verified against a live listing.
 */
export const airtableEntry: CatalogEntry = {
  apps: [],
  backend: {
    _tag: "Http",
    header: "authorization",
    oauth: { clientName: "Outlore" },
    prefix: "Bearer ",
    shouldUseSession: true,
    url: "https://mcp.airtable.com/mcp",
  },
  description: "Read and update Airtable bases, tables, records, and comments.",
  id: "airtable",
  licence: hostedServiceLicence,
  name: "Airtable",
  notice:
    "Airtable is a service run by another company. You sign in on Airtable's own page in your browser, and Outlore keeps the OAuth session in the Vault on this computer. Airtable sees every request a thread makes and returns records from the bases you share, which goes to the model provider of the thread. Limit the bases you share during sign-in to what threads need; because Airtable's hosted tool list is discovered at sign-in, Outlore asks before every call unless you grant a standing permission.",
  platform: "Any",
  secretKind: oauthSecretKind,
  tools: {},
};
