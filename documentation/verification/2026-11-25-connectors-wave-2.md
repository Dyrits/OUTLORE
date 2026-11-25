# Proof: Connectors Wave 2 — Generic MCP OAuth 2.1 Client and Initial OAuth Connectors (CHG-0733 and CHG-0734)

- **Verdict:** not proven overall (C1 and C2 are proven against the local loopback mock OAuth 2.1 + MCP server and catalog suite; C3 for live vendor OAuth sign-in against Cloudflare, Supabase, and Todoist is unproven because no owner OAuth sign-in was performed during this build)
- **Work:** `6970efa3..186b3559` on branch `mission/add-many-connectors-11caa0a0` (worktree `.worktrees/add-many-connectors-11caa0a0`)
- **Agreement:** Owner decisions in quest "Add many connectors" (Option A Wave 2 generic MCP OAuth 2.1 client; ADR 0027 accepted; Cloudflare `execute` as `Write`; closed-source OAuth connectors deferred until authenticated `tools/list` snapshots), [ADR 0027](../architecture-decision-record/0027-mcp-oauth-sessions-in-the-vault.md), [connectors specification](../capabilities/connectors/specifications.md), and [connectors blueprint](../capabilities/connectors/blueprint.md)
- **Environment:** macOS, Bun 1.4.4, Vitest 5.1.1, local loopback mock OAuth 2.1 + Streamable-HTTP MCP server
- **Date:** 2026-11-25

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | The generic host-side MCP OAuth 2.1 client performs RFC 9728 / RFC 8414 / OIDC discovery, PKCE `S256`, RFC 7591 DCR, loopback callback with `state` validation, encrypted Vault session storage, proactive and reactive (401) token refresh, access/refresh token redaction, HTTP redirect refusal, Streamable-HTTP `initialize` + `Mcp-Session-Id` (with 404 re-init), and host-only `SignInConnector` enforcement | CHG-0733, ADR 0027, `packages/service/src/connectors/oauth/` | proven |
| C2 | All three Wave 2 OAuth 2.1 catalog entries (`cloudflare`, `supabase`, `todoist`) plus all twelve Wave 1 entries name every tool from their recorded primary-source listing, invent none, classify every tool as `Read` or `Write` with a non-empty summary, fit Claude Code's 64-character qualified tool-name limit, reach an `https://` endpoint with OAuth session config, state an honest OSI licence, and carry a third-party notice | CHG-0734, `packages/service/src/connectors/entries/` | proven |
| C3 | Live browser OAuth 2.1 sign-in and authenticated `tools/list` / `tools/call` succeed against Cloudflare (`https://mcp.cloudflare.com/mcp`), Supabase (`https://mcp.supabase.com/mcp`), and Todoist (`https://ai.todoist.net/mcp`) | CHG-0734 | unproven |

## Evidence

### C1: Generic MCP OAuth 2.1 client, Vault session lifecycle, HTTP sessions, and host-only `SignInConnector`

- **Check:** `bunx vitest run packages/service/test/connectors/oauth/mcpOAuth.test.ts packages/service/test/connectors/backends/httpMcp.test.ts packages/service/test/work/vaultPort.test.ts packages/contracts/test/hostOnlyRequests.test.ts packages/service/test/remote/frames.test.ts`
- **Shown able to fail:** In a detached worktree at `186b3559` (`.worktrees/verify-wave2-m1`), changed `"code_challenge_method", "S256"` to `"plain"` in `packages/service/src/connectors/oauth/client.ts`; `mcpOAuth.test.ts` failed on `signs in through PKCE S256 + DCR + loopback callback, stores session in Vault, and runs MCP session calls` (`AssertionError: expected 'plain' to be 'S256'`).
- **Result:** Exit code 0; `mcpOAuth.test.ts` 6 passed, `httpMcp.test.ts` 14 passed, `vaultPort.test.ts` 4 passed, `hostOnlyRequests.test.ts` 3 passed, `frames.test.ts` 4 passed (31 passed across 5 files).
- **Reproduced:** Rerun cleanly in `.worktrees/add-many-connectors-11caa0a0` after removing the mutation worktree; identical result (122 passed across 6 files including `hostedCatalog.test.ts`).

### C2: Wave 2 OAuth 2.1 catalog entries (`cloudflare`, `supabase`, `todoist`)

- **Check:** `bunx vitest run packages/service/test/connectors/hostedCatalog.test.ts`
- **Shown able to fail:** In a detached worktree at `186b3559` (`.worktrees/verify-wave2-mut`), deleted `execute` from `packages/service/src/connectors/entries/cloudflare.ts`; `hostedCatalog.test.ts -t "cloudflare "` failed on `names every tool of its recorded listing as Read or Write` (`AssertionError: expected [ 'execute' ] to deeply equal []`).
- **Result:** Exit code 0; 91 passed (91 tests across all 15 Wave 1 and Wave 2 hosted entries).
- **Reproduced:** Rerun cleanly in `.worktrees/add-many-connectors-11caa0a0`; identical result (91 passed).

### C3: Live browser OAuth 2.1 sign-in against Cloudflare, Supabase, and Todoist

- **Check:** Not run; no owner browser OAuth sign-in was performed against Cloudflare, Supabase, or Todoist during this build (unauthenticated RFC 9728 / RFC 8414 / PKCE `S256` / RFC 7591 `registration_endpoint` metadata probes succeeded on 2026-11-25).
- **Shown able to fail:** N/A.
- **Result:** Unchecked live after authentication.
- **Reproduced:** N/A.

## Regressions

| Check | Command | Starting commit | End state |
| --- | --- | --- | --- |
| Connector & contract suite | `bunx vitest run packages/service/test/connectors/ packages/contracts/test/hostOnlyRequests.test.ts packages/service/test/remote/frames.test.ts packages/service/test/work/vaultPort.test.ts` | not run | pass (26 passed, 1 skipped of 27 files; 301 passed, 7 skipped) |
| Biome lint/format | `.githooks/pre-commit` on `186b3559` | pass (CI/main) | pass (20 files checked, 0 fixes) |
| Workspace typecheck (all 7 packages) | `.githooks/pre-commit` on `186b3559` | pass (CI/main) | pass (all 7 workspaces) |
| Related Vitest suite | `.githooks/pre-commit` on `186b3559` | pass (CI/main) | pass (291 files passed, 4 skipped of 295; 2,337 tests passed, 22 skipped) |

## Not proven

- **C3 (live browser OAuth 2.1 sign-in and authenticated `tools/list` / `tools/call` against Cloudflare, Supabase, and Todoist):** Unproven because no owner account sign-in was performed in a browser during this build. Clicking **Sign in in browser** in the host Workshop's Connectors tab for Cloudflare, Supabase, and Todoist and running one Read tool on each will prove the live end-to-end flow.

## Reproduce

```sh
bunx vitest run \
  packages/service/test/connectors/oauth/mcpOAuth.test.ts \
  packages/service/test/connectors/hostedCatalog.test.ts \
  packages/service/test/connectors/backends/httpMcp.test.ts \
  packages/service/test/work/vaultPort.test.ts \
  packages/contracts/test/hostOnlyRequests.test.ts \
  packages/service/test/remote/frames.test.ts
```

## New files

None.
