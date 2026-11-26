# Handoff: Missing own-copy notice and Fulfilled errand wake fix

Supersedes: none
Workspace: outlore (repository root, branch `main`, uncommitted on top of `4dfad808`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Fix two bugs that appear when an errand's own copy (git worktree under `.worktrees/`) is deleted while the realm folder still exists: (1) `MissingFolderNotice` falsely reported the realm folder as missing instead of the deleted own copy, and (2) marking one blocked errand Done woke another `Fulfilled` errand with a waiting message via `listThreadsWithPending`, flipping it back to `Attention` like a radio button.
Done means both fixes and their regression tests are cleanly committed and pushed to `origin/main` after workspace typecheck passes.

## State

- **Bug 1 fixed (verified: `missingFolder.test.ts`, `ownCopies.test.ts`, `biome check`):** `OwnCopyView` now includes optional `isMissing` (`packages/contracts/src/threadRecords.ts`, populated in `packages/service/src/work/missionDetail.ts`). `apps/app/src/realms/missingFolder.ts` (`missingFolderOf`) selects the realm path when `workspace.isMissing === true` and the own-copy path when the realm still exists and `ownCopy !== null`. `MissingFolderNotice` (`apps/app/src/realms/workspaces.tsx`) renders `"The own copy <path> no longer exists."` when `isOwnCopy` is true, and `apps/app/src/conversation/threadPane.tsx` also shows `" · own copy missing"` in the header subtitle.
- **Bug 2 fixed (verified: `ownCopies.test.ts` red before fix, green after fix):** `listThreadsWithPending` (`packages/service/src/work/pendingMessages.ts`) now excludes `'Fulfilled'` and archived threads (`t.archived_at IS NULL`), so sibling completions or `MarkThreadDone` never wake an already-`Fulfilled` errand back into `Attention`. `insertMessage` (`packages/service/src/work/messaging.ts`) moves a `Fulfilled` thread to `Resting` when a new non-conversation-only message is appended, so explicitly continuing a fulfilled errand still works even when waiting for a running slot.
- **Tests and lint (verified):** `ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron node_modules/vitest/vitest.mjs run packages/service/test/work/ownCopies.test.ts packages/service/test/work/workspaces.test.ts packages/service/test/work/backups.test.ts apps/app/test/realms/missingFolder.test.ts apps/app/test/conversation/terminalFolder.test.ts` passed (39/39 tests), and `biome check` passed on all 9 changed/added files.
- **Not yet committed or pushed (verified: `git status -s`):** The `main` checkout already had two other uncommitted workstreams when this fix was written — `CHG-0762` (dual-auth OAuth connectors) staged in the index, and first-message image display / lightbox unstaged in the working tree (sharing `packages/contracts/src/threadRecords.ts` and `packages/service/src/work/missionDetail.ts`). Nothing from this fix has been committed or pushed yet to avoid sweeping in those unrelated changes.
- **Workspace typecheck:** Not run yet (`bun run typecheck` takes ~4 minutes).
- **Quest `@quest:fadb056c-40fb-4556-aa38-24b2fd93000e` ("Debug duplicate @ mention results"):** Notified of the fix via thread message.

## Decisions

- **Keep `realFolderOf` unchanged:** The earlier hypothesis that `EACCES` in `realFolderOf` caused the false notice was disproved once the owner reported the deleted worktree after ENOSPC; `realFolderOf` is also used by `requireBrowsable`, where unreadable folders should stay rejected.
- **Use the glossary term "own copy" in the UI notice** (`documentation/glossary.md`, Own copy — avoid "worktree" in user-facing copy).
- **Keep `OwnCopyView.isMissing` optional** (`Schema.optionalKey(Schema.Boolean)`) for backwards compatibility with older hosts.
- **Continue `Fulfilled` threads in `insertMessage` rather than in `listThreadsWithPending`:** This separates explicit continuation (new message) from passive slot-freeing wakes (`wakeMission` / `listThreadsWithPending`), preventing the radio-button loop while keeping `maxRunning` queuing intact.

## Next

1. Settle with the owner how to land this fix alongside the two other uncommitted workstreams in the `main` checkout: either commit the other workstreams first, or apply only this fix's 9 files + this handoff in a clean worktree branched from `main` (`.worktrees/`).
2. Run `bun run typecheck` (background command, ~4 minutes) and commit with the attribution line `Google - Gemini 4 Neon` (or the committing model).
3. Request owner approval before pushing to `origin/main` (`git push --no-verify origin main`, as `.githooks/pre-push` guards `main`).

## Open questions

- Should this fix be committed in a separate clean worktree from `4dfad808`, or should it wait until the two other uncommitted workstreams on `main` (`CHG-0762` and first-message image/lightbox) are committed?

## Sources

- `packages/contracts/src/threadRecords.ts`
- `packages/service/src/work/missionDetail.ts`
- `packages/service/src/work/pendingMessages.ts`
- `packages/service/src/work/messaging.ts`
- `packages/service/test/work/ownCopies.test.ts`
- `apps/app/src/realms/missingFolder.ts`
- `apps/app/src/realms/workspaces.tsx`
- `apps/app/src/conversation/threadPane.tsx`
- `apps/app/test/realms/missingFolder.test.ts`
- `documentation/glossary.md` (Own copy)
- `documentation/capabilities/workspace-attachment/specifications.md` (Own copy, Missing folder)
