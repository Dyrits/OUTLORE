import { type CatalogEntry, hostedServiceLicence, oauthSecretKind } from "../catalog.ts";

/**
 * Vercel: the official remote MCP server at `mcp.vercel.com`.
 * Live-probed on 2026-11-26: returns HTTP 401 with RFC 9728 protected-resource metadata, RFC 8414 issuer `https://vercel.com`, PKCE `S256`, and RFC 7591 dynamic client registration.
 * Vercel's hosted server scopes tools dynamically by project and permissions, so `tools` stays empty and every runtime-discovered tool is Unclassified and asks the owner on each call until verified against a live listing.
 */
export const vercelEntry: CatalogEntry = {
  apps: [],
  backend: {
    _tag: "Http",
    header: "authorization",
    oauth: { clientName: "Outlore" },
    prefix: "Bearer ",
    shouldUseSession: true,
    url: "https://mcp.vercel.com",
  },
  description: "Inspect Vercel projects, deployments, build logs, and documentation.",
  id: "vercel",
  licence: hostedServiceLicence,
  name: "Vercel",
  notice:
    "Vercel is a service run by another company. You sign in on Vercel's own page in your browser, and Outlore keeps the OAuth session in the Vault on this computer. Vercel sees every request a thread makes and returns project and deployment data from your account, which goes to the model provider of the thread. Because Vercel's hosted tool list is discovered at sign-in, Outlore asks before every call unless you grant a standing permission.",
  platform: "Any",
  secretKind: oauthSecretKind,
  tools: {},
};
