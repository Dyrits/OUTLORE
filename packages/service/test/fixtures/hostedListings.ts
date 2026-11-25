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
  firecrawl: {
    names: ["firecrawl_scrape", "firecrawl_search", "firecrawl_parse"],
    source: "live tools/list of https://mcp.firecrawl.dev/mcp, 2026-11-25",
  },
  github: {
    names: [
      "get_me",
      "get_teams",
      "get_team_members",
      "ui_get",
      "issue_read",
      "list_issues",
      "search_issues",
      "get_label",
      "list_issue_types",
      "list_issue_fields",
      "issue_write",
      "sub_issue_write",
      "add_issue_comment",
      "update_issue_comment",
      "list_pull_requests",
      "search_pull_requests",
      "pull_request_read",
      "create_pull_request",
      "update_pull_request",
      "update_pull_request_branch",
      "merge_pull_request",
      "pull_request_review_write",
      "add_comment_to_pending_review",
      "add_reply_to_pull_request_comment",
      "get_file_contents",
      "list_branches",
      "list_commits",
      "get_commit",
      "list_tags",
      "get_tag",
      "list_releases",
      "get_latest_release",
      "get_release_by_tag",
      "list_repository_collaborators",
      "search_repositories",
      "search_code",
      "search_commits",
      "search_users",
      "create_repository",
      "fork_repository",
      "create_branch",
      "create_or_update_file",
      "push_files",
      "delete_file",
      "delete_repository",
      "create_pull_request_with_copilot",
      "get_copilot_space",
      "list_copilot_spaces",
      "github_support_docs_search",
    ],
    source:
      "README of github/github-mcp-server at c6b62954c062b3ad779f4e208716e09cb4a723e0 (default toolset and remote-only tools), 2026-11-25",
  },
};
