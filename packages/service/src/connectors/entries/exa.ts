import type { CatalogEntry } from "../catalog.ts";

/**
 * Exa: the hosted MCP server at `mcp.exa.ai/mcp` answers without a key, and the two tools it lists that way were read from its own `tools/list` on 2026-11-25 (`test/fixtures/hostedListings.ts`); its repository `exa-labs/exa-mcp-server` (MIT, read at 81d687e7669b) is the server it hosts, and offers more tools with a key, which this entry does not take.
 * Searching the web and reading a page change nothing: both are `Read`.
 */
export const exaEntry: CatalogEntry = {
  apps: [],
  backend: { _tag: "Http", header: null, url: "https://mcp.exa.ai/mcp" },
  description: "Search the web and read pages as clean text.",
  id: "exa",
  licence: "MIT",
  name: "Exa",
  notice:
    "Exa is a service run by another company. It sees each search phrase and web address a thread sends it, and fetches the pages for it. A thread can put anything it has read in a search phrase or an address, and that leaves this computer. It needs no account and no key, and Outlore sends it nothing else.",
  platform: "Any",
  secretKind: null,
  tools: {
    web_fetch_exa: { app: null, class: "Read", summary: "Reads the full text of web pages by address" },
    web_search_exa: {
      app: null,
      class: "Read",
      summary: "Searches the web and returns the best results with excerpts",
    },
  },
};
