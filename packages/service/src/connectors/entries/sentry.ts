import { type CatalogEntry, hostedServiceLicence } from "../catalog.ts";

/**
 * Sentry: the official remote MCP server at `mcp.sentry.dev/mcp`.
 * Live-probed on 2026-11-26: returns HTTP 401 with RFC 9728 protected-resource metadata, RFC 8414 issuer `https://mcp.sentry.dev`, PKCE `S256`, and RFC 7591 dynamic client registration, and also accepts a static Sentry auth token via `Authorization: Bearer <token>`.
 * The upstream repository `getsentry/sentry-mcp` uses FSL-1.1-Apache-2.0 (source-available, not an OSI licence), so the hosted endpoint uses `hostedServiceLicence`.
 * `search_sentry_tools` and `execute_sentry_tool` are read from `packages/mcp-core/src/tools/index.ts` (blob `b7bbe0538940e327c06089e2f7437a17986fec6b`, read 2026-11-26); any other tool the server lists at runtime is Unclassified and asks on every call.
 */
export const sentryEntry: CatalogEntry = {
  apps: [],
  backend: {
    _tag: "Http",
    header: "authorization",
    oauth: { clientName: "Outlore" },
    prefix: "Bearer ",
    shouldUseSession: true,
    url: "https://mcp.sentry.dev/mcp",
  },
  description: "Search Sentry issues, events, releases, and projects, and, after a question, act on them.",
  id: "sentry",
  licence: hostedServiceLicence,
  name: "Sentry",
  notice:
    "Sentry is a service run by another company. Sign in on Sentry's page in your browser or enter a Sentry auth token, which Outlore keeps in the Vault on this computer. Sentry sees every request a thread makes and returns error traces and issue data from your projects, which goes to the model provider of the thread. Outlore asks before every write or unclassified tool.",
  platform: "Any",
  secretKind: "Auth token",
  tools: {
    execute_sentry_tool: {
      app: null,
      class: "Write",
      summary: "Runs a Sentry MCP catalog tool with the signed-in account's permissions",
    },
    search_sentry_tools: {
      app: null,
      class: "Read",
      summary: "Searches available Sentry MCP tools and reads their descriptions",
    },
  },
};
