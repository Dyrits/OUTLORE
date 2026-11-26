import type { CatalogEntry } from "../catalog.ts";

/**
 * Tavily: the hosted MCP server at `mcp.tavily.com/mcp/`, reached with a Tavily API key as `Authorization: Bearer <key>` (README, "Remote MCP Server").
 * No key is held, so no live `tools/list` was read: the six names are those the server registers in `src/index.ts` of `tavily-ai/tavily-mcp` at a65282ee41f1 (MIT, read 2026-11-25), the repository its README presents as the server behind the remote address.
 * Searching, reading, crawling, mapping and researching the web change nothing for the owner (they spend Tavily credits): `Read`.
 * `tavily_feedback` posts to Tavily's `/feedback` endpoint: `Write`.
 */
export const tavilyEntry: CatalogEntry = {
  apps: [],
  backend: {
    _tag: "Http",
    header: "authorization",
    oauth: { clientName: "Outlore" },
    prefix: "Bearer ",
    url: "https://mcp.tavily.com/mcp/",
  },
  description: "Search the web, read pages, map and crawl websites, and research a question.",
  id: "tavily",
  licence: "MIT",
  name: "Tavily",
  notice:
    "Tavily is a service run by another company. It sees each search phrase, web address and question a thread sends it, and fetches the pages for it. A thread can put anything it has read in a search phrase or an address, and that leaves this computer. Sign in on Tavily's page in your browser or enter your Tavily API key, which Outlore keeps in the Vault on this computer; each call spends credits of your account.",
  platform: "Any",
  secretKind: "API key",
  tools: {
    tavily_crawl: {
      app: null,
      class: "Read",
      summary: "Follows the links of a website from a starting address and reads its pages",
    },
    tavily_extract: { app: null, class: "Read", summary: "Reads the content of web pages by address" },
    tavily_feedback: { app: null, class: "Write", summary: "Sends Tavily feedback on a search result" },
    tavily_map: { app: null, class: "Read", summary: "Lists the pages of a website from a starting address" },
    tavily_research: {
      app: null,
      class: "Read",
      summary: "Researches a question across many web sources and writes a report",
    },
    tavily_search: {
      app: null,
      class: "Read",
      summary: "Searches the web and returns short excerpts with their addresses",
    },
  },
};
