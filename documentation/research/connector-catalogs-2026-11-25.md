# External connector catalogs and vendor MCP servers (2026-11-25)

Primary-source survey of external MCP registries, editor/agent connector catalogs, aggregator hubs, and official vendor-run remote MCP servers, conducted on 2026-11-25 against Outlore's connector architecture (`packages/service/src/connectors/catalog.ts`, `catalogEntries.ts`, `documentation/capabilities/connectors/specifications.md`, and `blueprint.md`).
All repository facts come from pinned commits inspected via the GitHub API or raw source files on 2026-11-25.
All registry counts and endpoint authentication requirements come from live HTTP probes executed on 2026-11-25 (`curl` against registry APIs and vendor Streamable HTTP endpoints).
No production code was changed.

## Executive findings for Outlore

1. **Streamable HTTP remote MCP servers are now the ecosystem default.**
In a 10,000-entry latest-version slice of the Official MCP Registry (`https://registry.modelcontextprotocol.io/v0.1/servers?version=latest`, probed 2026-11-25), 9,023 entries (90.2%) are remote-only, 402 (4.0%) publish both remote and package deliveries, and 542 (5.4%) are package-only; 9,558 of 9,685 remote endpoints (98.7%) use `streamable-http` rather than legacy `sse`.
2. **Authentication splits cleanly into three tiers.**
Live unauthenticated `initialize` probes on 2026-11-25 against 25 major vendor remote MCP endpoints found 4 keyless HTTP 200 endpoints (Cloudflare Docs, Context7, Exa, Firecrawl), 9 major vendor endpoints that accept a static Bearer API key or Personal Access Token in an HTTP header today (GitHub, Linear, Stripe via Restricted Agent Key, PostHog, Neon, Datadog, GitLab, Tavily, plus Sentry via auth token), and 12+ major vendor endpoints that require browser OAuth 2.1 with RFC 9728 `/.well-known/oauth-protected-resource` discovery (Notion, Atlassian, Slack, Google Workspace, Microsoft 365, Figma, Asana, HubSpot, Cloudflare account servers, Supabase remote, Vercel, PayPal, Intercom, Box, Dropbox).
3. **Outlore's existing `Http` backend (`httpMcp.ts`) can ship a strong Wave 1 with zero OAuth changes.**
Outlore's current `CatalogBackend` (`_tag: "Http"`, static header from the Vault, `packages/service/src/connectors/catalog.ts:24-25`) immediately supports keyless servers (adding an optional-secret path) and static Bearer-header remote servers such as GitHub, Linear, PostHog, Neon, Stripe, Datadog, GitLab, Context7, Exa, Firecrawl, Tavily, and Cloudflare Docs.
4. **Adding one generic MCP OAuth 2.1 browser flow unlocks almost every remaining Tier-1 SaaS vendor.**
Every major OAuth-only vendor probed on 2026-11-25 returned a standard `WWW-Authenticate: Bearer ... resource_metadata="https://<host>/.well-known/oauth-protected-resource..."` challenge per the MCP authorization specification, meaning one reusable PKCE browser-redirect flow in Outlore (with tokens stored in the Vault) unlocks Notion, Atlassian, Slack, Figma, Asana, HubSpot, Supabase, Vercel, Cloudflare account services, PayPal, Intercom, Box, and Dropbox without connector-specific sign-in screens.
5. **Licensing splits sharply between vendored local servers and opt-in hosted services.**
Outlore's specification requires OSI-approved licences for components it ships (`documentation/capabilities/connectors/specifications.md:123`), while treating opt-in hosted third-party services like Composio as specification-judged remote endpoints (`blueprint.md:123`).
Several prominent MCP ecosystems use non-OSI source-available licences — notably Pipedream (`Pipedream Source Available License Version 1.0`, `PipedreamHQ/pipedream@f1d566cb/LICENSE`) and Sentry (`FSL-1.1-Apache-2.0`, `getsentry/toolkit@main/LICENSE.md`) — which should be flagged explicitly before adoption.

## Part 1: External catalogs and registries

### 1. Official MCP Registry (`registry.modelcontextprotocol.io`)

- **Source:** Live REST API `https://registry.modelcontextprotocol.io/v0.1/servers` (probed 2026-11-25) and repository `modelcontextprotocol/registry` at commit `0c74fa6fa58a40ab43f900c7c8a77a0cd0634a55` (committed 2026-11-24; transitioning MIT to Apache-2.0).
- **Model:** Unauthenticated, read-only metadata index storing `server.json` descriptors (schema `2025-12-11/server.schema.json`) verified by DNS reverse-domain or GitHub namespace ownership; it hosts no binaries.
- **Measured scale (probed 2026-11-25):** Paginating `GET /v0.1/servers?version=latest&limit=100` for 100 pages returned 10,000 distinct latest-version servers without exhausting the cursor.
Within that 10,000-server slice: 9,023 remote-only, 542 package-only, 402 both remote and package, and 33 metadata-only; remote transports are 9,558 `streamable-http` vs 127 `sse`; package registries are 715 `npm`, 138 `pypi`, 87 `mcpb` (MCP bundles), 31 `oci`, 14 `nuget`, and 11 `cargo`; 1,670 remote servers declare explicit HTTP headers while 7,755 declare none (OAuth 2.1 or keyless).
- **Verified official vendor namespaces found on 2026-11-25:** `app.linear/linear` (`v1.0.2`), `com.atlassian/atlassian-mcp-server` (`v2.0.0`), `com.stripe/mcp` (`v0.2.4`), `com.cloudflare.mcp/mcp` (`v1.0.0`, 15 domain endpoints), `com.figma.mcp/mcp` (`v1.0.3`), `com.supabase/mcp`, `com.posthog/mcp` (`v1.0.0`), `com.neon/mcp` (`v2.0.0`), `io.github.upstash/context7` (`v4.8.0`), `com.paypal.mcp/mcp` (`v1.0.0`), `com.gitlab/mcp` (`v0.0.1`), and `ai.exa/exa` (`v3.5.1`).
- **Reuse for Outlore:** Useful as a machine-readable discovery and version-pinning feed during catalog curation, but not safe to expose unfiltered because any GitHub user or domain owner can publish unvetted servers and the registry does not classify tool Read/Write behavior.

### 2. Anthropic Claude Connectors Directory and `modelcontextprotocol/servers`

- **Claude Connectors Directory:** Hosted at `https://claude.ai/directory` / `https://claude.com/connectors` (checked 2026-11-25).
Every connector in the directory is a remote MCP server (Streamable HTTP with OAuth 2.0/2.1 browser consent), organized into verified partner integrations (Google Drive, Gmail, Google Calendar, Slack, Notion, GitHub, Linear, Asana, Atlassian, Figma, Sentry, Stripe, Cloudflare, HubSpot, Intercom, PayPal, Box, Context7, etc.) and reviewed third-party remote servers.
Submissions require MCP tool annotations (`readOnlyHint`, `destructiveHint`), which Outlore explicitly ignores in favor of its own catalog classification (`packages/service/src/connectors/catalog.ts:1-2`).
- **Official MCP Reference Servers (`modelcontextprotocol/servers`):** Inspected at commit `c799c8552b0f27b7a33a7b9233773da144dddcf5` (2026-11-18; 92,238 stars; `LICENSE` states transition from MIT to Apache-2.0, both OSI-approved).
The repository warns that its servers are reference implementations rather than production SaaS connectors and now houses exactly 7 active servers under `src/`:
  - `everything` (test/demo server; npm `@modelcontextprotocol/server-everything`; stdio; no auth).
  - `fetch` (web page fetching to Markdown; Python `mcp-server-fetch` via `uvx`; stdio; no auth; 1 tool: `fetch`; read-only).
  - `filesystem` (local directory access; npm `@modelcontextprotocol/server-filesystem`; stdio; no auth; redundant with Outlore's harness file tools).
  - `git` (local Git repo operations; Python `mcp-server-git` via `uvx`; stdio; no auth; redundant with harness shell tools).
  - `memory` (local knowledge graph; npm `@modelcontextprotocol/server-memory`; stdio; no auth; 9 graph tools).
  - `sequentialthinking` (structured reasoning scratchpad; npm `@modelcontextprotocol/server-sequential-thinking`; stdio; no auth; 1 tool: `sequentialthinking`; read-only).
  - `time` (timezone conversion; Python `mcp-server-time` via `uvx`; stdio; no auth; 2–3 read-only tools: `get_current_time`, `convert_time`).
Thirteen earlier vendor servers (Brave Search, GitHub, GitLab, Google Drive, Google Maps, PostgreSQL, Puppeteer, Redis, Sentry, Slack, SQLite, AWS KB Retrieval, EverArt) were moved to `modelcontextprotocol/servers-archived` in favor of official vendor servers.

### 3. Goose Extensions (`aaif-goose/goose`, formerly `block/goose`)

- **Source:** `github.com/block/goose` now redirects permanently to `aaif-goose/goose`, inspected at commit `8256b9ac9ffae7d19ef1db1f57e37f84c44915bd` (2026-11-25; Apache-2.0; 56,973 stars).
- **Built-in native extensions (`crates/goose-mcp/src/`):** `autovisualiser`, `computercontroller`, `memory`, `peekaboo`, `tutorial` (plus core `developer`, `code_mode`, `summon`, `top_of_mind` listed in `servers.json`).
- **Extension directory (`documentation/static/servers.json`, fetched 2026-11-25):** 57 total entries — 8 built-in native extensions, 38 stdio packages (`npx` / `uvx`), and 11 `streamable-http` remote endpoints (including GitHub `https://api.githubcopilot.com/mcp/`, Neon `https://mcp.neon.tech/mcp`, Supabase `https://mcp.supabase.com/mcp`, Excalidraw `https://excalidraw-mcp-app.vercel.app/mcp`, Figma desktop `http://127.0.0.1:3845/mcp`, Glif, Square Neighborhood).
Nineteen entries declare required environment variables (API keys/secrets) and 38 declare none.
- **Reuse for Outlore:** Small curated list; Goose's stdio env-var declaration pattern (`environmentVariables: [{ name, description, required }]`) is a clean reference if Outlore adds Vault-to-env injection for stdio connectors.

### 4. Zed MCP Extensions (`zed-industries/extensions`)

- **Source:** `github.com/zed-industries/extensions` at commit `ef7fee47d2ce636f65f21ae178f81783c887508f` (2026-11-23; 1,984 stars).
- **Measured inventory (`extensions.toml`, parsed 2026-11-25):** 1,612 total editor extensions, of which 69 are named MCP / context-server extensions (`*-mcp`, `mcp-server-*`, `*-context-server`).
- **Delivery and auth:** Zed extensions wrap stdio npm/uvx/Rust binaries or remote proxies as Rust WASM shims (`context_servers` in `extension.toml`) that read API keys from Zed's `settings.json`.
Notable services covered include GitHub, GitLab, Notion, Slack, Figma, Sentry, Supabase, Postgres, MySQL, Prisma, PlanetScale, Datadog, Grafana, Kubernetes, Terraform, Cloudflare/DigitalOcean/Azure, Brave Search, Exa, Tavily, Firecrawl, Context7, Playwright, Chrome DevTools, Postman, Resend, Shopify Dev, Shortcut, SonarQube, and Webflow.
- **Reuse for Outlore:** Not directly reusable (WASM extension wrapper around Zed's API), and mostly community-maintained wrappers around upstream servers; useful as a demand signal for developer-focused services.

### 5. Cline MCP Marketplace (`cline/mcp-marketplace` and `api.cline.bot`)

- **Source:** Submission repo `github.com/cline/mcp-marketplace` at commit `87390ab75e299afefc031b1fe2c03e26dc32b7da` (2025-06-24; MIT; 800 stars) and live marketplace API `https://api.cline.bot/v1/mcp/marketplace` (probed 2026-11-25, actively synced as of 2026-11-23).
- **Measured inventory (2026-11-25):** 199 curated servers across 27 categories — largest are `developer-tools` (41), `databases` (26), `cloud-platforms` (20), `knowledge-memory` (16), `search` (14), `monitoring` (9), `image-video-processing` (9), `browser-automation` (9), `finance` (8), and `communication` (6).
- **Delivery and auth:** Entries point to GitHub repositories (`githubUrl`) with `requiresApiKey` metadata and install instructions that Cline executes locally (typically `npx` / `uvx` stdio or remote proxy).
- **Reuse for Outlore:** Good curated developer-tool index, but entries are mostly stdio GitHub repos without standardized remote URLs or verified tool classifications.

### 6. Docker MCP Catalog (`docker/mcp-registry`)

- **Source:** `github.com/docker/mcp-registry` at commit `7acac061940d9b3d6bbfc7dd26b1e9c2ee17b15c` (2026-11-19; MIT; 589 stars).
- **Measured inventory (tarball parsed 2026-11-25):** 327 `servers/<name>/server.yaml` definitions across devops (120), productivity (37), database (26), ai (22), search (16), monitoring (14), security (7), communication (7), documentation (6), finance (5), analytics (5), and payments (4).
- **Delivery breakdown:** 247 `type: server` (OCI Docker containers run over stdio via Docker MCP Toolkit with explicit `allowHosts` egress rules), 77 `type: remote` (hosted `streamable-http` or `sse` endpoints), and 3 other.
- **Auth breakdown:** 167 declare `config.secrets` (API keys/tokens injected as env vars), 41 declare `oauth:` (managed via Docker Desktop OAuth), 1 declares both, and 118 require no authentication.
- **Reuse for Outlore:** High-value reference for pinned source commits (`source.project` + `source.commit`) and remote endpoint metadata (including 15 Cloudflare endpoints, Atlassian, Asana, CircleCI, Linear, Apify, Brightdata, Close), though requiring Docker Desktop as a runtime would add a heavy host dependency for Outlore.

### 7. Smithery (`smithery.ai` / `registry.smithery.ai`)

- **Source:** Live API `https://registry.smithery.ai/servers` (probed 2026-11-25).
- **Measured scale (2026-11-25):** 20,739 total listed servers, of which 192 are `is:verified`, 15,383 are `is:remote`, and 16,911 are `is:deployed`.
- **Delivery and auth:** Smithery acts as a managed hosting proxy (`https://server.smithery.ai/<qualifiedName>/mcp`) over Streamable HTTP with Smithery-managed OAuth/API-key proxying and optional BYO API keys.
- **Reuse for Outlore:** Not recommended as an upstream runtime dependency because routing through Smithery's third-party proxy introduces an extra intermediary (similar to Composio's trust boundary, without Composio's single-connector advantage) and mixed community quality outside the 192 verified servers.

### 8. Aggregator hubs: Pipedream and Composio

- **Composio (`ComposioHQ/composio`, MIT):** Already integrated in Outlore (`composioEntry`, `packages/service/src/connectors/catalogEntries.ts:14-63`) and documented in `documentation/research/composio-mcp-2026-11-19.md`.
Primary docs (`https://docs.composio.dev`, `ComposioHQ/composio` README, checked 2026-11-25) advertise 1,000–1,800+ pre-authenticated toolkits reachable through the single `https://connect.composio.dev/mcp` endpoint (`x-consumer-api-key` header, 7 meta-tools, OAuth sign-ins handled on Composio's own page).
Note: Live probe of `https://connect.composio.dev/mcp` on 2026-11-25 returned `HTTP/2 401` with `WWW-Authenticate: Bearer ... resource_metadata="https://connect.composio.dev/.well-known/oauth-protected-resource"`, confirming it also supports OAuth discovery alongside the `x-consumer-api-key` header.
- **Pipedream (`https://mcp.pipedream.com`, `https://remote.mcp.pipedream.net/v3`, `PipedreamHQ/pipedream@f1d566cb`):** Offers 3,000+ integrated apps and 10,000+ tools over Streamable HTTP with Pipedream-managed OAuth (or developer Client ID/Secret minting Bearer tokens + `x-pd-project-id`, `x-pd-environment`, `x-pd-external-user-id`, `x-pd-app-slug` headers).
Unlike Composio's MIT SDK, `PipedreamHQ/pipedream/LICENSE` (read 2026-11-25) is the **Pipedream Source Available License Version 1.0**, which forbids commercial competing use and is **not OSI-approved**.
Because Outlore already ships Composio for long-tail SaaS aggregation under MIT, adding Pipedream is redundant unless a specific app is absent from Composio.

## Part 2: GitHub's official MCP server and vendor-run remote MCP servers

### GitHub Official MCP Server (`github/github-mcp-server`)

- **Source:** `github.com/github/github-mcp-server` at commit `c6b62954c062b3ad779f4e208716e09cb4a723e0` (2026-11-24; **MIT**; 34,738 stars), `README.md`, and `docs/remote-server.md`.
- **Delivery:** Official remote Streamable HTTP endpoint `https://api.githubcopilot.com/mcp/` (also available as a local Go binary or OCI image `ghcr.io/github/github-mcp-server` over stdio).
- **Authentication:** Supports **both** browser OAuth 2.1 (live probe 2026-11-25 returned `HTTP/2 401` with `resource_metadata="https://api.githubcopilot.com/.well-known/oauth-protected-resource/mcp/"`) **and** a static GitHub Personal Access Token sent via `Authorization: Bearer <PAT>` (`README.md`, "Using a GitHub PAT").
This means GitHub works **immediately** with Outlore's existing Vault + `Http` backend with zero OAuth work (note: Outlore's `httpMcp.ts` must format `Bearer <secret>` or store the header value).
- **Toolsets and Read-Only Mode:** 26 remote toolsets (`default`, `all`, `actions`, `code_quality`, `code_security`, `copilot`, `copilot_automations`, `copilot_issue_intents`, `dependabot`, `discussions`, `gists`, `git`, `governance`, `issues`, `labels`, `notifications`, `orgs`, `projects`, `pull_requests`, `repos`, `secret_protection`, `security_advisories`, `stargazers`, `users`, `copilot_spaces`, `github_support_docs_search`), selectable via URL path `/x/{toolset}` or `X-MCP-Toolsets` header.
Native read-only mode via URL suffix `/readonly` (`https://api.githubcopilot.com/mcp/readonly`) or header `X-MCP-Readonly: true` (and `GITHUB_READ_ONLY=1` locally), plus `X-MCP-Lockdown: true` to hide untrusted public issue bodies.

### Live HTTP probe results across 25 vendor remote MCP endpoints (2026-11-25)

Each endpoint was sent an unauthenticated Streamable HTTP `POST` `initialize` request (`protocolVersion: 2025-03-26`, `Accept: application/json, text/event-stream`) on 2026-11-25; keyless HTTP 200 endpoints were then sent `tools/list`.

| Service | Endpoint URL | HTTP status | `WWW-Authenticate` / Auth discovery | Static API key / PAT header supported? |
| --- | --- | --- | --- | --- |
| Cloudflare Docs | `https://docs.mcp.cloudflare.com/mcp` | `200` (`text/event-stream`) | None (keyless; 2 tools listed) | Not needed (keyless) |
| Context7 | `https://mcp.context7.com/mcp` | `200` (`text/event-stream`) | None (keyless; 2 tools listed) | Optional (`CONTEXT7_API_KEY`) |
| Exa | `https://mcp.exa.ai/mcp` | `200` (`text/event-stream`) | None (keyless; 2 tools listed) | Optional (API key for extra tools) |
| Firecrawl | `https://mcp.firecrawl.dev/mcp` | `200` (`text/event-stream`) | None on `tools/list` (3 tools listed) | Yes (`Authorization: Bearer` / API key) |
| GitHub | `https://api.githubcopilot.com/mcp/` | `401` | Bearer + `resource_metadata` (OAuth 2.1) | **Yes** (`Authorization: Bearer <PAT>`) |
| Linear | `https://mcp.linear.app/mcp` | `401` | Bearer `realm="OAuth"`, `scope="read write"` + `resource_metadata` | **Yes** (`Authorization: Bearer lin_api_...`) |
| Stripe | `https://mcp.stripe.com` | `401` | Bearer + `resource_metadata` | **Yes** (`Authorization: Bearer rk_...` Agent API Key) |
| PostHog | `https://mcp.posthog.com/mcp` | `401` | Bearer + `resource_metadata` | **Yes** (`Authorization: Bearer <personal_api_key>`) |
| Neon | `https://mcp.neon.tech/mcp` | `401` | Bearer + `resource_metadata` | **Yes** (`Authorization: Bearer <neon_api_key>`) |
| Sentry | `https://mcp.sentry.dev/mcp` | `401` | Bearer `realm="OAuth"` + `resource_metadata` | **Yes** (`Authorization: Bearer <auth_token>`) |
| GitLab | `https://gitlab.com/api/v4/mcp` | `401` | Bearer `realm="GitLab"`, `scope="mcp"` + `resource_metadata` | **Yes** (PAT / OAuth token) |
| Tavily | `https://mcp.tavily.com/mcp/` | `401` | Bearer + `resource_metadata` | **Yes** (API key via header/URL or stdio `TAVILY_API_KEY`) |
| Notion | `https://mcp.notion.com/mcp` | `401` | Bearer `realm="OAuth"` + `resource_metadata` | No (OAuth-only; MIT local repo deprecated) |
| Atlassian | `https://mcp.atlassian.com/v1/mcp` (`/v2/mcp`) | `401` | Bearer `realm="OAuth"` | OAuth 2.1 primary (API token in v2/enterprise setups) |
| Cloudflare Platform (15+ servers) | `https://bindings.mcp.cloudflare.com/mcp` (etc.) | `401` | Bearer `realm="OAuth"` + `resource_metadata` | OAuth 2.1 primary (API token via local/custom setups) |
| Slack | `https://mcp.slack.com/mcp` | `401` | Bearer + `resource_metadata` | No (confidential OAuth 2.1 with pre-registered Slack App) |
| Figma | `https://mcp.figma.com/mcp` | `401` | Bearer `scope="mcp:connect"` + `resource_metadata` | No on remote (OAuth 2.1); local desktop HTTP at `127.0.0.1:3845/mcp` |
| Asana | `https://mcp.asana.com/v2/mcp` | `401` | Bearer `realm="Asana MCP"` + `resource_metadata` | No (OAuth 2.0 with pre-registered MCP App) |
| HubSpot | `https://mcp.hubspot.com` | `401` | Bearer + `resource_metadata` | No (OAuth 2.1 PKCE with refresh rotation) |
| Supabase | `https://mcp.supabase.com/mcp` | `401` | Bearer + `resource_metadata` | OAuth on remote; PAT via stdio `@supabase/mcp-server-supabase` |
| Vercel | `https://mcp.vercel.com` | `401` | Bearer + `resource_metadata` | OAuth 2.1 / `vercel mcp` interactive auth |
| PayPal | `https://mcp.paypal.com/mcp` | `401` | Bearer `realm="OAuth"` + `resource_metadata` | OAuth 2.1 |
| Intercom | `https://mcp.intercom.com/mcp` | `401` | Bearer `realm="OAuth"`, `scope="mcp operator"` + `resource_metadata` | OAuth 2.1 |
| Box | `https://mcp.box.com/` | `401` | Bearer `realm="Service"` + `resource_metadata` | OAuth 2.1 |
| Composio | `https://connect.composio.dev/mcp` | `401` | Bearer + `resource_metadata` | **Yes** (`x-consumer-api-key` header) |

## Part 3: Master inventory of connectors found

Every entry below records service name, category, delivery, authentication, licence, maintainer, tool count (where stated in primary sources), and read-only mode.
Hosted-only vendor servers whose server code is not published are marked `Proprietary (hosted service)` for licence; per Outlore's blueprint (`blueprint.md:123`), opt-in hosted services are judged in the specification rather than vendored.

| Service | Category | Delivery | Authentication | Licence | Maintainer | Tool count | Read-only mode |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GitHub | Code & DevOps | Remote Streamable HTTP (`https://api.githubcopilot.com/mcp/`) or stdio Go/OCI (`github/github-mcp-server`) | API key (`Bearer <PAT>`) or OAuth 2.1 | MIT | Official vendor | 26 toolsets (100+ tools across all toolsets) | Yes (`/readonly` URL, `X-MCP-Readonly: true`, `--read-only`) |
| Linear | Issue tracking | Remote Streamable HTTP (`https://mcp.linear.app/mcp`) | API key (`Bearer lin_api_...`) or OAuth 2.1 | Proprietary (hosted service) | Official vendor | Not stated | Yes (`https://mcp.linear.app/mcp/readonly` or read OAuth scope) |
| Context7 (Upstash) | Developer docs | Remote Streamable HTTP (`https://mcp.context7.com/mcp`) or stdio npm (`@upstash/context7-mcp`) | None (optional `CONTEXT7_API_KEY`) | MIT | Official vendor | 2 (`resolve-library-id`, `query-docs`) | Inherently read-only |
| Cloudflare Docs | Developer docs | Remote Streamable HTTP (`https://docs.mcp.cloudflare.com/mcp`) | None (keyless) | Apache-2.0 (`cloudflare/mcp-server-cloudflare`) | Official vendor | 2 (`search_cloudflare_documentation`, `migrate_pages_to_workers_guide`) | Inherently read-only |
| Exa | Web search | Remote Streamable HTTP (`https://mcp.exa.ai/mcp`) or stdio npm (`exa-mcp-server`) | None for default 2 tools (optional API key) | MIT (`exa-labs/exa-mcp-server`) | Official vendor | 2 default (`web_search_exa`, `web_fetch_exa`), more with key | Inherently read-only |
| Firecrawl | Web scraping & search | Remote Streamable HTTP (`https://mcp.firecrawl.dev/mcp`) or stdio npm (`firecrawl-mcp`) | API key (3 tools listed keyless on probe) | MIT (`firecrawl/firecrawl-mcp-server`) | Official vendor | 3 default (`firecrawl_scrape`, `firecrawl_search`, `firecrawl_parse`), more with key | Inherently read-only (web fetch/parse) |
| PostHog | Product analytics | Remote Streamable HTTP (`https://mcp.posthog.com/mcp`) | API key (`Bearer <personal_api_key>`) or OAuth 2.1 | MIT (`PostHog/posthog`) | Official vendor | Not stated | Yes (`?readonly=true`) |
| Neon | Database (Postgres) | Remote Streamable HTTP (`https://mcp.neon.tech/mcp`) or stdio npm (`@neondatabase/mcp-server-neon`) | API key (`Bearer <neon_api_key>`) or OAuth 2.1 | MIT (`neondatabase/mcp-server-neon`) | Official vendor | Not stated | Yes (`?readonly=true`) |
| Stripe | Payments & billing | Remote Streamable HTTP (`https://mcp.stripe.com`) or stdio npm (`@stripe/mcp`) | Restricted Agent API key (`Bearer rk_...`) or OAuth 2.1 | MIT (`stripe/ai`) | Official vendor | Not stated (`--tools=all` / configurable) | Yes (read-only restricted key scopes) |
| Datadog | Observability | Remote Streamable HTTP (`https://mcp.datadoghq.com/v1/mcp`) | PAT/SAT (`Bearer <token>`) or OAuth | Proprietary (hosted service) | Official vendor | Not stated | Yes (token/scope restricted) |
| GitLab | Code & DevOps | Remote Streamable HTTP (`https://gitlab.com/api/v4/mcp`) or stdio | PAT (`GITLAB_PERSONAL_ACCESS_TOKEN`) or OAuth 2.1 | MIT (CE) / Proprietary (EE) | Official vendor | Not stated | Yes (read-only PAT scope) |
| Tavily | Web search | Remote Streamable HTTP (`https://mcp.tavily.com/mcp/`) or stdio npm (`tavily-mcp`) | API key (`TAVILY_API_KEY`) or OAuth | MIT (`tavily-ai/tavily-mcp`) | Official vendor | 4 (`search`, `extract`, `map`, `crawl`) | Inherently read-only |
| Brave Search | Web search | Stdio npm (`@brave/brave-search-mcp-server`) or local HTTP | API key (`BRAVE_API_KEY`) | MIT (`brave/brave-search-mcp-server`) | Official vendor | 6+ (web, local, image, video, news, answers) | Inherently read-only |
| Sentry | Error tracking | Remote Streamable HTTP (`https://mcp.sentry.dev/mcp`) or stdio (`getsentry/toolkit`) | Auth token (`Bearer`) or OAuth 2.1 | FSL-1.1-Apache-2.0 (source-available, not OSI yet) | Official vendor | Not stated | Token-scope dependent |
| Supabase | Database & BaaS | Remote Streamable HTTP (`https://mcp.supabase.com/mcp`) or stdio npm (`@supabase/mcp-server-supabase`) | OAuth 2.1 (remote) or PAT (`--access-token`, stdio) | Apache-2.0 (`supabase/mcp`) | Official vendor | 20+ | Yes (`--read-only` / `read_only=true`) |
| Notion | Knowledge base | Remote Streamable HTTP (`https://mcp.notion.com/mcp`) (MIT local repo deprecated) | OAuth 2.1 (browser sign-in) | Proprietary (hosted); deprecated local is MIT | Official vendor | Not stated | No server flag (user-permission scoped) |
| Atlassian (Jira & Confluence) | Issue tracking & wiki | Remote Streamable HTTP (`https://mcp.atlassian.com/v2/mcp`) | OAuth 2.1 (browser sign-in) | Proprietary (hosted service) | Official vendor | Not stated | Scope-restricted |
| Slack | Team messaging | Remote Streamable HTTP (`https://mcp.slack.com/mcp`) | Confidential OAuth 2.1 (requires Slack App) | Proprietary (hosted service) | Official vendor | Not stated | Yes (read-only OAuth user scopes) |
| Cloudflare Platform (15+ servers) | Cloud & infrastructure | Remote Streamable HTTP (`https://<service>.mcp.cloudflare.com/mcp`) | OAuth 2.1 (browser sign-in) | Apache-2.0 (`cloudflare/mcp-server-cloudflare`) | Official vendor | Varies per domain server | Read-only servers exist (Radar, Audit Logs, DNS Analytics, Observability, Blog) |
| Figma | Design | Remote Streamable HTTP (`https://mcp.figma.com/mcp`) or local desktop HTTP (`http://127.0.0.1:3845/mcp`) | OAuth 2.1 (remote) or local desktop session | Proprietary (hosted/desktop) | Official vendor | Not stated | Read-only extraction default; org-governed writes |
| Vercel | Cloud & deployment | Remote Streamable HTTP (`https://mcp.vercel.com`) | OAuth 2.1 / interactive CLI auth | Proprietary (hosted service) | Official vendor | Not stated | Read-only deployment/log/project tools |
| Asana | Project management | Remote Streamable HTTP (`https://mcp.asana.com/v2/mcp`) | OAuth 2.0 (requires pre-registered MCP App) | Proprietary (hosted service) | Official vendor | Not stated | User-permission scoped |
| HubSpot | CRM | Remote Streamable HTTP (`https://mcp.hubspot.com`) | OAuth 2.1 PKCE (browser sign-in) | Proprietary (hosted service) | Official vendor | Not stated | Yes (read-only CRM scopes) |
| Google Workspace (Gmail, Drive, Calendar, Chat, People) | Productivity suite | Remote Streamable HTTP (`https://<svc>mcp.googleapis.com/mcp/v1`) or community stdio (`taylorwilsdon/google_workspace_mcp`) | OAuth 2.0 user context (requires Google Cloud OAuth Client ID) | Proprietary (hosted); community stdio is MIT | Official vendor (remote) / Community (stdio) | Modular per product | Yes (read-only OAuth scopes) |
| Microsoft 365 (Work IQ) | Productivity suite | Remote Streamable HTTP (`https://mcp.svc.cloud.microsoft/enterprise`) | Microsoft Entra ID SSO / OAuth 2.0 PKCE | Proprietary (hosted service) | Official vendor | Enterprise-scoped | User-permission scoped |
| PayPal | Payments | Remote Streamable HTTP (`https://mcp.paypal.com/mcp`) | OAuth 2.1 (browser sign-in) | Proprietary (hosted service) | Official vendor | Not stated | Scope-restricted |
| Intercom | Customer support | Remote Streamable HTTP (`https://mcp.intercom.com/mcp`) | OAuth 2.1 (`scope="mcp operator"`) | Proprietary (hosted service) | Official vendor | Not stated | Scope-restricted |
| Box | Cloud storage | Remote Streamable HTTP (`https://mcp.box.com/`) | OAuth 2.1 (browser sign-in) | Proprietary (hosted); archived community repo is MIT | Official vendor | Not stated | Scope-restricted |
| Dropbox | Cloud storage | Remote Streamable HTTP (`https://mcp.dropbox.com/mcp`) | OAuth 2.0 (browser sign-in) | Proprietary (hosted service) | Official vendor | Not stated | Scope-restricted |
| Playwright | Browser automation | Local stdio npm (`@playwright/mcp`) | None (local browser) | Apache-2.0 (`microsoft/playwright-mcp`) | Official vendor | 20+ | No (interactive browser) |
| Chrome DevTools | Browser debugging | Local stdio npm (`chrome-devtools-mcp`) | None (local Chrome debugging) | Apache-2.0 (`ChromeDevTools/chrome-devtools-mcp`) | Official vendor | 20+ | Partial (inspection vs DOM/network action) |
| MCP Fetch | Web fetch | Local stdio Python (`uvx mcp-server-fetch`) | None | MIT / Apache-2.0 (`modelcontextprotocol/servers`) | Official MCP | 1 (`fetch`) | Inherently read-only |
| MCP Memory | Local knowledge graph | Local stdio npm (`@modelcontextprotocol/server-memory`) | None | MIT / Apache-2.0 (`modelcontextprotocol/servers`) | Official MCP | 9 | No (reads & writes local JSON graph) |
| MCP Time | Utilities | Local stdio Python (`uvx mcp-server-time`) | None | MIT / Apache-2.0 (`modelcontextprotocol/servers`) | Official MCP | 2–3 | Inherently read-only |
| MCP Sequential Thinking | Reasoning utility | Local stdio npm (`@modelcontextprotocol/server-sequential-thinking`) | None | MIT / Apache-2.0 (`modelcontextprotocol/servers`) | Official MCP | 1 (`sequentialthinking`) | Inherently read-only |
| Composio (already in Outlore) | SaaS aggregator (1,000–1,800+ apps) | Remote Streamable HTTP (`https://connect.composio.dev/mcp`) | API key (`x-consumer-api-key`) or OAuth | MIT (SDK) / hosted service | Official vendor | 7 meta-tools | 2 discovery Read, 5 Write |
| Pipedream | SaaS aggregator (3,000+ apps) | Remote Streamable HTTP (`https://remote.mcp.pipedream.net/v3`) | OAuth or Client Credentials Bearer + headers | Pipedream Source Available v1.0 (**not OSI**) | Official vendor | 10,000+ across 3,000+ apps | Per-action |

## Part 4: Ranked shortlist of the 30 most valuable connectors for Outlore

Ranking weighs (a) immediate compatibility with Outlore's constraints (no connector-specific sign-in screens today, Vault-held secrets never reaching the model, exact-name Read/Write tool classification, OSI-approved licences preferred), (b) official vendor maintenance, and (c) daily developer and knowledge-worker value.

### Tier 1 — Immediate fit today (keyless or static API key/PAT over Streamable HTTP, or zero-auth vendored stdio)

| Rank | Service | Delivery & endpoint / package | Auth (today) | Licence | Why it ranks here |
| --- | --- | --- | --- | --- | --- |
| 1 | **GitHub** | Remote HTTP `https://api.githubcopilot.com/mcp/` | PAT (`Bearer`) | MIT | Highest developer value; official remote server; static PAT works with Vault today; native `/readonly` and toolsets for clean Read/Write classification. |
| 2 | **Linear** | Remote HTTP `https://mcp.linear.app/mcp` | API key (`Bearer lin_api_...`) | Proprietary (hosted) | Premier issue tracker; accepts static API key in header; native `/mcp/readonly` endpoint; crisp issue/project tools. |
| 3 | **Context7 (Upstash)** | Remote HTTP `https://mcp.context7.com/mcp` | None (optional API key) | MIT | Zero-config keyless HTTP 200; 2 pure Read tools (`resolve-library-id`, `query-docs`); huge coding-agent value with zero write risk. |
| 4 | **Cloudflare Docs** | Remote HTTP `https://docs.mcp.cloudflare.com/mcp` | None (keyless) | Apache-2.0 | Zero-config keyless HTTP 200; 2 pure Read tools; official Apache-2.0 server. |
| 5 | **Exa** | Remote HTTP `https://mcp.exa.ai/mcp` | None (optional API key) | MIT | High-signal web search and fetching; works keyless HTTP 200 out of the box with 2 pure Read tools (`web_search_exa`, `web_fetch_exa`). |
| 6 | **Firecrawl** | Remote HTTP `https://mcp.firecrawl.dev/mcp` | API key (`Bearer`) | MIT | Clean Markdown web scraping/search/parsing; official MIT server; all core tools are Read. |
| 7 | **PostHog** | Remote HTTP `https://mcp.posthog.com/mcp` | Personal API key (`Bearer`) | MIT | Official product analytics/feature flags; static Personal API key works today; native `?readonly=true` mode. |
| 8 | **Neon** | Remote HTTP `https://mcp.neon.tech/mcp` | Neon API key (`Bearer`) | MIT | Official serverless Postgres management; static API key works today; native `?readonly=true` mode. |
| 9 | **Stripe** | Remote HTTP `https://mcp.stripe.com` | Restricted Agent API key (`Bearer rk_...`) | MIT | Official payments/billing; Restricted Agent Key works with Vault today and enforces Stripe-side approval for sensitive writes. |
| 10 | **GitLab** | Remote HTTP `https://gitlab.com/api/v4/mcp` | PAT (`Bearer`) | MIT (CE) | Official GitLab issues/MRs/pipelines; PAT works today; read-only PAT scope supported. |
| 11 | **Datadog** | Remote HTTP `https://mcp.datadoghq.com/v1/mcp` | PAT/SAT (`Bearer`) | Proprietary (hosted) | Official logs/metrics/traces/incidents; Bearer token works today; high incident-response value. |
| 12 | **Tavily** | Remote HTTP `https://mcp.tavily.com/mcp/` | API key | MIT | Official AI-oriented web search/extract/map/crawl; 4 clean Read tools. |
| 13 | **Playwright** | Local stdio npm `@playwright/mcp` | None | Apache-2.0 | Official Microsoft browser automation; zero secrets; vendored stdio fits Outlore's `stdioMcp.ts` pattern. |
| 14 | **Chrome DevTools** | Local stdio npm `chrome-devtools-mcp` | None | Apache-2.0 | Official Google browser debugging/profiling/network inspection; zero secrets; vendored stdio. |
| 15 | **Brave Search** | Local stdio npm `@brave/brave-search-mcp-server` | API key (`BRAVE_API_KEY`) | MIT | Official privacy-focused search; pure Read tools; needs Vault-to-env injection on `stdioMcp.ts` (one small extension). |
| 16 | **Supabase (stdio PAT)** | Local stdio npm `@supabase/mcp-server-supabase` | PAT (`--access-token`) | Apache-2.0 | Official Postgres/Auth/Storage management with `--read-only` flag; works via PAT before OAuth is added (remote requires OAuth). |
| 17 | **MCP Fetch** | Local stdio `mcp-server-fetch` (or Node port) | None | MIT / Apache-2.0 | Simple 1-tool (`fetch`) Read web fetcher with zero credentials. |
| 18 | **Sentry** | Remote HTTP `https://mcp.sentry.dev/mcp` | Auth token (`Bearer`) | FSL-1.1-Apache-2.0 | High debugging value and accepts Bearer auth token, ranked lower only because its licence is FSL-1.1 rather than OSI-approved. |

### Tier 2 — High-value vendor servers unlocked by adding one generic MCP OAuth 2.1 browser flow

All 12 services below are official vendor-hosted Streamable HTTP servers that advertise standard RFC 9728 `/.well-known/oauth-protected-resource` discovery (or Google/Microsoft OAuth 2.0), so one shared browser-redirect OAuth flow in Outlore unlocks them all without per-connector login screens.

| Rank | Service | Delivery & endpoint | Auth | Licence | Why it ranks here |
| --- | --- | --- | --- | --- | --- |
| 19 | **Notion** | Remote HTTP `https://mcp.notion.com/mcp` | OAuth 2.1 | Proprietary (hosted) | Top knowledge-base request; official remote server replaces deprecated MIT local server and delivers semantic search + Markdown pages. |
| 20 | **Atlassian (Jira & Confluence)** | Remote HTTP `https://mcp.atlassian.com/v2/mcp` | OAuth 2.1 | Proprietary (hosted) | Essential enterprise issue tracker and wiki; single endpoint covers Jira and Confluence. |
| 21 | **Slack** | Remote HTTP `https://mcp.slack.com/mcp` | OAuth 2.1 (Slack App) | Proprietary (hosted) | Core team communication; granular read-only scopes available, though requires pre-registered Slack App. |
| 22 | **Figma** | Remote HTTP `https://mcp.figma.com/mcp` | OAuth 2.1 | Proprietary (hosted) | Top design-to-code connector (`get_design_context`, `get_variable_defs`, `get_screenshot`); mostly Read tools. |
| 23 | **Cloudflare Workers & Observability** | Remote HTTP `https://bindings.mcp.cloudflare.com/mcp` & `https://observability.mcp.cloudflare.com/mcp` | OAuth 2.1 | Apache-2.0 | Directly matches Outlore's own Cloudflare Workers stack; open Apache-2.0 server code. |
| 24 | **Google Workspace (Gmail, Drive, Calendar)** | Remote HTTP `https://<svc>mcp.googleapis.com/mcp/v1` | OAuth 2.0 (Google Cloud client) | Proprietary (hosted) | Ubiquitous mail/calendar/files across platforms (complements macOS-only Apple apps); requires Google OAuth Client ID. |
| 25 | **Vercel** | Remote HTTP `https://mcp.vercel.com` | OAuth 2.1 | Proprietary (hosted) | High-value deployment/log inspection; read-only tool surface. |
| 26 | **Asana** | Remote HTTP `https://mcp.asana.com/v2/mcp` | OAuth 2.0 (MCP App) | Proprietary (hosted) | Widely used project management; requires pre-registered Asana MCP App. |
| 27 | **HubSpot** | Remote HTTP `https://mcp.hubspot.com` | OAuth 2.1 PKCE | Proprietary (hosted) | Leading CRM with read-only CRM scopes and PKCE refresh rotation. |
| 28 | **Microsoft 365 (Work IQ)** | Remote HTTP `https://mcp.svc.cloud.microsoft/enterprise` | Entra ID / OAuth 2.0 PKCE | Proprietary (hosted) | Enterprise mail/calendar/Teams/SharePoint equivalent to Google Workspace. |
| 29 | **Intercom** | Remote HTTP `https://mcp.intercom.com/mcp` | OAuth 2.1 | Proprietary (hosted) | Customer support conversations and help center triage. |
| 30 | **Box / Dropbox** | Remote HTTP `https://mcp.box.com/` or `https://mcp.dropbox.com/mcp` | OAuth 2.0 / 2.1 | Proprietary (hosted) | Cloud file storage with standard OAuth consent. |

## Implementation implications for Outlore's Wave 1 decision

1. **Zero-OAuth Wave 1 (10–15 connectors, fastest path):** Outlore can ship 12–15 high-value official connectors immediately by making two tiny extensions to `CatalogBackend`:
   - Allow `Http` entries to specify `secretKind: null` (keyless: Context7, Cloudflare Docs, Exa) and a header prefix such as `"Bearer "` so the Vault stores the raw token while `httpMcp.ts` sends `Authorization: Bearer <token>` (unlocking GitHub, Linear, PostHog, Neon, Stripe, GitLab, Datadog, Firecrawl, Tavily, and optionally Sentry).
   - Allow `Stdio` entries to inject a Vault secret into a child env var (`BRAVE_API_KEY`, `SUPABASE_ACCESS_TOKEN`), unlocking Brave Search and Supabase PAT mode alongside zero-auth Playwright and Chrome DevTools.
2. **Generic MCP OAuth 2.1 (Wave 2 multiplier):** Implementing RFC 9728 protected-resource discovery + OAuth 2.1 PKCE browser sign-in once in the host service (storing refresh/access tokens in the Vault) unlocks Notion, Atlassian, Slack, Figma, Cloudflare Platform, Vercel, HubSpot, Asana, PayPal, Intercom, Box, and Dropbox using the exact same `Http` backend.
Note that Slack, Asana, and Google Workspace require pre-registered OAuth client credentials (not pure dynamic client registration), so those three need either an Outlore-registered app or owner-supplied client ID/secret.
3. **Exact-name Read/Write classification still requires a live `tools/list` pass per connector:** Even where a vendor offers `/readonly` or `?readonly=true`, Outlore's contract (`specifications.md:49`) classifies every tool by exact name in `catalogEntries.ts` and treats unnamed tools as `Write` (asks).
Each chosen connector must therefore be probed with a real credential during implementation to snapshot its exact `tools/list` into a fixture and classify every tool individually, just as `appleEntry` does.
