import { type CatalogEntry, hostedServiceLicence } from "../catalog.ts";

/**
 * AWS Knowledge: the hosted MCP server at `knowledge-mcp.global.api.aws` answers without a key, and its five tools were read from its own `tools/list` on 2026-11-25 (`test/fixtures/hostedListings.ts`); the tool names carry the server's own `aws___` prefix.
 * AWS publishes no source for this hosted server (its docs describe a managed service), so the licence says so.
 * All five tools fetch or search AWS documentation, a skill file or the region list, and change nothing: `Read`.
 */
export const awsKnowledgeEntry: CatalogEntry = {
  apps: [],
  backend: { _tag: "Http", header: null, url: "https://knowledge-mcp.global.api.aws" },
  description: "Search and read AWS documentation, check which regions offer a service, and fetch AWS skill guides.",
  id: "aws_knowledge",
  licence: hostedServiceLicence,
  name: "AWS Knowledge",
  notice:
    "AWS Knowledge is a service run by another company, Amazon Web Services. It sees each search phrase and documentation address a thread sends it and returns documentation. It needs no account and no key, and Outlore sends it nothing else.",
  platform: "Any",
  secretKind: null,
  tools: {
    aws___get_regional_availability: {
      app: null,
      class: "Read",
      summary: "Checks whether AWS products, APIs or CloudFormation resources are offered in given regions",
    },
    aws___list_regions: { app: null, class: "Read", summary: "Lists the AWS regions" },
    aws___read_documentation: { app: null, class: "Read", summary: "Reads full AWS documentation pages" },
    aws___retrieve_skill: { app: null, class: "Read", summary: "Reads an AWS skill guide or one of its files" },
    aws___search_documentation: { app: null, class: "Read", summary: "Searches the AWS documentation for a question" },
  },
};
