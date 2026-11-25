import { type CatalogEntry, hostedServiceLicence } from "../catalog.ts";

/**
 * DeepWiki (Cognition): the hosted MCP server at `mcp.deepwiki.com/mcp` answers without a key, and its three tools were read from its own `tools/list` on 2026-11-25 (`test/fixtures/hostedListings.ts`).
 * Cognition publishes no source for the hosted server, so the licence says so.
 * All three read the generated wiki of a public GitHub repository, or ask a question of it, and change nothing: `Read`.
 */
export const deepwikiEntry: CatalogEntry = {
  apps: [],
  backend: { _tag: "Http", header: null, url: "https://mcp.deepwiki.com/mcp" },
  description: "Read the generated documentation of a public GitHub repository, or ask a question about its code.",
  id: "deepwiki",
  licence: hostedServiceLicence,
  name: "DeepWiki",
  notice:
    "DeepWiki is a service run by another company, Cognition. It sees the repository names and questions a thread sends it, and answers with an AI-written summary of the repository's code. It needs no account and no key, and Outlore sends it nothing else.",
  platform: "Any",
  secretKind: null,
  tools: {
    ask_wiki_question: {
      app: null,
      class: "Read",
      summary: "Asks a question about a repository and gets an answer from its wiki",
    },
    read_wiki_contents: { app: null, class: "Read", summary: "Reads the documentation of a repository" },
    read_wiki_structure: { app: null, class: "Read", summary: "Lists the documentation topics of a repository" },
  },
};
