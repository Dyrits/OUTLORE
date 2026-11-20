# Handoff: worktree cleanup

Supersedes: none
Workspace: Outlore, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Remove redundant Git worktrees while preserving local edits that may still be needed.

## State

- Verified with `git branch --no-merged main` that every local branch tip was reachable from `main` at `bc9a0110`.
- Verified with `git worktree list` and `git worktree prune --dry-run --verbose` that the approved removals of `publish-pane-folding` and `quest-first-message` left no stale worktree registrations.
- Verified before removal that `publish-pane-folding` was clean and that `quest-first-message` had its service code and tests on `main`, its specification edits incorporated, and an identical CHG-0572 changelog entry.
- Verified with `git status --porcelain=v1 --untracked-files=all` in each checkout that five worktrees still have local edits: `conversation-title-select` (5 paths), `errand-header-actions` (9), `pane-focus-and-errand` (11), `pane-fold-controls` (9), and `quest-access-panel` (5).

## Decisions

- Keep the five edited checkouts until their local changes are reconciled or the owner approves discarding them.
- Retain the merged local branch refs for both removed checkouts.

## Next

1. Recheck the five worktrees with `git worktree list` and per-worktree `git status --porcelain=v1 --untracked-files=all`.
2. Compare each worktree's tracked diff and untracked files against current `main`, starting from its own HEAD so later changes on `main` are distinguishable from local edits.
3. Preserve any useful local changes and get approval for each destructive removal before executing it.

## Open questions

Which remaining local changes are already incorporated or superseded, and which should be kept?

## Sources

- Git history at `bc9a0110` and the five checkouts under `.worktrees/`.
- [CHG-0572 changelog](../../documentation/changelog/0.1.13-Prototype.md#chg-0572--2026-11-20--quest-composer-messages-stay-in-the-quest)
