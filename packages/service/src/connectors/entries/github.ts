import type { CatalogEntry } from "../catalog.ts";

/**
 * GitHub: the official remote MCP server at `api.githubcopilot.com/mcp/` (the `default` toolset: context, repos, issues, pull requests, users), reached with a personal access token as `Authorization: Bearer <token>` (README, "Using a GitHub PAT").
 * No key is held, so no live `tools/list` was read: the names are those of `github/github-mcp-server` at c6b62954c062 (README, "Available Toolsets" and "Additional Tools in Remote GitHub MCP Server", read 2026-11-25), whose code (MIT) is what GitHub documents as the remote server's.
 * The four remote-only tools (Copilot, Copilot Spaces, support docs) are named too; whether the default toolset serves them was not checked, and a tool the server lists that is not named here asks.
 * Each tool is classified by reading what its entry says it does: `issue_read` and `pull_request_read` take a `method` that only reads, `issue_write` and `pull_request_review_write` take one that changes things, so the first two are `Read` and the others `Write`; every tool that creates, changes, merges, pushes or deletes is `Write`.
 * The server's `/readonly` address and its per-tool hints are not used: the owner limits what the token may do.
 */
export const githubEntry: CatalogEntry = {
  apps: [],
  backend: { _tag: "Http", header: "authorization", prefix: "Bearer ", url: "https://api.githubcopilot.com/mcp/" },
  description: "Search and read repositories, issues and pull requests on GitHub, and, after a question, change them.",
  id: "github",
  licence: "MIT",
  name: "GitHub",
  notice:
    "GitHub is a service run by another company. It sees every request a thread makes with your token and returns what the token can reach, including text other people wrote in issues and pull requests, which then goes to the model provider of the thread. You need a GitHub personal access token, which Outlore keeps in the Vault on this computer. Create a fine-grained token limited to the repositories you want and, if threads should only read, to read-only permissions: Outlore asks before each tool that changes something, but the token's own limits are the stronger guard.",
  platform: "Any",
  secretKind: "Personal access token",
  tools: {
    add_comment_to_pending_review: {
      app: null,
      class: "Write",
      summary: "Adds a comment to the user's pending review of a pull request",
    },
    add_issue_comment: { app: null, class: "Write", summary: "Adds a comment to an issue or pull request" },
    add_reply_to_pull_request_comment: { app: null, class: "Write", summary: "Replies to a comment on a pull request" },
    create_branch: { app: null, class: "Write", summary: "Creates a branch" },
    create_or_update_file: { app: null, class: "Write", summary: "Creates or changes one file with a commit" },
    create_pull_request: { app: null, class: "Write", summary: "Opens a pull request" },
    create_pull_request_with_copilot: {
      app: null,
      class: "Write",
      summary: "Hands a task to GitHub's Copilot coding agent, which opens a pull request",
    },
    create_repository: { app: null, class: "Write", summary: "Creates a repository" },
    delete_file: { app: null, class: "Write", summary: "Deletes a file with a commit" },
    delete_repository: { app: null, class: "Write", summary: "Deletes a repository" },
    fork_repository: { app: null, class: "Write", summary: "Forks a repository" },
    get_commit: { app: null, class: "Read", summary: "Reads one commit and its changes" },
    get_copilot_space: { app: null, class: "Read", summary: "Reads one Copilot Space" },
    get_file_contents: { app: null, class: "Read", summary: "Reads a file or lists a directory of a repository" },
    get_label: { app: null, class: "Read", summary: "Reads one label of a repository" },
    get_latest_release: { app: null, class: "Read", summary: "Reads the latest release of a repository" },
    get_me: { app: null, class: "Read", summary: "Reads the profile of the signed-in GitHub user" },
    get_release_by_tag: { app: null, class: "Read", summary: "Reads the release of a tag" },
    get_tag: { app: null, class: "Read", summary: "Reads one tag" },
    get_team_members: { app: null, class: "Read", summary: "Lists the members of a team" },
    get_teams: { app: null, class: "Read", summary: "Lists the teams of a user in an organization" },
    github_support_docs_search: { app: null, class: "Read", summary: "Searches GitHub's support documentation" },
    issue_read: { app: null, class: "Read", summary: "Reads an issue, its comments, sub-issues, parent or labels" },
    issue_write: { app: null, class: "Write", summary: "Creates or changes an issue" },
    list_branches: { app: null, class: "Read", summary: "Lists the branches of a repository" },
    list_commits: { app: null, class: "Read", summary: "Lists the commits of a branch" },
    list_copilot_spaces: { app: null, class: "Read", summary: "Lists the Copilot Spaces the user can use" },
    list_issue_fields: { app: null, class: "Read", summary: "Lists the issue fields of an organization" },
    list_issue_types: { app: null, class: "Read", summary: "Lists the issue types an organization offers" },
    list_issues: { app: null, class: "Read", summary: "Lists the issues of a repository" },
    list_pull_requests: { app: null, class: "Read", summary: "Lists the pull requests of a repository" },
    list_releases: { app: null, class: "Read", summary: "Lists the releases of a repository" },
    list_repository_collaborators: { app: null, class: "Read", summary: "Lists the collaborators of a repository" },
    list_tags: { app: null, class: "Read", summary: "Lists the tags of a repository" },
    merge_pull_request: { app: null, class: "Write", summary: "Merges a pull request" },
    pull_request_read: {
      app: null,
      class: "Read",
      summary: "Reads a pull request, its diff, files, status, reviews or comments",
    },
    pull_request_review_write: {
      app: null,
      class: "Write",
      summary: "Creates, submits or deletes a review on a pull request",
    },
    push_files: { app: null, class: "Write", summary: "Commits several files in one push" },
    search_code: { app: null, class: "Read", summary: "Searches code across repositories" },
    search_commits: { app: null, class: "Read", summary: "Searches commits" },
    search_issues: { app: null, class: "Read", summary: "Searches issues" },
    search_pull_requests: { app: null, class: "Read", summary: "Searches pull requests" },
    search_repositories: { app: null, class: "Read", summary: "Searches repositories" },
    search_users: { app: null, class: "Read", summary: "Searches users" },
    sub_issue_write: { app: null, class: "Write", summary: "Adds, removes or reorders the sub-issues of an issue" },
    ui_get: {
      app: null,
      class: "Read",
      summary: "Reads the labels, assignees, milestones, branches or reviewers a form would offer",
    },
    update_issue_comment: { app: null, class: "Write", summary: "Changes a comment on an issue or pull request" },
    update_pull_request: {
      app: null,
      class: "Write",
      summary: "Changes a pull request's title, body, state or reviewers",
    },
    update_pull_request_branch: {
      app: null,
      class: "Write",
      summary: "Updates a pull request's branch with the latest of its base",
    },
  },
};
