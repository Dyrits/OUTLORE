import { type CatalogEntry, oauthSecretKind } from "../catalog.ts";

/**
 * Cloudflare: the official Cloudflare API MCP server at `mcp.cloudflare.com/mcp`, which replaces the deprecated per-product servers (`bindings.mcp.cloudflare.com`, `observability.mcp.cloudflare.com`).
 * Live-probed on 2026-11-25: returns HTTP 401 with RFC 9728 protected-resource metadata, RFC 8414 issuer `https://mcp.cloudflare.com`, PKCE `S256`, and RFC 7591 dynamic client registration at `https://mcp.cloudflare.com/register`.
 * No OAuth sign-in was completed during this build, so no live `tools/list` was read; the five tool names are read from `src/server.ts` and `src/tools/*.ts` of `cloudflare/mcp` at ad6cb102dbb875ce24cbafe761abf904f25d0d08 (Apache-2.0, read 2026-11-25) in its default Code Mode configuration.
 * `docs`, `search`, and `whoami` only read documentation, OpenAPI schemas, or the authenticated identity, so they are `Read`; `execute` runs arbitrary Cloudflare API calls and `submit_feedback` posts to Cloudflare, so both are `Write` and ask on every call.
 */
export const cloudflareEntry: CatalogEntry = {
  apps: [],
  backend: {
    _tag: "Http",
    header: "authorization",
    oauth: { clientName: "Outlore" },
    prefix: "Bearer ",
    shouldUseSession: true,
    url: "https://mcp.cloudflare.com/mcp",
  },
  description: "Search Cloudflare's API and documentation, inspect your account, and, after a question, run API calls.",
  id: "cloudflare",
  licence: "Apache-2.0",
  name: "Cloudflare",
  notice:
    "Cloudflare is a service run by another company. You sign in on Cloudflare's own page in your browser, and Outlore keeps the OAuth session in the Vault on this computer. Cloudflare sees every request a thread makes and returns data from your account, which goes to the model provider of the thread. Limit the permissions you grant during sign-in to what threads need; Outlore asks before every API execution.",
  platform: "Any",
  secretKind: oauthSecretKind,
  tools: {
    docs: { app: null, class: "Read", summary: "Searches Cloudflare documentation" },
    execute: {
      app: null,
      class: "Write",
      summary: "Runs JavaScript against the Cloudflare API using your signed-in account permissions",
    },
    search: {
      app: null,
      class: "Read",
      summary: "Searches the Cloudflare OpenAPI specification for endpoints and schemas",
    },
    submit_feedback: {
      app: null,
      class: "Write",
      summary: "Sends feedback about Cloudflare products or the MCP server to Cloudflare",
    },
    whoami: { app: null, class: "Read", summary: "Reads the Cloudflare user or account identity for this connection" },
  },
};
