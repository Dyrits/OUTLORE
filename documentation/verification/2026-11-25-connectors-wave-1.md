# Proof: Connectors Wave 1 (CHG-0729 and CHG-0730)

- **Verdict:** not proven overall (C1 to C3 are proven; C4 for the six keyed servers is unproven because no vendor API keys were held)
- **Work:** `b4d4dd0e..13db903b` on branch `mission/add-many-connectors-3919525c` (worktree `.worktrees/add-many-connectors-3919525c`)
- **Agreement:** Owner decisions in quest "Add many connectors" (Option A: Wave 1 zero-OAuth with hosted HTTP connectors verified one by one, before Wave 2 generic MCP OAuth 2.1), [connectors specification](../capabilities/connectors/specifications.md), [connectors blueprint](../capabilities/connectors/blueprint.md), and [connector catalogs research note](../research/connector-catalogs-2026-11-25.md)
- **Environment:** macOS, Bun 1.4.4, Vitest 5.1.1, network access to the six public keyless MCP endpoints on 2026-11-25
- **Date:** 2026-11-25

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | The Streamable-HTTP MCP backend sends no credential header for keyless entries (`header: null`, even when a secret is passed), puts `prefix` before the secret when configured (e.g. `Bearer `), and keeps Composio's unprefixed header unchanged | CHG-0729, `packages/service/src/connectors/backends/httpMcp.ts` | proven |
| C2 | All twelve Wave 1 catalog entries (six keyless, six keyed) name every tool from their recorded primary-source listing, invent none, classify every tool as `Read` or `Write` with a non-empty summary, fit Claude Code's 64-character qualified tool-name limit, reach an `https://` endpoint, state an honest licence (`MIT`, `Apache-2.0`, or `hostedServiceLicence`), and carry a third-party notice | CHG-0730, `packages/service/src/connectors/entries/` | proven |
| C3 | All six keyless Wave 1 servers (`context7`, `cloudflare_docs`, `aws_knowledge`, `deepwiki`, `exa`, `firecrawl`) answer `tools/list` live through `httpMcpBackend` with the exact tool names their catalog entries declare | CHG-0730, `packages/service/test/connectors/hostedLive.test.ts` | proven |
| C4 | All six keyed Wave 1 servers (`github`, `tavily`, `stripe`, `neon`, `gitlab`, `datadog`) answer stateless `tools/list` and `tools/call` with `Authorization: Bearer <secret>` and match their cataloged tool lists live | CHG-0730, `packages/service/src/connectors/entries/` | unproven |

## Evidence

### C1: Streamable-HTTP header prefix and keyless behavior

- **Check:** `bunx vitest run packages/service/test/connectors/backends/httpMcpHeader.test.ts`
- **Shown able to fail:** In a detached worktree at `13db903b` (`.worktrees/verify-wave1-mut`), removed `${transport.prefix ?? ""}` from `packages/service/src/connectors/backends/httpMcp.ts`; `httpMcpHeader.test.ts` failed on `puts the prefix before the secret in the header's value` (`AssertionError: expected 'lin_api_1f3c9a07d2/the-token==' to be 'Bearer lin_api_1f3c9a07d2/the-token=='`).
- **Result:** Exit code 0; 4 passed (4 tests) in 59ms.
- **Reproduced:** Rerun cleanly in `.worktrees/add-many-connectors-3919525c` after deleting the mutation worktree; identical result (4 passed).

### C2: Wave 1 catalog integrity and classification

- **Check:** `bunx vitest run packages/service/test/connectors/hostedCatalog.test.ts packages/service/test/connectors/catalog.test.ts`
- **Shown able to fail:** In `.worktrees/verify-wave1-mut`, deleted `"query-docs"` from `packages/service/src/connectors/entries/context7.ts`; `hostedCatalog.test.ts -t context7` failed on `names every tool of its recorded listing as Read or Write`.
- **Result:** Exit code 0; `hostedCatalog.test.ts` 73 passed (73), `catalog.test.ts` 10 passed (10).
- **Reproduced:** Rerun cleanly in `.worktrees/add-many-connectors-3919525c`; identical result (83 passed across both files).

### C3: Live `tools/list` against all six keyless Wave 1 servers

- **Check:** `OUTLORE_LIVE_CONNECTORS=1 bunx vitest run packages/service/test/connectors/hostedLive.test.ts`
- **Shown able to fail:** In `.worktrees/verify-wave1-mut`, deleted `"query-docs"` from `packages/service/src/connectors/entries/context7.ts`; `OUTLORE_LIVE_CONNECTORS=1 bunx vitest run packages/service/test/connectors/hostedLive.test.ts -t context7` failed against the live Context7 endpoint (`AssertionError: expected [ 'query-docs' ] to deeply equal []`).
- **Result:** Exit code 0; 6 passed (6 tests: `context7`, `cloudflare_docs`, `aws_knowledge`, `deepwiki`, `exa`, `firecrawl`) in 1,993ms.
- **Reproduced:** Rerun cleanly in `.worktrees/add-many-connectors-3919525c`; identical result (6 passed).

### C4: Live behavior of the six keyed Wave 1 servers

- **Check:** Not run; no vendor API keys or tokens were available for GitHub, Tavily, Stripe, Neon, GitLab, or Datadog.
- **Shown able to fail:** N/A.
- **Result:** Unchecked against live endpoints; tool names were verified only against primary-source vendor repositories and documentation snapshots recorded in `packages/service/test/fixtures/hostedListings.ts`.
- **Reproduced:** N/A.

## Regressions

| Check | Command | Starting commit | End state |
| --- | --- | --- | --- |
| Connector suite (with live keyless tests) | `OUTLORE_LIVE_CONNECTORS=1 bunx vitest run packages/service/test/connectors/` | not run | pass (23 files, 272 passed, 1 skipped) |
| Biome lint/format | `.githooks/pre-commit` on `13db903b` | pass (CI/main) | pass (34 files checked, 0 fixes) |
| Workspace typecheck (all 7 packages) | `.githooks/pre-commit` on `13db903b` | pass (CI/main) | pass (all 7 workspaces) |
| Related Vitest suite | `.githooks/pre-commit` on `13db903b` | pass (CI/main) | pass (290 files passed, 4 skipped of 294; 2,323 tests passed, 22 skipped) |

## Not proven

- **C4 (live behavior of the six keyed Wave 1 servers: GitHub, Tavily, Stripe, Neon, GitLab, Datadog):** Unproven because no vendor API keys were held in this environment. Providing a real key per service and extending `hostedLive.test.ts` (or connecting each in Outlore and listing/calling a Read tool) will prove whether each server accepts stateless `tools/list` without a prior `initialize`, accepts `Authorization: Bearer <key>` (especially GitLab fine-grained tokens), and matches the documented tool list.

## Reproduce

```sh
OUTLORE_LIVE_CONNECTORS=1 bunx vitest run \
  packages/service/test/connectors/backends/httpMcpHeader.test.ts \
  packages/service/test/connectors/hostedCatalog.test.ts \
  packages/service/test/connectors/hostedLive.test.ts \
  packages/service/test/connectors/catalog.test.ts
```

## New files

None.
