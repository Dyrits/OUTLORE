# Handoff: Android update on main (pushed), context-window redo waiting for the owner's merge

Supersedes: `2026-11-18-1404-android-update-landed.md`
Workspace: Outlore, main checkout, branch `main`; worktree `.worktrees/context-window-redo` on `worktree/context-window-redo`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Leave the repository with no stale worktrees: the Android self-update on `origin/main` (done), and the context-window work (CHG-0328, old branch) redone on the current `main` and merged by the owner. Done means the redo is merged, the old `worktree/context-window` worktree and branch are gone, and the owner has seen the gauge in a window.

## State

- Verified now: `main` and `origin/main` are both at `0bb3ebb` (read with `git rev-parse` and `git ls-remote origin main`). The Android work is in it as `76efc2d` (specification, CHG-0460) and `b4514e4` (the updater, CHG-0461), followed by a hand-off commit `7a67150` and a documentation commit `0bb3ebb`.
- Verified now: the first Android commit's title was reworded from CHG-0454 to CHG-0460 and `main` was force-pushed with the owner's approval (lease on `65341a0`). The files did not change. The superseded hand-off quotes the old hashes `5edb93d`, `30faa7c` and `65341a0`; read them as `76efc2d`, `b4514e4` and `7a67150`. The branch `worktree/android-update` still points at the old `30faa7c` (same files as `main`).
- Verified now: `worktree/context-window-redo` is at `cee0dba`, one commit on top of `main` (`0bb3ebb`), tree clean; the diff against `main` is 27 files, 346 insertions, 43 deletions. It adds migration `0058_usage_context_window` to `packages/service/src/core/recentStoreMigrations.ts` (0057 was the highest) and the changelog entry CHG-0501 in `documentation/changelog/0.1.9-Prototype.md`. Not merged, not pushed.
- Reported by the side-quest that built it, not re-run here: Biome clean (911 files), typecheck 7 of 7, full suite 2,115 passed and 55 skipped (`main` has 2,105 and 55) in the sandbox.
- Reported by that side-quest, not re-run here: each turn's usage stores the context window its harness reports (Claude Code `modelUsage[model].contextWindow`, Codex `modelContextWindow`); the thread's gauge, the lore gauge, the starting-context warning and the handover allowance read it; 200,000 stays until a harness has reported and for OpenCode; Claude Code's `compact_boundary` event shows as a line in the thread.
- Assumed: the field names match what the real harnesses send. They come from the old commit's probe and from stand-in processes, not from a live Claude Code or Codex run.
- Verified now: the old worktree `.worktrees/context-window` (branch `worktree/context-window`, `e00ffb2`) still exists and is untouched. The worktree list holds the main checkout, `context-window` and `context-window-redo`.
- Verified now: the GitHub release `0.1.8-Prototype` has new notes (the Android crash fix, the top bar, Code Mode, the voice-input first step, known issues); it is still a prerelease with its 8 files.
- Verified now: nine older worktrees were removed earlier (`sidebar`, `sidebar-creation`, `voice-dictation`, `status-bar`, `rr-a`, `rr-b`, `rr-c`, `rr-e`, `rr-f`) and `android-update` after it; their branches stay except the three merged ones deleted earlier.

## Decisions

- Owner chose to redo the context-window work on the current `main` and not drop it, and to rewrite the pushed Android commit's title and force-push `main`.
- The redo takes migration number 0058 and CHG-0501 because 0054 and CHG-0328 are taken on `main`.
- The redo is not merged or pushed until the owner says so (`main` is protected: a push needs the owner's approval and `git push --no-verify origin main`).

## Next

1. Ask the owner whether to merge `worktree/context-window-redo` into `main` (fast-forward: it sits on top of `main`). If so, `git merge --ff-only worktree/context-window-redo` in the main checkout, then get approval for the push.
2. After the merge, remove `.worktrees/context-window` and `.worktrees/context-window-redo` (`git worktree remove`, outside the sandbox) and decide whether to delete the branches `worktree/context-window`, `worktree/context-window-redo` and `worktree/android-update`.
3. The owner looks at the gauge in a window with a model that reports a larger window; a live Claude Code or Codex turn would confirm the field names.
4. Android: confirm the release signing secrets exist, then follow `documentation/verification/2026-11-18-android-self-update.md` with two successive release-signed APKs on a paired phone.

## Open questions

- Merge the redo now, or wait for the owner's look in a window?
- Does the changelog entry belong in `0.1.9-Prototype.md` (the redo's choice, since the newest tag is `0.1.8-Prototype`) while the CHG-0446 to CHG-0498 entries sit in `0.1.8-Prototype.md`? The plan-ring hand-off raised the same file question.

## Sources

- The redo: branch `worktree/context-window-redo`, commit `cee0dba`; `packages/service/src/lore/lore.ts` (`contextWindowOf`), `packages/service/src/core/recentStoreMigrations.ts` (0058), `documentation/changelog/0.1.9-Prototype.md` (CHG-0501), `documentation/capabilities/thread-panel/specifications.md` (the context gauge).
- The old change, as a reference: `e00ffb2` on `worktree/context-window`.
- Android: `76efc2d`, `b4514e4`; `documentation/capabilities/app-updates/specifications.md`; `documentation/verification/2026-11-18-android-self-update.md`.
- The superseded hand-off: `.agents/handoffs/2026-11-18-1404-android-update-landed.md`.
