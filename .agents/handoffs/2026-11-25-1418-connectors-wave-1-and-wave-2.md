# Handoff: Connectors Wave 1 shipped, Wave 2 (generic MCP OAuth 2.1) next

Supersedes: none
Workspace: outlore (branch `mission/add-many-connectors-3919525c`, pushed to `origin/main` from `.worktrees/add-many-connectors-3919525c`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Expand Outlore's curated connector catalog beyond Composio and Apple apps in two waves: Wave 1 (zero-OAuth hosted HTTP MCP connectors, verified one by one) and Wave 2 (one generic host-side MCP OAuth 2.1 PKCE client unlocking browser-authenticated remote MCP servers such as Linear, Notion, Atlassian, Figma, Cloudflare Platform, Vercel, and Supabase).

## State

- **Primary-source research (verified):** Three research notes are committed in `documentation/research/`: `openbot-connectors-inventory-2026-11-25.md`, `t3code-paseo-connectors-2026-11-25.md`, and `connector-catalogs-2026-11-25.md`.
- **Wave 1 HTTP backend (CHG-0729, verified):** `packages/service/src/connectors/backends/httpMcp.ts` and `catalog.ts` now support keyless HTTP entries (`header: null`) and an optional header `prefix` (such as `"Bearer "`), keeping secrets in the Vault and leaving Composio unchanged (`httpMcpHeader.test.ts`: 4 passed; mutation check failed as expected).
- **Wave 1 catalog entries (CHG-0730, verified offline; 6 keyless verified live):** Twelve remote HTTP MCP connectors were added one commit each under `packages/service/src/connectors/entries/`:
  - Keyless (6, live `tools/list` verified on 2026-11-25 via `OUTLORE_LIVE_CONNECTORS=1 bunx vitest run packages/service/test/connectors/hostedLive.test.ts`): `context7` (2 tools), `cloudflare_docs` (2), `aws_knowledge` (5), `deepwiki` (3), `exa` (2), `firecrawl` (3).
  - Keyed with `Authorization: Bearer <secret>` (6, verified against primary-source vendor repos/docs, not live-tested due to no keys): `github` (49 tools), `tavily` (6), `stripe` (16), `neon` (65), `gitlab` (57), `datadog` (23).
  - Deferred from Wave 1 (2): `linear` (no public complete tool list without auth) and `posthog` (single `exec` tool taking CLI strings across 1,161 commands, incompatible with per-tool Read/Write classification).
- **Regression & verification proof (verified):** `mission/add-many-connectors-3919525c` merged `origin/main` (`13db903b`); Biome, all 7 workspace typechecks, 290/294 affected test files (2,323 tests passed, 22 skipped), and all 23 connector test files with live keyless checks (272 passed, 1 skipped) passed. Proof recorded in `documentation/verification/2026-11-25-connectors-wave-1.md`.
- **Wave 2 (in flight / starting next):** Generic MCP OAuth 2.1 client (RFC 9728 protected-resource metadata, PKCE S256, dynamic client registration or client metadata, loopback callback, Vault token storage + refresh) and Wave 2 OAuth connectors have not started yet.
- **Note on local main checkout (verified):** The root checkout `/Users/dgerrits/Codelab/Dyrits/OUTLORE` had unrelated uncommitted changes from other quests in `apps/app/src/terminal/`, `apps/app/src/settings/providers.tsx`, `packages/contracts/`, and `packages/service/src/work/accounts*`; Wave 1 was verified, committed, and pushed from `.worktrees/add-many-connectors-3919525c` without touching the root checkout.

## Decisions

- **Curated catalog only:** Extend `defaultCatalog` with verified entries; no owner-added arbitrary MCP servers (owner decision, quest journal #1).
- **Two-wave auth strategy (Option A):** Ship Wave 1 without OAuth first, then build one generic host-side MCP OAuth 2.1 client in Wave 2 so sign-ins happen on the vendor's own page with no connector-specific sign-in screens in Outlore (owner decision, quest journal #6).
- **Exact-name Read/Write classification:** Every tool is classified `Read` or `Write` by exact name from primary sources, never trusting server annotations; tools that return credentials (`get_connection_string`) or run arbitrary SQL (`run_sql`, `explain_sql_statement`) are `Write` (CHG-0730).
- **Hosted-only licence representation:** Added `hostedServiceLicence` (`"Hosted service, server code not published"`) for hosted SaaS endpoints whose server code is not published under an OSI licence; Sentry remains excluded for its non-OSI FSL-1.1-Apache-2.0 licence (CHG-0730).
- **Keyed connectors expose full toolsets with Write confirmation:** Rather than hardcoding `/readonly` endpoints, writes prompt per call and connector notices advise restricting API keys (CHG-0730; open for owner override).

## Next

1. Design and specify Wave 2's generic host-side MCP OAuth 2.1 client (RFC 9728 discovery, PKCE S256, dynamic client registration / CIMD, loopback redirect, Vault storage for access and refresh tokens, token refresh in `httpMcp.ts`, and `initialize` / `Mcp-Session-Id` session handling if required by OAuth servers).
2. Add an ADR if the OAuth token lifecycle or Vault schema change is hard to reverse, and update `documentation/capabilities/connectors/specifications.md` and `blueprint.md`.
3. Implement the generic OAuth 2.1 backend and connect flow (browser sign-in on vendor's own page, no connector-specific screens) with automated tests against a local mock OAuth 2.1 + MCP server.
4. Add Wave 2 connectors one by one with verified tool classifications: prioritize `linear`, `notion`, `atlassian`, `figma`, `cloudflare` (platform), `vercel`, `supabase`, `asana`, and `todoist` (avoiding `approved-clients` / `byo-oauth` / `admin`-gated vendors like Slack, Google Workspace, Microsoft 365, and Salesforce unless pre-registered apps are decided).
5. Live-verify the six Wave 1 keyed connectors (`github`, `tavily`, `stripe`, `neon`, `gitlab`, `datadog`) once the owner supplies test keys.

## Open questions

- **Hosted-only licence wording:** Owner to confirm whether `hostedServiceLicence` (`"Hosted service, server code not published"`) and the updated specification wording for third-party hosted services are acceptable.
- **Read-only endpoints vs Write prompts:** Owner to confirm keeping full endpoints (GitHub, Neon) with per-call Write approval rather than hardcoding `/readonly` URLs.
- **Web search/fetch classification:** Owner to confirm keeping Exa, Firecrawl, Tavily, Context7, Cloudflare Docs, AWS Knowledge, and DeepWiki as `Read` (unprompted) despite query-leakage risk, or changing them to `Write`.
- **Single-region endpoints:** Owner to confirm Datadog US1-only (`mcp.datadoghq.com`) and GitLab.com-only (`gitlab.com/api/v4/mcp`) for Wave 1.
- **PostHog `exec` tool:** Owner to decide whether a single-tool CLI multiplexer (`exec`) should always be `Write` (ask on every call) or remain excluded.

## Sources

- `documentation/research/connector-catalogs-2026-11-25.md`
- `documentation/research/openbot-connectors-inventory-2026-11-25.md`
- `documentation/research/t3code-paseo-connectors-2026-11-25.md`
- `documentation/capabilities/connectors/specifications.md`
- `documentation/capabilities/connectors/blueprint.md`
- `documentation/changelog/0.2.7-Pre-Alpha.md` (CHG-0729, CHG-0730)
- `documentation/verification/2026-11-25-connectors-wave-1.md`
- `packages/service/src/connectors/backends/httpMcp.ts`
- `packages/service/src/connectors/entries/`
