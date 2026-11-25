import type { CatalogEntry } from "../catalog.ts";

/**
 * Firecrawl: the hosted MCP server at `mcp.firecrawl.dev/mcp` answers without a key, and the three tools it lists that way were read from its own `tools/list` on 2026-11-25 (`test/fixtures/hostedListings.ts`); its repository `firecrawl/firecrawl-mcp-server` (MIT, read at f5488e406c6f) is the server it hosts.
 * With a key it offers more tools (a site map, a crawl), which this entry does not take, so they never reach a thread.
 * Scraping a page, searching the web and parsing a document change nothing: all three are `Read`.
 */
export const firecrawlEntry: CatalogEntry = {
  apps: [],
  backend: { _tag: "Http", header: null, url: "https://mcp.firecrawl.dev/mcp" },
  description: "Read a web page or a document as clean text, and search the web.",
  id: "firecrawl",
  licence: "MIT",
  name: "Firecrawl",
  notice:
    "Firecrawl is a service run by another company. It sees each web address and search phrase a thread sends it, and fetches the pages for it. A thread can put anything it has read in an address or a search phrase, and that leaves this computer. It needs no account and no key, and Outlore sends it nothing else.",
  platform: "Any",
  secretKind: null,
  tools: {
    firecrawl_parse: {
      app: null,
      class: "Read",
      summary: "Turns one document (a page, PDF, Word or spreadsheet file) into text",
    },
    firecrawl_scrape: { app: null, class: "Read", summary: "Reads one web page, as text or in the shape asked for" },
    firecrawl_search: { app: null, class: "Read", summary: "Searches the web and returns ranked results" },
  },
};
