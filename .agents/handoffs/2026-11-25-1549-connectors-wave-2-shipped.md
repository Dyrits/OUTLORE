# Handoff: Connectors Wave 1 and Wave 2 shipped; live sign-in checks and closed-source OAuth catalog next

Supersedes: `2026-11-25-1418-connectors-wave-1-and-wave-2.md`
Workspace: outlore (branch `mission/add-many-connectors-11caa0a0`, pushed to `origin/main` from `.worktrees/add-many-connectors-11caa0a0`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Expand Outlore's curated connector catalog with verified remote MCP servers across Wave 1 (keyless and Bearer API-key HTTP servers) and Wave 2 (one generic host-side MCP OAuth 2.1 client plus browser-authenticated OAuth servers), then live-verify keyed/OAuth connectors and add closed-source OAuth vendors once authenticated `tools/list` snapshots are captured.

## State

- **Wave 1 (CHG-0730, CHG-0731 — verified, pushed to `origin/main`):** Keyless and header-prefix HTTP backend plus 12 hosted connectors (6 keyless live-verified: `context7`, `cloudflare_docs`, `aws_knowledge`, `deepwiki`, `exa`, `firecrawl`; 6 Bearer-keyed verified against primary sources: `github`, `tavily`, `stripe`, `neon`, `gitlab`, `datadog`). Proof in `documentation/verification/2026-11-25-connectors-wave-1.md`.
- **Wave 2 generic MCP OAuth 2.1 client & HTTP sessions (CHG-0733, ADR 0027 accepted — verified):**
  - `packages/service/src/connectors/oauth/` implements RFC 9728 Protected Resource Metadata discovery, RFC 8414 / OIDC Authorization Server discovery, PKCE `S256`, cryptographic `state` validation, RFC 7591 Dynamic Client Registration, RFC 8707 `resource` indicator, ephemeral loopback callback (`http://127.0.0.1:<port>/callback`), and strict redirect refusal (`redirect: "manual"`).
  - OAuth sessions (`version: 1`) are stored as one encrypted `OAuth session` record in the Vault via `VaultPort.putOrReplace` (ADR 0027), refreshed proactively (60s skew) and reactively once on HTTP 401 behind a per-connector semaphore, and redacted (access token, refresh token, and client secret) from all outputs.
  - `backends/httpMcp.ts` performs `initialize` + `notifications/initialized` + `Mcp-Session-Id` handshakes (with automatic 404 re-init) for OAuth and stateful HTTP entries while keeping Wave 1 entries stateless.
  - Host-only `SignInConnector` wired across `packages/contracts`, `packages/service`, and a single generic "Sign in in browser" / "Sign in again" button in `apps/app/src/settings/connectorPanel.tsx`.
- **Wave 2 OAuth 2.1 connectors (CHG-0734 — verified offline against official repos + live DCR probes):**
  - `cloudflare` (`https://mcp.cloudflare.com/mcp`, Apache-2.0, `cloudflare/mcp@ad6cb102`, 5 tools: 3 Read, 2 Write including `execute`).
  - `supabase` (`https://mcp.supabase.com/mcp`, Apache-2.0, `supabase-community/supabase-mcp@01f8021f`, 42 tools: 23 Read, 19 Write).
  - `todoist` (`https://ai.todoist.net/mcp`, MIT, `Doist/todoist-ai@00f065f7`, 52 tools: 24 Read, 28 Write).
- **Regression & verification proof (verified):** Merged `origin/main` (`CHG-0732`) at `186b3559`; Biome (20 files), all 7 workspace typechecks, 291/295 affected test files (2,337 passed, 22 skipped), 26/27 connector & contract test files (301 passed, 7 skipped), and mutation checks on `oauth/client.ts` and `entries/cloudflare.ts` all verified. Proof in `documentation/verification/2026-11-25-connectors-wave-2.md`.
- **Deferred connectors:**
  - **Closed-source / dynamic OAuth 2.1 DCR servers:** Notion, Atlassian, Figma, Vercel, Linear, Intercom, Postman, monday.com, Airtable — deferred until an owner-authenticated `tools/list` snapshot gives exact tool names.
  - **No RFC 7591 DCR:** Asana (`registration_endpoint: null`).
  - **Policy-excluded (approved-clients / BYO OAuth / admin-gated):** Slack, Google Workspace, Microsoft 365, Salesforce, Box, Dropbox, Canva.
  - **Other Wave 1 deferrals:** PostHog (single `exec` CLI multiplexer across 1,161 commands), Sentry (non-OSI FSL-1.1-Apache-2.0 licence).

## Decisions

- **ADR 0027 accepted (owner confirmed 2026-11-25):** Store OAuth 2.1 sessions as one encrypted `OAuth session` JSON record per connector in the existing Vault and keep `SignInConnector` host-only.
- **Closed-source OAuth connectors remain deferred (owner confirmed 2026-11-25):** Do not invent or guess tool names; wait until the owner runs one live authenticated `tools/list` per service to snapshot exact tool names.
- **Cloudflare `execute` is `Write` (owner confirmed 2026-11-25):** Asks on every call, matching Composio's `COMPOSIO_MULTI_EXECUTE_TOOL`.
- **Delete finished worktrees (owner rule, workspace lore):** Remove errand/task worktrees once merged and pushed.

## Next

1. Live-verify browser OAuth 2.1 sign-in and one Read tool call in the running host app for `cloudflare`, `supabase`, and `todoist` (closing C3 in `documentation/verification/2026-11-25-connectors-wave-2.md`).
2. Live-verify the six Wave 1 keyed connectors (`github`, `tavily`, `stripe`, `neon`, `gitlab`, `datadog`) with real vendor keys (closing C4 in `documentation/verification/2026-11-25-connectors-wave-1.md`).
3. If the owner wants Notion, Atlassian, Figma, Vercel, Linear, or other closed-source OAuth 2.1 connectors next, capture one authenticated `tools/list` snapshot per service on the host and add each entry in its own commit with exact-name Read/Write classification.
4. Optionally revisit Wave 1's stdio shortlist (`playwright`, `brave_search`, `supabase` stdio) if local-only or non-OAuth use cases are requested.

## Open questions

- **Wave 1 open owner preferences (still unconfirmed from Wave 1):** hosted-only licence wording (`hostedServiceLicence`), keeping full endpoints vs hardcoded `/readonly` URLs (GitHub, Neon), keeping web search/fetch tools as `Read`, Datadog US1-only / GitLab.com-only, and whether PostHog's single `exec` tool should be added as `Write` or stay excluded.

## Sources

- `documentation/architecture-decision-record/0027-mcp-oauth-sessions-in-the-vault.md`
- `documentation/capabilities/connectors/specifications.md`
- `documentation/capabilities/connectors/blueprint.md`
- `documentation/changelog/0.2.7-Pre-Alpha.md` (CHG-0730, CHG-0731, CHG-0733, CHG-0734)
- `documentation/verification/2026-11-25-connectors-wave-1.md`
- `documentation/verification/2026-11-25-connectors-wave-2.md`
- `packages/service/src/connectors/oauth/`
- `packages/service/src/connectors/backends/httpMcp.ts`
- `packages/service/src/connectors/entries/`
- `packages/service/test/connectors/oauth/mcpOAuth.test.ts`
