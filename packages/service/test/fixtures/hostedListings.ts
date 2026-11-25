// The tool names each hosted connector of Wave 1 lists, recorded from a primary source (connectors specification,
// Wave 1): a keyless server's own `tools/list`, read from this computer on 2026-11-25, or, for a server that needs a
// key this build has none of, the vendor's repository or documentation read on that date. `source` says which.

/** One connector's recorded listing: where the names were read, and the names. */
export type HostedListing = {
  readonly names: ReadonlyArray<string>;
  readonly source: string;
};

/** The recorded listings, keyed by connector id. */
export const hostedListings: Readonly<Record<string, HostedListing>> = {
  aws_knowledge: {
    names: [
      "aws___read_documentation",
      "aws___search_documentation",
      "aws___list_regions",
      "aws___get_regional_availability",
      "aws___retrieve_skill",
    ],
    source: "live tools/list of https://knowledge-mcp.global.api.aws, 2026-11-25",
  },
  cloudflare_docs: {
    names: ["search_cloudflare_documentation", "migrate_pages_to_workers_guide"],
    source: "live tools/list of https://docs.mcp.cloudflare.com/mcp, 2026-11-25",
  },
  context7: {
    names: ["resolve-library-id", "query-docs"],
    source: "live tools/list of https://mcp.context7.com/mcp, 2026-11-25",
  },
  deepwiki: {
    names: ["ask_wiki_question", "read_wiki_contents", "read_wiki_structure"],
    source: "live tools/list of https://mcp.deepwiki.com/mcp, 2026-11-25",
  },
  exa: {
    names: ["web_search_exa", "web_fetch_exa"],
    source: "live tools/list of https://mcp.exa.ai/mcp, 2026-11-25",
  },
};
