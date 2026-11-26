# Handoff: Missing own-copy notice and Fulfilled wake fix, landed

Supersedes: `2026-11-26-1515-missing-own-copy-and-fulfilled-wake.md`
Workspace: outlore (repository root, branch `main`, landed on `origin/main`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Fix the two bugs that appear when an errand's own copy (git worktree under `.worktrees/`) is deleted while the realm folder still exists: the missing-folder notice falsely blaming the realm folder, and marking one blocked errand Done unmarking a `Fulfilled` sibling like a radio button.
Done means both fixes and their regression tests committed and pushed to `origin/main` with the workspace typecheck passing — reached.

## State

- **Landed (verified: `git log origin/main` after a fetch, 2026-11-26 16:13):** commit `e667e866` "Name a deleted own copy in the missing-folder notice and stop waking fulfilled errands (CHG-0764)" is the head of `origin/main`, parent `03081bc4`.
- **Fix content (verified: `git show e667e866` read this session):** the nine code and test files the superseded handoff staged, that handoff itself, the AGENTS.md handoff links, and the CHG-0764 entry in `documentation/changelog/0.2.10-Pre-Alpha.md`. The pushed hunks match the superseded handoff's staged diff; the one change beyond it is next.
- **The insertMessage write is guarded on the thread's state (verified red/green):** the superseded handoff's `insertMessage` change wrote the `threads` row (`Fulfilled` to `Resting`) on every non-conversation-only message; an unguarded zero-row write during a running turn broke three `gatewayCalls.test.ts` tests, letting a connector tool switched off in that turn run again. The write now happens only when the thread really is `Fulfilled` (the state arrives from the query insertMessage already ran), and the three tests pass.
- **Verification (verified this session):** 85 tests green (`gatewayCalls.test.ts` 46 plus the fix's `ownCopies`, `workspaces`, `backups`, `missingFolder`, `terminalFolder`), Biome clean on the changed files, and the commit gate (Biome, workspace typecheck, 301 related test files) passed on the pushed tree.
- **AGENTS.md:** this handoff records the goal as done, so this thread's line is removed from AGENTS.md rather than pointed here; the handoff file stays in `.agents/handoffs/`, and this quest's journal carries the state too.
- **Not verified:** the notice texts in a running desktop window; the tests cover the strings, not the look.

## Decisions

- **Guard the `insertMessage` write rather than drop the Fulfilled-to-Resting continuation:** continuing a fulfilled errand with a new message is the fix's other half, and a guarded write behaves as no write for every ordinary message. Recorded in the commit's code comment and the changelog entry.
- **The fix commit's attribution line reads `Google - Gemini 4 Neon`:** the fix was written in a Gemini session, as the superseded handoff planned; the landing session is named in the Co-Authored-By lines.
- **The pushes used `git push --no-verify`:** the pre-push hook refuses protected-branch pushes by design, and the owner approved the pushes in the conversation.

## Next

1. None: the goal is reached and verified on `origin/main`. Two small follow-ups exist if the owner wants them, neither part of this thread: a line for the own-copy notice in `documentation/capabilities/workspace-attachment/specifications.md` (its Missing folder section covers the workspace folder), and the first-message image / lightbox work's own changelog entry (commit `c1260746` has none).

## Open questions

- Whether the local `main` checkout's reconciliation finishes cleanly: another session was mid-merge there at 16:13 with duplicate-content stashes (`git stash list` shows them); nothing in this thread blocks on it, and the owner or that session can answer.

## Sources

- Commit `e667e866` on `origin/main` (CHG-0764) and its parent `03081bc4`.
- `documentation/changelog/0.2.10-Pre-Alpha.md`, entry CHG-0764.
- `2026-11-26-1515-missing-own-copy-and-fulfilled-wake.md` (superseded).
- `documentation/capabilities/workspace-attachment/specifications.md` (Missing folder, Own copy).
- `packages/service/test/connectors/gatewayCalls.test.ts` (the three mid-turn switch-off tests).
- `packages/service/src/work/messaging.ts`, `packages/service/src/work/pendingMessages.ts`, `packages/service/src/work/missionDetail.ts`, `packages/contracts/src/threadRecords.ts`, `apps/app/src/realms/missingFolder.ts`, `apps/app/src/realms/workspaces.tsx`, `apps/app/src/conversation/threadPane.tsx`, `apps/app/test/realms/missingFolder.test.ts`, `packages/service/test/work/ownCopies.test.ts`.
