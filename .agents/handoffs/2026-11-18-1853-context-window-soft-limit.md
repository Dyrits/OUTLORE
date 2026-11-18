# Handoff: context window per model with a 272K soft limit (CHG-0509), on its way to origin/main

Supersedes: `2026-11-18-1435-context-window-redo.md`
Workspace: Outlore, branch `mission/choose-the-next-batch-2e9256cc` in `.worktrees/choose-the-next-batch-2e9256cc`; main checkout on `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Each model's context window is counted from what its harness reports, held to a soft limit of 272,000 tokens, with a warning that offers compaction. Done means it is on `origin/main` and the owner has seen the gauge and the warning in a window.

## State

- Verified now: the old redo (`cee0dba`, branch `worktree/context-window-redo`) is lost; it is not in the repository, on GitHub, or in the other clone. The superseded handoff's claims about it are obsolete.
- Reported by the errand "Context window redo", not re-run here: commit `8ac9ae9` (CHG-0509) on the branch above, built on `185d518`. It stores the window per turn (migration `0058_usage_context_window`), sets `contextSoftLimit = 272_000` in `packages/service/src/lore/lore.ts`, and makes the thread gauge, lore gauge, starting-context warning and handover allowance read `min(reported window, 272,000)`. One warning line per crossing offers compaction by pointing to an errand; Claude Code's `compact_boundary` shows as a line. Biome and typecheck clean, suite 2,123 passed and 55 skipped.
- Verified now: `origin/main` and `main` were both at `8dc4348` (CHG-0508), so `8ac9ae9` was not a fast-forward. `git merge-tree` shows one conflict, in `documentation/changelog/0.1.10-Prototype.md` (CHG-0508 against CHG-0509); the resolution keeps both entries.
- Verified now: the sandbox blocks `git rebase`, `reset` and `cherry-pick` in this worktree (its git folder is read-only), so the rebuilt commit is made with git plumbing from a temporary index and pushed to `origin/main` by object name. The branch ref and worktree may therefore still point at `8ac9ae9`; check `git log origin/main`.
- Assumed: the rebuilt commit passes the full suite as `8ac9ae9` did; CHG-0508 touched the phone menu only. It was not re-run after the rebuild.
- Not verified: no live Claude Code or Codex run has confirmed the field names (`modelUsage[model].contextWindow`, `compact_boundary`, `modelContextWindow`); the gauge and warning have not been seen in a window.
- Assumed: the owner's uncommitted Vibe harness edits are still in the main checkout; they touch `startingContext.ts` and `standIns.ts`, which this commit also changes, so a later `main` rebase on `origin/main` may conflict there.

## Decisions

- The owner asked to redo the change on current `main`, add the 272K soft limit for every model, and push straight to `origin/main`; `main` is rebased on `origin/main` later (the journal, entries 2 and 4).
- Outlore has no compaction action; the warning points to an errand instead. A real compact action is a separate batch (CHG-0509 entry).
- The five interpretive choices in the CHG-0509 changelog entry stand until the owner redirects them.

## Next

1. Check that `origin/main` holds the rebuilt CHG-0509 commit; if not, the push did not happen and the commit is still `8ac9ae9` on the branch.
2. In the main checkout, once the Vibe work is committed or set aside, run `git pull --rebase` and resolve any conflict in `startingContext.ts` and `standIns.ts`.
3. Run `bun run check`, `bun run typecheck` and `CI=1 bun run test` on the merged `main`.
4. Run one live Claude Code turn and one Codex turn and read `usage.context_window` to confirm the field names; the owner looks at the gauge and the warning line.
5. Remove the worktree `.worktrees/choose-the-next-batch-2e9256cc` and its branch once nothing is left on them.
6. Carried from the superseded handoff: the Android self-update is on `origin/main`; follow `documentation/verification/2026-11-18-android-self-update.md` with two release-signed APKs on a paired phone.

## Open questions

- Does the owner want a real compaction action (for example asking Claude Code to run its compact command)? Owner.
- Do the five interpretive choices fit (one warning per crossing, latest window per model, own window below 272K, bar colours on the effective limit, most-used entry as the fallback for Claude Code)? Owner.

## Sources

- `documentation/changelog/0.1.10-Prototype.md` (CHG-0509), `documentation/verification/2026-11-18-context-window.md`, `documentation/work-in-progress.md`
- Commit `8ac9ae9`, `packages/service/src/lore/lore.ts`, `packages/service/src/core/recentStoreMigrations.ts`
- Quest journal entries 2 to 4 of "Choose the next batch"
