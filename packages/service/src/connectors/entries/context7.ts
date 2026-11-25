import type { CatalogEntry } from "../catalog.ts";

/**
 * Context7 (Upstash): the hosted MCP server at `mcp.context7.com/mcp` answers without a key, and its two tools were read from its own `tools/list` on 2026-11-25 (`test/fixtures/hostedListings.ts`); the code behind the endpoint is `upstash/context7` (MIT, read at 35656a23c8f1).
 * Both tools look documentation up and change nothing, so both are `Read`, as the tools' own descriptions and their `readOnlyHint` say, though the hint is never what classifies them.
 */
export const context7Entry: CatalogEntry = {
  apps: [],
  backend: { _tag: "Http", header: null, url: "https://mcp.context7.com/mcp" },
  description: "Look up current documentation and code examples for a programming library or framework.",
  id: "context7",
  licence: "MIT",
  name: "Context7",
  notice:
    "Context7 is a service run by another company, Upstash. It sees each library name and question a thread sends it and returns documentation. It needs no account and no key, and Outlore sends it nothing else.",
  platform: "Any",
  secretKind: null,
  tools: {
    "query-docs": {
      app: null,
      class: "Read",
      summary: "Searches the documentation of a library for a question, by a library id",
    },
    "resolve-library-id": {
      app: null,
      class: "Read",
      summary: "Finds the Context7 library id for a library or product name",
    },
  },
};
