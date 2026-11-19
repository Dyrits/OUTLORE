# Handoff: Connector security review fixes

Supersedes: `2026-11-19-1810-apple-permission-readiness.md`
Workspace: Outlore, branch `mission/connectors-composio-and-apple-apps-2aaf91f7`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Fix the three findings of the broader connector security review on the Charter errand branch, then hand the branch back for integration and the owner's live checks.

## State

- CHG-0542 fixes all three findings, verified by regressions that first failed against the unfixed or half-fixed code:
  - `httpMcp.ts` sends `redirect: "manual"` and refuses any redirect answer (class `Failed`, its own fixed words), so the key header can never be re-sent to another origin. Two real local servers prove 301, 302, 307 and 308 are refused and the target origin receives nothing.
  - `work/promptPolicy.ts` refuses a Grep or Glob whose search root — the `path` given, or the thread's folder when none is — is the Vault's folder or lies above it, through links (new `searchReachesVaultFolder` in `vault/folderAccess.ts`). The named-path rule for Read and NotebookRead is unchanged.
  - `vault/vault.ts` asks the denial probes afresh at every protection read (serialized on a semaphore, still never at service start); `refreshDenials` is removed from the Vault service and `VerifyClaudeVaultDenial` no longer calls it. A stand-in `claude` installed or upgraded mid-run is refused at the next storing.
- Checks run in the worktree sandbox, 2026-11-19: the 33 targeted tests over the three regressions pass; `bunx biome check packages/service packages/contracts` clean; `bun run typecheck` passes; the full suite (`TMPDIR=<repo>/.tmp-test CI=1 bun run test`) passes 2,444 tests, 66 skipped, 0 failed (307 files passed, 6 skipped). This run had none of the 28 known sandbox `git init` failures.
- The Apple permission work of CHG-0541 and the restart constraint recorded in `documentation/research/apple-automation-restart-2026-11-19.md` are unchanged.

## Decisions

- No redirect is followed, ever — same-origin included; a redirect fails as `Failed` with the adapter's own words, never the server's.
- Refusing an ancestor-rooted search costs a thread nothing ordinary: thread folders are siblings of the Vault's folder, and a rootless Grep or Glob stays allowed.
- Protection reads now start each installed harness's short probe again (a `--version`, and sandboxed marker reads for Codex and OpenCode) on every Vault section open and every storing; correctness was taken over that cost.
- When protection fails, existing secrets stay sealed and listed and every harness's sandbox settings still deny the folder; only new storings and key moves wait. Turn admission needs no Vault gate (no thread tool reaches the Vault), so none was added.

## Next

1. Merge the branch into the connector quest branch with the owner's approval; nothing is pushed and `main` is untouched.
2. The owner's live checks stay open: a real Composio key, the real macOS Automation prompt, the live Claude denial probe (`OUTLORE_LIVE_CLAUDE_PROBE=1 bun run test packages/service/test/vault/readDenialLive`), a real Keychain, and the Charter's look on a desktop window and a phone.
3. A TLS-downgrade redirect was not exercised against a live server (the mechanism — following no redirect at all — covers it), and no live Claude Code Grep/Glob traversal was run; both are recorded in the verification note.

## Open questions

- Whether Claude Code offers any other tool field or spelling that reaches files outside the checked `path` roots; the fix covers Grep, Glob, Read and NotebookRead as specified, verified against their input shapes only.

## Sources

- `documentation/verification/2026-11-19-connector-security-review.md`
- `packages/service/src/connectors/backends/httpMcp.ts`
- `packages/service/src/vault/folderAccess.ts`, `packages/service/src/work/promptPolicy.ts`
- `packages/service/src/vault/vault.ts`, `packages/service/src/work/vaultHandlers.ts`
- `packages/service/test/connectors/backends/httpMcp.test.ts`, `packages/service/test/vault/promptPolicy.test.ts`, `packages/service/test/work/vaultHandlers.test.ts`
