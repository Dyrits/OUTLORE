# Proof: Quest tab switching drops stale Errands list requests

- **Verdict:** not proven (C1–C3 proven at the pane session state-machine seam; C4 awaiting human judgment in the live desktop window)
- **Work:** working tree on `743f7690` (starting commit `42b7d4b0`; shipped paths `apps/app/src/shell/paneSession.ts`, `apps/app/test/shell/paneSession.test.ts`)
- **Agreement:** Owner's report of 2026-11-27 (switching from quest Y on Missives to quest X and back should stay on Missives instead of reopening Errands) and `documentation/capabilities/conversation-panes/specifications.md` ("The three levels", CHG-0774).
- **Environment:** macOS, Electron `45.4.1` (`ELECTRON_RUN_AS_NODE=1`), Vitest `5.1.1`, Bun `1.4.4`, TypeScript `~6.0.3`, Biome `2.6.8`.
- **Date:** 2026-11-27

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | Switching from a quest that previously had an Errands `listRequest` to another quest and back leaves `listRequest` as `null`, so the returned quest does not reopen Errands over the remembered tab. | Owner's request (2026-11-27) and `specifications.md` (CHG-0774) | proven |
| C2 | A channel's `Quests` `listRequest` (`{ id: channelId }`) is kept across quest initialization while `channelId` stays in the chain. | `usePaneChain.ts` mount/quest effects and `specifications.md` | proven |
| C3 | Opening a Chronicle target clears any stale `listRequest`, so the quest opens on Missives. | `specifications.md` ("a quest opened from a Chronicle message opens on Missives") | proven |
| C4 | In the live desktop window, switching from quest Y (on Missives) to quest X (after a prior Errands list request) and back stays on Missives. | Owner's request (2026-11-27) | awaiting human judgment |

## Evidence

### C1: Switching quests clears a stale Errands `listRequest`

- **Check:** `CI=1 bun run test apps/app/test/shell/paneSession.test.ts` (test `"drops a stale Errands list request when switching quests so returning to the first quest does not reopen Errands"`).
- **Shown able to fail:** Ran the test file in a detached worktree at starting commit `42b7d4b0` (`.worktrees/verify-quest-tab`): failed with `AssertionError: expected { id: 'first-quest' } to be null` (exit code 1).
- **Result:** Passed on end state (`11 passed (11)`, exit code 0).
- **Reproduced:** Fresh-context errand `3e25e905-1c04-4511-a3af-c608cde1e897`; matched (exit code 0, 11 passed).

### C2: Channel `Quests` `listRequest` survives quest initialization in the same chain

- **Check:** `CI=1 bun run test apps/app/test/shell/paneSession.test.ts` (test `"keeps a channel Quests list request across quest initialization while the channel stays in the chain"`).
- **Shown able to fail:** Mutated `listRequest: listRequest?.id === channelId ? listRequest : null` to `listRequest: null` in the temporary verification worktree: failed with `AssertionError: expected null to deeply equal { id: 'channel' }` (exit code 1).
- **Result:** Passed on end state (`11 passed (11)`, exit code 0).
- **Reproduced:** Fresh-context errand `3e25e905-1c04-4511-a3af-c608cde1e897`; matched (exit code 0, 11 passed).

### C3: Opening a Chronicle target clears any stale `listRequest`

- **Check:** `CI=1 bun run test apps/app/test/shell/paneSession.test.ts` (test `"clears a stale list request when opening a Chronicle target"`).
- **Shown able to fail:** Ran the test file in the detached worktree at starting commit `42b7d4b0`: failed with `AssertionError: expected { id: 'quest' } to be null` (exit code 1).
- **Result:** Passed on end state (`11 passed (11)`, exit code 0).
- **Reproduced:** Fresh-context errand `3e25e905-1c04-4511-a3af-c608cde1e897`; matched (exit code 0, 11 passed).

### C4: Live desktop window quest-to-quest tab persistence

- **Check:** Open the desktop window, trigger quest X's Errands list via an errand title or notch, switch quest X to Missives, switch to quest Y on Missives, then switch back to quest X and confirm it lands on Missives.
- **Shown able to fail:** Not run (no live desktop UI automation harness is available in this session).
- **Result:** Not run; awaiting human check in the desktop window.
- **Reproduced:** Not run.

## Regressions

| Check | Command | Starting commit | End state |
| --- | --- | --- | --- |
| Pane session unit tests | `CI=1 bun run test apps/app/test/shell/paneSession.test.ts` | fail (2 new tests fail as expected) | pass (11 passed) |
| App unit test suite | `CI=1 bun run test apps/app` | not run | pass (129 files, 1,054 passed, 6 skipped) |
| App typecheck | `bun run --filter app typecheck` | not run | pass (3.46 s, exit 0) |
| Biome lint and format | `bunx biome check apps/app/src/shell/paneSession.ts apps/app/test/shell/paneSession.test.ts` | not run | pass (2 files, 0 errors) |

## Not proven

- **C4 (awaiting human judgment):** The app has no live desktop window UI test harness; automated tests cover the `paneSessionOf` state machine and `initialQuestTabOf` pure rule only. Confirming the visual/interactive transition requires running the desktop app and repeating the quest Y ↔ quest X switch after an Errands list request.

## Reproduce

```sh
bunx biome check apps/app/src/shell/paneSession.ts apps/app/test/shell/paneSession.test.ts
CI=1 bun run test apps/app/test/shell/paneSession.test.ts
CI=1 bun run test apps/app
bun run --filter app typecheck
```

## New files

- `documentation/verification/2026-11-27-quest-tab-list-request.md`
