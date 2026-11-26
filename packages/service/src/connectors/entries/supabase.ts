import { type CatalogEntry, oauthSecretKind } from "../catalog.ts";

/**
 * Supabase: the official remote MCP server at `mcp.supabase.com/mcp`, authenticated via generic MCP OAuth 2.1.
 * Live-probed on 2026-11-25: returns HTTP 401 with RFC 9728 protected-resource metadata, RFC 8414 issuer `https://api.supabase.com`, PKCE `S256`, and RFC 7591 dynamic client registration at `https://api.supabase.com/platform/oauth/apps/register`.
 * No OAuth sign-in was completed during this build, so no live `tools/list` was read; all 42 tool names are read from `packages/mcp-server-supabase/src/tools/*.ts` of `supabase-community/supabase-mcp` at 01f8021f4978ba71c978286ce4943a8dcfbdb5ff (Apache-2.0, read 2026-11-25).
 * Every tool is classified by exact name after reading what its handler does: `execute_sql`, `apply_migration`, `run_notebook`, `confirm_cost`, `create_edge_function_secret`, and all tools that create, update, deploy, pause, restore, rebase, reset, merge, or delete resources are `Write` and ask on every call; tools that only list, inspect, query logs, search docs, or read publishable keys are `Read`.
 */
export const supabaseEntry: CatalogEntry = {
  apps: [],
  backend: {
    _tag: "Http",
    header: "authorization",
    oauth: { clientName: "Outlore" },
    prefix: "Bearer ",
    shouldUseSession: true,
    url: "https://mcp.supabase.com/mcp",
  },
  description: "Inspect Supabase projects, schemas, logs and docs, and, after a question, run SQL or manage resources.",
  id: "supabase",
  licence: "Apache-2.0",
  name: "Supabase",
  notice:
    "Supabase is a service run by another company. You sign in on Supabase's own page in your browser, and Outlore keeps the OAuth session in the Vault on this computer. Supabase sees every request a thread makes and returns data from your projects, which goes to the model provider of the thread. Limit the organization or project scope you grant during sign-in; Outlore asks before every SQL execution, migration, or resource change.",
  platform: "Any",
  secretKind: oauthSecretKind,
  tools: {
    apply_migration: { app: null, class: "Write", summary: "Applies a SQL migration to a Supabase database" },
    confirm_cost: { app: null, class: "Write", summary: "Confirms the cost of creating a paid Supabase resource" },
    create_branch: { app: null, class: "Write", summary: "Creates a development branch for a Supabase project" },
    create_edge_function_secret: {
      app: null,
      class: "Write",
      summary: "Creates or updates a secret for Supabase Edge Functions",
    },
    create_notebook: { app: null, class: "Write", summary: "Creates a SQL notebook in a Supabase project" },
    create_project: { app: null, class: "Write", summary: "Creates a new Supabase project" },
    delete_branch: { app: null, class: "Write", summary: "Deletes a development branch of a Supabase project" },
    delete_feedback: { app: null, class: "Write", summary: "Deletes previously submitted Supabase MCP feedback" },
    delete_notebook: { app: null, class: "Write", summary: "Deletes a SQL notebook in a Supabase project" },
    deploy_edge_function: { app: null, class: "Write", summary: "Deploys a Supabase Edge Function" },
    execute_sql: { app: null, class: "Write", summary: "Runs a SQL statement against a Supabase database" },
    generate_typescript_types: {
      app: null,
      class: "Read",
      summary: "Generates TypeScript types from a project's database schema",
    },
    get_advisors: { app: null, class: "Read", summary: "Reads security and performance advisories for a project" },
    get_cost: { app: null, class: "Read", summary: "Reads the estimated cost of a new Supabase project or branch" },
    get_edge_function: { app: null, class: "Read", summary: "Reads the files of one Supabase Edge Function" },
    get_issues: { app: null, class: "Read", summary: "Reads detected issues for a Supabase project" },
    get_logs: { app: null, class: "Read", summary: "Reads recent service logs for a Supabase project" },
    get_notebook: { app: null, class: "Read", summary: "Reads one SQL notebook and its cells" },
    get_organization: { app: null, class: "Read", summary: "Reads details of a Supabase organization" },
    get_project: { app: null, class: "Read", summary: "Reads details of a Supabase project" },
    get_project_url: { app: null, class: "Read", summary: "Reads the API URL of a Supabase project" },
    get_publishable_keys: { app: null, class: "Read", summary: "Reads the public publishable API keys of a project" },
    get_storage_config: { app: null, class: "Read", summary: "Reads the storage configuration of a Supabase project" },
    list_branches: { app: null, class: "Read", summary: "Lists development branches of a Supabase project" },
    list_edge_functions: { app: null, class: "Read", summary: "Lists Edge Functions in a Supabase project" },
    list_extensions: { app: null, class: "Read", summary: "Lists Postgres extensions in a Supabase database" },
    list_migrations: { app: null, class: "Read", summary: "Lists applied migrations in a Supabase database" },
    list_notebooks: { app: null, class: "Read", summary: "Lists SQL notebooks in a Supabase project" },
    list_organizations: { app: null, class: "Read", summary: "Lists Supabase organizations you belong to" },
    list_projects: { app: null, class: "Read", summary: "Lists Supabase projects in your account" },
    list_storage_buckets: { app: null, class: "Read", summary: "Lists storage buckets in a Supabase project" },
    list_tables: { app: null, class: "Read", summary: "Lists database tables in a Supabase project" },
    merge_branch: { app: null, class: "Write", summary: "Merges a development branch into production" },
    pause_project: { app: null, class: "Write", summary: "Pauses a Supabase project" },
    query_logs: { app: null, class: "Read", summary: "Queries analytics logs for a Supabase project" },
    rebase_branch: { app: null, class: "Write", summary: "Rebases a development branch onto production" },
    reset_branch: { app: null, class: "Write", summary: "Resets a development branch's migrations" },
    restore_project: { app: null, class: "Write", summary: "Restores a paused Supabase project" },
    run_notebook: { app: null, class: "Write", summary: "Executes cells in a Supabase SQL notebook" },
    search_docs: { app: null, class: "Read", summary: "Searches official Supabase documentation" },
    submit_feedback: { app: null, class: "Write", summary: "Submits feedback about the Supabase MCP server" },
    update_storage_config: {
      app: null,
      class: "Write",
      summary: "Changes the storage configuration of a Supabase project",
    },
  },
};
