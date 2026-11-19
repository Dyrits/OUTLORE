# Verification: the four connectors branches merged into one (CHG-0542)

- **Work:** CHG-0542, on the branch `mission/connectors-composio-and-apple-apps-cd1b5543`, made from `main` at `8d4b767`; merge commits `2f99671` (Vault + gateway + join, branch `-02a36299`), `e6a287c` (HTTP backend, branch `-2f728664`) and `2c42485` (stdio backend, branch `-74a0ea1f`), then the renumbering, the one backends layer, the new test and the documents. Not pushed; `main` untouched.
- **Environment:** macOS, inside a thread's sandbox, with `TMPDIR=<repo>/.tmp-test` (no space) and `CI=1`.
- **Verdict:** the three branches merge with the conflicts resolved as described in the changelog entry; the service's default wiring (the real Vault, `connectorBackendsLayer`) reaches an HTTP connector and a stdio connector in one turn. What the merge did not touch was not rerun beyond the full suite below.

## Recorded results

| Claim | Where it is checked | Result |
| --- | --- | --- |
| One `connectorBackendsLayer` opens `httpMcp` for an Http entry and `stdioMcp` for a Stdio entry; with no backends and no Vault handed in, the service stores a key through `PutSecret`, installs both connectors, a turn is offered both tools and a call of each reaches its server | `packages/service/test/connectors/defaultWiring.test.ts` (1 test; a real local fake Connect endpoint, the stand-in MCP server process, the real Vault on a temporary folder, an in-memory key holder, a disposable secret) | Passed |
| The key reaches the HTTP server in the entry's header on every request, never the stdio child's log, and is in no file of the service | same test | Passed |
| The HTTP adapter's own tests still pass over the one layer (it now comes from `defaultBackends.ts`) | `test/connectors/backends/httpMcp.test.ts` | Passed (in the full suite) |
| Biome | `bunx biome check` over `packages`, `apps` and `documentation` | Clean |
| Types | `bun run typecheck` | Passes on all workspaces |
| Whole suite | `TMPDIR=<repo>/.tmp-test CI=1 bun run test` | 2,387 passed, 66 skipped, 28 failed (308 files: 296 passed, 6 failed, 6 skipped) |

## The 28 failures

All 28 are in six files this merge does not change (`harness/worktrees`, `harness/claudeWorktrees`, `work/folderPicker`, `work/approvalsFolders`, `work/ownCopies`, `work/workspaceEntries`; the merge diff touches none of them). Each starts with `git init` and fails with `fatal: cannot copy '/Library/Developer/CommandLineTools/usr/share/git-core/templates/hooks/commit-msg.sample' ... Operation not permitted`; a plain `git init` in the test folder fails the same way in this thread's sandbox, so the cause is the sandbox, not the code. They pass on the owner's machine and in CI (CHG-0529's handoff records the same 28). The `hdiutil` test in `apps/desktop/test/updates/swap.test.ts` ran here with 4 passed and 2 skipped, so there was no other failure.

The 66 skipped are tests that need what this sandbox withholds (Seatbelt, a terminal, the process table, live harnesses, the opt-in live probes): `vault/readDenial` 7, `vault/readDenialLive` 2, `harness/openCodeSeatbelt` 9, `openCodeLinks` 6, `claudeLive`, `liveHarnesses`, `openCodeSeed`, `processTree` 5 each, `apps/desktop/test/terminals` 4, and a few in other files.

## What was not checked

- The real Composio server (no key held), whether it answers a stateless `tools/list`.
- The real macOS Automation prompt and which program macOS names (Apple Events are blocked in a sandbox).
- A live Claude Code turn for the denial stamp (`OUTLORE_LIVE_CLAUDE_PROBE=1 bun run test packages/service/test/vault/readDenialLive`), a real Keychain.
- The packaged app's launch with the vendored Apple server (DMG and the packaged-app gate run in the owner's terminal).
- Windows and Linux hosts, a phone, every screen.
- That a harness lists its tools when its process starts (the gateway's assumption), on a live harness.
