import type { CatalogEntry } from "../catalog.ts";

/**
 * Cloudflare Docs: the hosted MCP server at `docs.mcp.cloudflare.com/mcp` answers without a key, and its two tools were
 * read from its own `tools/list` on 2026-11-25 (`test/fixtures/hostedListings.ts`); the code behind the endpoint is the
 * documentation server of `cloudflare/mcp-server-cloudflare` (Apache-2.0, read at a21972e219ae, `apps/docs-ai-search`).
 * The search returns documentation chunks and the guide returns a fixed page, so both are `Read`.
 */
export const cloudflareDocsEntry: CatalogEntry = {
  apps: [],
  backend: { _tag: "Http", header: null, url: "https://docs.mcp.cloudflare.com/mcp" },
  description: "Search Cloudflare's documentation, and read its guide to moving Pages projects to Workers.",
  id: "cloudflare_docs",
  licence: "Apache-2.0",
  name: "Cloudflare Docs",
  notice:
    "Cloudflare Docs is a service run by another company, Cloudflare. It sees each search phrase a thread sends it and returns documentation. It needs no account and no key, and Outlore sends it nothing else.",
  platform: "Any",
  secretKind: null,
  tools: {
    migrate_pages_to_workers_guide: {
      app: null,
      class: "Read",
      summary: "Reads Cloudflare's guide to migrating a Pages project to Workers",
    },
    search_cloudflare_documentation: {
      app: null,
      class: "Read",
      summary: "Searches the Cloudflare documentation for a question",
    },
  },
};
