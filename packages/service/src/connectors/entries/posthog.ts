import { type CatalogEntry, hostedOAuthEntryOf } from "../catalog.ts";

/**
 * PostHog: the official remote MCP server at `mcp.posthog.com/mcp`.
 * Live-probed on 2026-11-26: returns HTTP 401 with RFC 9728 protected-resource metadata, RFC 8414 issuer `https://oauth.posthog.com`, PKCE `S256`, and RFC 7591 dynamic client registration, and also accepts a static PostHog personal API key via `Authorization: Bearer <key>`.
 * PostHog's hosted server dynamically exposes command execution and scoped analytics tools, so `tools` stays empty and every runtime-discovered tool is Unclassified and asks the owner on each call until verified against a live listing.
 */
export const posthogEntry: CatalogEntry = hostedOAuthEntryOf({
  description: "Query PostHog product analytics, feature flags, insights, and experiments.",
  id: "posthog",
  licence: "MIT",
  name: "PostHog",
  notice:
    "PostHog is a service run by another company. Sign in on PostHog's page in your browser (requesting the permissions PostHog advertises) or enter a PostHog personal API key, which Outlore keeps in the Vault on this computer. PostHog sees every request a thread makes and returns analytics data from your projects, which goes to the model provider of the thread. Because PostHog's hosted tools are discovered at sign-in and can execute broad queries, Outlore asks before every call unless you grant a standing permission.",
  secretKind: "Personal API key",
  url: "https://mcp.posthog.com/mcp",
});
