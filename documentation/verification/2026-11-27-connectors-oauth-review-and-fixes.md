# Verification: connectors OAuth sign-in fixes, Standards refactors, and specification updates (CHG-0785)

Date: 2026-11-27
Scope: `packages/service/src/connectors/`, `packages/service/src/work/mcp.ts`, `packages/service/src/work/vaultWiring.ts`, `apps/app/src/foundation/useServiceQuery.ts`, `apps/app/src/settings/connectorsSection.tsx`, `apps/app/src/settings/connectorPanel.tsx`, `apps/app/src/settings/connectorPanelBlocks.tsx`, `documentation/capabilities/connectors/specifications.md`

## Claims and verdicts

| # | Claim | Verdict | Evidence |
| --- | --- | --- | --- |
| C1 | Loopback callback page no longer claims "Signed in to Outlore" before token exchange and listing finish, ignores stray `?error=` callbacks with wrong `state`, and surfaces RFC 6749 error codes without free-text descriptions (`SPEC-1`, `SPEC-11`, `BUG-5`). | Proven | `packages/service/test/connectors/oauth/mcpOAuth.test.ts` (test: "ignores stray error callbacks with wrong state, surfaces RFC 6749 error codes, and avoids premature signed-in copy") — passed. |
| C2 | Token endpoint HTTP 4xx surfaces RFC 6749 `error` code; post-sign-in `tools/list` HTTP 401/403 fails explicitly with HTTP status and marks the card `NeedsConnecting` with that reason; post-sign-in `tools/list` HTTP 500 fails explicitly instead of silently succeeding with zero tools; re-sign-in starts a fresh MCP `initialize` handshake (`SPEC-3`, `SPEC-4`, `SPEC-12`, `BUG-1`). | Proven | `packages/service/test/connectors/oauth/mcpOAuth.test.ts` (test: "surfaces token endpoint RFC 6749 error codes and post-sign-in tools/list refusals or server errors") — passed. |
| C3 | OAuth session encoding omits `null` fields to reduce Vault payload size while decoding both compact and legacy JSON (`BUG-4`). | Proven | `packages/service/test/connectors/oauth/mcpOAuth.test.ts` (test: "encodes OAuth sessions compactly without null fields while decoding both compact and legacy JSON") — passed. |
| C4 | `useServiceQuery` refreshes the same cache entry in place without resetting `data` to `null`, preventing `ConnectorPanel` from unmounting and losing its error text (`SPEC-2`). | Proven | `apps/app/test/foundation/useServiceQuery.test.ts` (test: "refreshes the same cache entry in place without clearing data") — passed. |
| C5 | All 25 Standards findings (`STD-1`–`STD-25`) and remaining structural refactors (`ApplePermissions`, `connectorNeeds`, `credentials`, `EntryCredentials` + `Match.valueTags`, `hostedOAuthEntryOf`, `mcpClient`, pure Effect `httpMcpTransport`, action renames) preserve behavior with zero regressions. | Proven (automated) | `bunx biome check` (104 files, 0 errors), `tsc -p . --noEmit` in `packages/service` and `apps/app` (exit 0), `packages/service/test/connectors` (24 files passed, 1 skipped; 374 passed, 7 skipped), `apps/app` (`useServiceQuery` + `connectorChoices`: 11 passed). |
| C6 | Live browser OAuth sign-in against Atlassian (`mcp.atlassian.com/v2/mcp`) and the desktop window's Cancel button during sign-in wait (`SPEC-10`). | Unproven | Requires a real desktop window and live Atlassian account sign-in; automated tests run against a local loopback mock OAuth 2.1 + MCP server. |

## Reproduction

```bash
bunx biome check packages/service/src/connectors packages/service/src/work/vaultWiring.ts packages/service/src/work/mcp.ts packages/service/test/connectors apps/app/src/foundation/useServiceQuery.ts apps/app/src/settings/connectorsSection.tsx apps/app/src/settings/connectorPanel.tsx apps/app/src/settings/connectorPanelBlocks.tsx apps/app/test/foundation/useServiceQuery.test.ts
(cd packages/service && bunx vitest run test/connectors)
(cd apps/app && bunx vitest run test/foundation/useServiceQuery.test.ts test/connectors/connectorChoices.test.ts)
(cd packages/service && bunx tsc -p . --noEmit)
(cd apps/app && bunx tsc -p . --noEmit)
```
