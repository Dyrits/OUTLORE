# Handoff: Connectors OAuth sign-in fixes, Standards refactors, and specification updates

Supersedes: none
Workspace: /Users/dgerrits/Codelab/Dyrits/OUTLORE (branch `main`, commit `69723d9b`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Fix the OAuth 2.1 browser sign-in failure paths surfaced while debugging Atlassian (`Needs connecting` after the browser showed success), resolve all Standards and Specifications review findings across `packages/service/src/connectors`, and update the connectors specification and notices. Done means the fixes and refactors are committed and verified by automated checks, and a live desktop Atlassian sign-in either connects cleanly or surfaces its exact RFC 6749 error code or HTTP status.

## State

- **Committed on `main` (`69723d9b`, CHG-0785)** — verified via `git commit` pre-commit hook (Biome 61 files clean, 7-workspace `tsc` exit 0, 199 affected test files / 1,804 tests passed, 21 skipped, 0 failed):
  - **OAuth sign-in & UI fixes (`SPEC-1`–`SPEC-4`, `SPEC-8`, `SPEC-10`–`SPEC-12`, `BUG-1`, `BUG-3`–`BUG-7`)**: honest loopback callback copy ("Returning to Outlore — Authorization received"); state checked before `?error=`; RFC 6749 error codes surfaced on callback, DCR, and token errors without leaking free-text descriptions; post-sign-in `tools/list` 401/403 and 5xx fail explicitly with HTTP status and mark `NeedsConnecting`; `listing.forget` resets stale MCP sessions on re-sign-in; `useServiceQuery` exposes `refresh()` on the same cache entry so `ConnectorPanel` does not unmount and lose its error; sign-in panel shows 5-minute wait note and Cancel button; per-connector `signIn` and `httpMcp` `ensureSession` Semaphore locks; rotating refresh token retries Vault write once without failing in-flight call; Vault `Invalid` (oversized secret) and locked/missing-key states surfaced clearly; compact OAuth session JSON omitting `null` fields.
  - **All 25 Standards findings (`STD-1`–`STD-25`)**: pure Effect `httpMcpTransport` (no `HttpRefusal` throws), `Effect.sync` for PKCE/state generation, `ApplePermissions` module + `probeTool` on `CatalogApp`, `connectorNeeds` module, `credentials` module, `EntryCredentials` tagged union + `Match.valueTags`, `hostedOAuthEntryOf` factory across 10 hosted OAuth entries, `mcpClient` shared constants, barrel trimming, action renames (`readCard`, `readPanelTools`, `readChoiceCards`, `ensureSnapshot`, `openBackend`, `probeApplePermissions`), `Invocation` interface, one-sentence-per-line comments.
  - **Specifications & notices (`SPEC-5`, `SPEC-6`, `SPEC-7`, `SPEC-9`)**: updated `documentation/capabilities/connectors/specifications.md` and the 10 hosted OAuth install notices.
- **Verification proof**: `documentation/verification/2026-11-27-connectors-oauth-review-and-fixes.md` — C1–C5 proven (automated), C6 (live Atlassian sign-in + desktop Cancel button) unproven.
- **Unrelated local edit preserved untouched**: `apps/app/test/shell/paneSession.test.ts` (from another session; left unstaged).

## Decisions

- **Callback page wording (`SPEC-1`)**: respond immediately with HTTP 200 ("Returning to Outlore — Authorization received") rather than holding the HTTP response open across token exchange, so browsers and loopback tests never deadlock while avoiding premature "Signed in" copy (`packages/service/src/connectors/oauth/authorization.ts`).
- **Unreachable vs refused (`SPEC-6`)**: aligned `documentation/capabilities/connectors/specifications.md` with `draft.md` and the code — only rejected credentials or refused macOS permission mark `Needs connecting`; transient unreachability warns in the thread only.
- **OAuth scope breadth (`SPEC-7`)**: kept server-advertised scopes as default when an entry does not pin `oauth.scopes` (avoiding untested scope guesses) and documented this explicitly in `specifications.md` and the hosted OAuth install notices.

## Next

1. Retry Atlassian OAuth sign-in in the running desktop window: confirm whether it connects cleanly or read the exact RFC 6749 error code / HTTP status now persisted on the card and panel.
2. Visually check the "Waiting for the browser (up to 5 minutes)…" note and **Cancel** button on an OAuth connector panel in the desktop window.
3. If Atlassian still fails with a specific scope or audience error, pin `oauth.scopes` in `packages/service/src/connectors/entries/atlassian.ts` based on the live error code.

## Open questions

- Root cause of the owner's original Atlassian `Needs connecting` state (whether token exchange HTTP 4xx, Vault `Invalid`/locked, or post-sign-in `tools/list` 401/403) — answerable by running one live Atlassian sign-in now that the exact error stays visible.

## Sources

- Commit: `69723d9b` (`Fix connectors OAuth sign-in failure paths and apply Standards refactors (CHG-0785)`)
- Verification proof: `documentation/verification/2026-11-27-connectors-oauth-review-and-fixes.md`
- Changelog: `documentation/changelog/0.2.12-Pre-Alpha.md` (`CHG-0785`)
- Specification: `documentation/capabilities/connectors/specifications.md`
- Work in progress: `documentation/work-in-progress.md`
