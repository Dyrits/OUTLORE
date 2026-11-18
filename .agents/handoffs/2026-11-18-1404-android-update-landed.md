# Handoff: Android self-update landed on local main; worktrees cleaned up

Supersedes: `2026-11-18-1000-android-self-update.md`
Workspace: Outlore, main checkout, branch `main` (the worktree `.worktrees/android-update` still exists, at the same commit)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Bring the Android APK self-update (CHG-0460 specification, CHG-0461 implementation) into `main` and push it, remove the old worktrees whose work is already in the app, and leave one more unmerged branch (context window, CHG-0328) with a clear next step. Done means `origin/main` holds the Android work and the owner has checked an update on a phone.

## State

- Verified now: `main` is at `30faa7c`, two commits ahead of `origin/main` (`61b0c3f`): `5edb93d` (the specification) and `30faa7c` (the updater). Read with `git status -sb` and `git rev-parse`. Not pushed.
- Verified now: the two commits were rebased from `ffb370e` onto `61b0c3f`; `main` then fast-forwarded to them. After the rebase, in `.worktrees/android-update`: `bun run check` (Biome) clean, `bun run typecheck` passes on all seven workspaces, and `CI=1 bun run test` gave 259 files passed, 2,105 tests passed, 55 skipped (the sandbox skips the Seatbelt, pty and disk-image tests).
- Verified now: the rebase conflicts were documentation only (`AGENTS.md`, the changelog, `work-in-progress.md`). The Android agreement was numbered CHG-0454 in its first commit, a number `main` already uses for the phone's menu; the second commit renumbers it to CHG-0460, so the first commit's message still says CHG-0454 while the files say CHG-0460. The `AGENTS.md` pointer list keeps the three newest hand-offs by timestamp.
- Verified now: worktrees removed because their work is already in `main` (checked by the files and results in `main`, not by commit hash): `sidebar`, `sidebar-creation`, `voice-dictation`, `status-bar`, and the earlier refactor-review passes `rr-a`, `rr-b`, `rr-c`, `rr-e`, `rr-f`. Branches `worktree/sidebar`, `worktree/sidebar-creation` and `worktree/voice-dictation` were deleted (merged); the other branches were kept. The removed `rr-*` worktrees held untracked notes (coordination files, ledgers, `RR-F-FROZEN`); the owner approved discarding them.
- Verified now: `worktree/context-window` (`e00ffb2`, CHG-0328) is NOT in `main`: `main` still has the provisional `contextWindowOf = () => 200_000` in `packages/service/src/lore/lore.ts`. It is based on `c9cd372`, and rebasing onto `main` conflicts in 13 files (the harness, thread-panel, handover and migration code the refactor passes rewrote). The rebase was aborted; the branch is untouched.
- Verified now: `worktree/status-bar` (branch `171400c`, CHG-0448) is not an ancestor of `main`, but `main` has the files it adds (`apps/app/src/shell/appStatusBar.tsx`), so it is treated as integrated. Not diffed line by line.
- Assumed: the Android updater works on a phone. Not tried (see the verification record `documentation/verification/2026-11-18-android-self-update.md`).

## Decisions

- Land by rebase and fast-forward, with no merge commit. Reason: the sync procedure's default for diverged histories.
- Do not force the context-window work onto `main`. Reason: the conflicts need design choices in the harness code (migration number 0054 is cited in CHG-0453 as taken by this branch), not a mechanical resolution.
- Worktrees counted as old when `main` holds their result; commit hashes alone did not prove it, because the refactor passes were rebased and cherry-picked.

## Next

1. Get the owner's approval for the push (`main` is protected: `git push --no-verify origin main`), then check `git ls-remote origin main` against the local `main`.
2. Decide the context-window branch: re-implement CHG-0328 on the current `main` (a new worktree from `main`, reading `e00ffb2`'s diff as the guide), or drop it. Its migration (in `recentStoreMigrations.ts`) must take the next free number.
3. Remove `.worktrees/android-update` and `.worktrees/context-window` when their work lands (`git worktree remove` runs outside the sandbox).
4. Android: confirm the release signing secrets exist (without reading their values), then follow the verification record with two successive release-signed APKs on a paired phone.

## Open questions

- Re-implement or drop the context-window work? The owner decides.
- The first Android commit's message says CHG-0454 while its files say CHG-0460; rewrite it before the push, or leave it? The owner decides (rewriting changes the hash).
- Which version file do these entries belong in, `0.1.8-Prototype.md` or the next version's? The plan-ring hand-off raised the same question.

## Sources

- The commits: `5edb93d`, `30faa7c` on `main`.
- `documentation/capabilities/app-updates/specifications.md`, `documentation/capabilities/app-updates/draft.md`, `documentation/verification/2026-11-18-android-self-update.md`.
- `documentation/changelog/0.1.8-Prototype.md`, CHG-0460 and CHG-0461.
- The unmerged branch: `worktree/context-window` (`e00ffb2`), changelog entry CHG-0328 in `documentation/changelog/0.1.6-Prototype.md`.
- The previous hand-offs: `.agents/handoffs/2026-11-18-1000-android-self-update.md`, `.agents/handoffs/2026-11-18-1346-plan-ring-order.md`.
