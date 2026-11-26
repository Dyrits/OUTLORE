# Handoff: Dual-auth OAuth connectors and thirteen missing remote connectors

Supersedes: none
Workspace: /Users/dgerrits/Codelab/Dyrits/OUTLORE (`main`, base `431e71f4`, current HEAD `4dfad808`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Offer generic MCP OAuth 2.1 browser sign-in alongside static API keys/tokens on all DCR-capable existing connectors, add the thirteen missing DCR-capable remote MCP connectors to the catalog, and fix Code Mode's warm-harness restart key when connectors change between turns.
Done looks like this batch (CHG-0763) committed and pushed, visually checked in the desktop Charter window, and verified with at least one live OAuth sign-in.

## State

- **Dual-auth OAuth 2.1 + static key support (verified by tests, Biome, and 7-workspace typecheck):**
  - Enabled on the 6 DCR-capable existing connectors: Composio (`catalogEntries.ts`), Tavily (`entries/tavily.ts`), Stripe (`entries/stripe.ts`), Neon (`entries/neon.ts`), GitLab (`entries/gitlab.ts`), and Datadog (`entries/datadog.ts`).
  - `httpMcp.ts` accepts `auth: "Secret" | "OAuth"` so OAuth calls always send `Authorization: Bearer <accessToken>` with an MCP session handshake while static-key calls keep the entry's configured header (such as Composio's `x-consumer-api-key`) and stateless mode unless `shouldUseSession` is set.
  - `VaultPort.remove` (`vaultPort.ts`, `vaultWiring.ts`), `Connectors.signIn` (`connectors.ts`), and `vaultHandlers.ts` keep the two credential kinds mutually exclusive (OAuth sign-in clears any prior static key; `PutSecret`/`ReplaceSecret` clears any prior `OAuth session` and clears `Needs connecting`).
  - `ConnectorPanel` (`apps/app/src/settings/connectorPanel.tsx`) renders both the browser sign-in button and the static key field (`Or connect with a key:`) when a connector supports both.
- **13 missing DCR-capable remote connectors added (verified by live RFC 9728/8414/7591 probes on 2026-11-26 and `hostedCatalog.test.ts`):**
  - Dual-auth: Linear (`entries/linear.ts`), Sentry (`entries/sentry.ts`), PostHog (`entries/posthog.ts`).
  - OAuth 2.1 only: Notion (`entries/notion.ts`), Atlassian Jira & Confluence `/v2/mcp` (`entries/atlassian.ts`), Figma (`entries/figma.ts`), Vercel (`entries/vercel.ts`), Intercom (`entries/intercom.ts`), Postman (`entries/postman.ts`), monday.com (`entries/monday.ts`), Airtable (`entries/airtable.ts`), PayPal (`entries/paypal.ts`), Dropbox (`entries/dropbox.ts`).
  - Documented tool names are classified for Figma, Notion, and Sentry (`test/fixtures/hostedListings.ts`); closed-source or dynamically scoped servers without a public static listing leave `tools: {}` so every runtime-discovered tool defaults safely to Unclassified (asks every time).
- **Code Mode warm-harness restart key fix (verified by `connectorTurns.test.ts` and `codeMode.test.ts`, 22/22 passed):**
  - Fixed in `packages/service/src/work/turnRunner.ts` and `packages/service/src/core/execution.ts` by an errand: `access.connectorTools` now always carries the turn snapshot under Code Mode so warm harnesses restart when connectors change between turns.
- **Automated checks (verified on 2026-11-26):**
  - `CI=1 bun run test packages/service/test/connectors/oauth/ packages/service/test/connectors/hostedCatalog.test.ts packages/service/test/connectors/codeExecutor.test.ts packages/service/test/work/vaultHandlers.test.ts`: 202/202 passed (including 169 `hostedCatalog` tests and the new `dualAuth.test.ts`).
  - `bunx biome check` across all 92 touched and related connector/vault/UI files: 0 errors.
  - `bun run typecheck` across all 7 workspaces (`@outlore/contracts`, `@outlore/channel`, `@outlore/relay`, `@outlore/controller`, `@outlore/service`, `app`, `desktop`): 0 errors.
- **Unrelated dirty files in the working tree (observed via `git status -s`, untouched):**
  - Another quest has uncommitted changes for first-message image display and the image lightbox (`apps/app/src/attachments/*`, `conversationEntries.tsx`, `threadRecords.ts`, `missionDetail.ts`, `attachments.test.ts`, `replies.test.ts`, `documentation/capabilities/conversation-panes/specifications.md`, and `.agents/handoffs/2026-11-26-1455-first-message-image-and-lightbox.md`). Keep those out of connector commits.
- **Not yet verified (assumed / pending):**
  - Desktop window visual inspection of dual-auth connector panels in the Charter.
  - Live browser OAuth 2.1 sign-in against any third-party vendor endpoint.

## Decisions

- **Dual-auth on DCR-capable existing connectors only (owner approved 2026-11-26, CHG-0763):** Composio, Tavily, Stripe, Neon, GitLab, and Datadog advertise RFC 7591 DCR; GitHub (`github.com/login/oauth`) does not, so GitHub stays PAT-only.
- **Mutual exclusivity of OAuth session and static key (owner approved 2026-11-26, CHG-0763):** Connecting with one method clears the other in the Vault so the active credential is never ambiguous.
- **All 13 DCR-capable missing remote connectors included (owner approved 2026-11-26, CHG-0763):** Non-DCR vendors (Slack, Asana, HubSpot, Box, Google Workspace, Microsoft 365) remain deferred until pre-registered OAuth app support is decided.
- **Fail-closed Unclassified fallback for unlisted tools (owner approved 2026-11-26, CHG-0763):** `hostedCatalog.test.ts` checks recorded fixtures for entries that declare classified tools, while closed-source or dynamic servers leave `tools: {}` so every runtime-discovered tool asks on each call.
- **Vendored local stdio connectors deferred (owner approved 2026-11-26):** Playwright, Chrome DevTools, Brave Search, and MCP Fetch stay for a separate batch.

## Next

1. Commit and push the CHG-0763 changes (and the `turnRunner.ts` Code Mode restart-key fix), leaving the unrelated image-lightbox files unstaged; pushing directly to `main` requires owner approval for `git push --no-verify` per `AGENTS.md`.
2. Open the Charter in the desktop window to visually verify dual-auth panels (such as Composio, Stripe, and Linear) and complete one live browser OAuth sign-in.
3. Decide which follow-up batch to take next: vendored stdio connectors, self-hosted instance URLs (such as `gitlab.hipay.org`), or validating credentials immediately on `PutSecret`/`ReplaceSecret`.

## Open questions

- **Self-hosted GitLab (`gitlab.hipay.org`)**: Should the GitLab connector support a configurable base URL, and should `PutSecret`/`ReplaceSecret` run `connectors.refresh` immediately to surface bad tokens instead of showing `Ready` until the next turn? (Owner decision.)
- **Live OAuth sign-in & tool-list refinement**: Once the owner signs in to dynamic OAuth connectors (Linear, Atlassian, Vercel, PostHog, etc.), should their live `tools/list` outputs be captured to classify safe read-only tools? (Owner decision.)

## Sources

- `documentation/capabilities/connectors/specifications.md`
- `documentation/changelog/0.2.10-Pre-Alpha.md` (CHG-0763)
- `documentation/work-in-progress.md`
- `documentation/research/connector-catalogs-2026-11-25.md`
- `documentation/architecture-decision-record/0027-mcp-oauth-sessions-in-the-vault.md`
- `packages/service/test/connectors/hostedCatalog.test.ts`
- `packages/service/test/connectors/oauth/dualAuth.test.ts`
