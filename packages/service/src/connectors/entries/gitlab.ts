import { type CatalogEntry, hostedServiceLicence } from "../catalog.ts";

/**
 * GitLab: the hosted MCP server of GitLab.com at `gitlab.com/api/v4/mcp`, reached with a fine-grained personal access token that has the MCP tool resource and the Execute permission (GitLab docs, "GitLab MCP server", read 2026-11-25).
 * The docs say legacy personal access tokens, project tokens and group tokens are rejected with 403 `insufficient_scope`, and do not show the header the token goes in: `Authorization: Bearer <token>` is the MCP specification's header and was not tried with a real token.
 * No token is held, so no live `tools/list` was read: the 57 names are the listed tools of the docs' "Tools by toolset" table that day, in the toolsets served by default (the opt-in toolsets, and tools the docs call unlisted and superseded, are left out).
 * GitLab's MCP server is part of GitLab itself and the docs name no licence for it, so the licence says the server code is not published as a separate server.
 * Every tool that gets, lists, reads or searches is `Read`; the docs' `save_*`, `add_*`, `accept_*`, `apply_*`, `link_*`, `fork_*` and Duo session tools create or change things and are `Write`.
 */
export const gitlabEntry: CatalogEntry = {
  apps: [],
  backend: { _tag: "Http", header: "authorization", prefix: "Bearer ", url: "https://gitlab.com/api/v4/mcp" },
  description:
    "Search and read GitLab projects, merge requests, issues, pipelines and code, and, after a question, change them.",
  id: "gitlab",
  licence: hostedServiceLicence,
  name: "GitLab",
  notice:
    "GitLab is a service run by another company. It sees every request a thread makes with your token and returns what the token can reach, including text other people wrote in issues and merge requests, which then goes to the model provider of the thread. You need a GitLab fine-grained personal access token with the MCP tool Execute permission, which Outlore keeps in the Vault on this computer; older token types are refused by GitLab. It works with GitLab.com only. Give the token only the permissions threads need: Outlore asks before each tool that changes something, but the token's own permissions are the stronger guard.",
  platform: "Any",
  secretKind: "Personal access token",
  tools: {
    accept_merge_request: { app: null, class: "Write", summary: "Merges a merge request, or schedules it to merge" },
    add_branch: { app: null, class: "Write", summary: "Creates a branch" },
    add_commit: { app: null, class: "Write", summary: "Commits file changes to a branch" },
    apply_suggestion: { app: null, class: "Write", summary: "Applies a review suggestion as a commit" },
    attach_scan_profile: {
      app: null,
      class: "Write",
      summary: "Attaches a security scan profile to projects or groups",
    },
    fork_repository: { app: null, class: "Write", summary: "Forks a project" },
    get_artifact_file: { app: null, class: "Read", summary: "Reads a file from a job's artifacts" },
    get_commit: { app: null, class: "Read", summary: "Reads one commit" },
    get_duo_session: { app: null, class: "Read", summary: "Reads the status of a GitLab Duo Agent Platform session" },
    get_group: { app: null, class: "Read", summary: "Reads one group" },
    get_job: { app: null, class: "Read", summary: "Reads a CI job, and optionally its log and artifacts" },
    get_mcp_server_version: { app: null, class: "Read", summary: "Reads the version of the GitLab MCP server" },
    get_merge_request: {
      app: null,
      class: "Read",
      summary: "Reads a merge request, and optionally its diffs, commits, notes, pipelines or approvals",
    },
    get_pages_content: { app: null, class: "Read", summary: "Reads the content of a GitLab Pages address" },
    get_pipeline: { app: null, class: "Read", summary: "Reads a pipeline, and optionally its jobs and artifacts" },
    get_project: { app: null, class: "Read", summary: "Reads one project" },
    get_repository_file: { app: null, class: "Read", summary: "Reads one file of a repository" },
    get_saved_view_work_items: { app: null, class: "Read", summary: "Reads a saved view and its work items" },
    get_user: { app: null, class: "Read", summary: "Reads one user, or the signed-in user" },
    get_vulnerability: { app: null, class: "Read", summary: "Reads one vulnerability" },
    get_wiki_page: { app: null, class: "Read", summary: "Reads one wiki page" },
    get_work_item: { app: null, class: "Read", summary: "Reads one issue, epic, task or other work item" },
    get_work_item_types: { app: null, class: "Read", summary: "Lists the work item types of a group or project" },
    link_work_items: { app: null, class: "Write", summary: "Links a work item to others" },
    list_branches: { app: null, class: "Read", summary: "Lists the branches of a project" },
    list_commits: { app: null, class: "Read", summary: "Lists the commits of a project" },
    list_duo_agents_and_flows: {
      app: null,
      class: "Read",
      summary: "Lists the GitLab Duo agents and flows of a project",
    },
    list_duo_sessions: { app: null, class: "Read", summary: "Lists the user's GitLab Duo Agent Platform sessions" },
    list_groups: { app: null, class: "Read", summary: "Lists groups" },
    list_merge_requests: { app: null, class: "Read", summary: "Lists and searches merge requests" },
    list_milestones: { app: null, class: "Read", summary: "Lists the milestones of a project or group" },
    list_pipeline_schedules: { app: null, class: "Read", summary: "Lists the pipeline schedules of a project" },
    list_pipelines: { app: null, class: "Read", summary: "Lists the pipelines of a project" },
    list_project_members: { app: null, class: "Read", summary: "Lists the members of a project with their roles" },
    list_projects: { app: null, class: "Read", summary: "Lists the projects the user can reach" },
    list_releases: { app: null, class: "Read", summary: "Lists the releases of a project" },
    list_repository_tree: { app: null, class: "Read", summary: "Lists the files and directories of a repository path" },
    list_tags: { app: null, class: "Read", summary: "Lists the tags of a project" },
    list_todos: { app: null, class: "Read", summary: "Lists the user's to-do items" },
    list_user_events: { app: null, class: "Read", summary: "Lists a user's contribution events" },
    list_vulnerabilities: { app: null, class: "Read", summary: "Lists the vulnerabilities of a project" },
    list_wiki_pages: { app: null, class: "Read", summary: "Lists the wiki pages of a project or group" },
    list_work_item_saved_views: { app: null, class: "Read", summary: "Lists the saved views of work items" },
    list_work_items: {
      app: null,
      class: "Read",
      summary: "Lists and searches issues, epics, tasks and other work items",
    },
    save_merge_request: { app: null, class: "Write", summary: "Creates or changes a merge request" },
    save_merge_request_review: {
      app: null,
      class: "Write",
      summary: "Writes review artifacts on a merge request, such as comments, approvals or a submitted review",
    },
    save_note: {
      app: null,
      class: "Write",
      summary: "Adds a comment to a merge request or work item, replies to a thread, or resolves one",
    },
    save_pipeline: { app: null, class: "Write", summary: "Runs, retries, cancels or renames a pipeline" },
    save_pipeline_job: { app: null, class: "Write", summary: "Plays a manual job" },
    save_project: { app: null, class: "Write", summary: "Creates or changes a project" },
    save_vulnerability: { app: null, class: "Write", summary: "Changes a vulnerability, such as its state" },
    save_work_item: {
      app: null,
      class: "Write",
      summary: "Creates or changes an issue, task, epic or other work item",
    },
    search: { app: null, class: "Read", summary: "Searches the whole GitLab instance, a group or a project" },
    search_labels: { app: null, class: "Read", summary: "Searches the labels of a project or group" },
    semantic_search: { app: null, class: "Read", summary: "Searches a project's code by meaning" },
    send_duo_session_input: {
      app: null,
      class: "Write",
      summary: "Answers a GitLab Duo session, approving or rejecting its plan or tool call",
    },
    start_duo_session: {
      app: null,
      class: "Write",
      summary: "Starts a GitLab Duo Agent Platform session that works on a goal",
    },
  },
};
