# Handoff: Lighter worktrees

Supersedes: none
Workspace: OUTLORE, `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Make git worktrees take less disk space: new worktrees share their installed packages with the main checkout, and finished worktrees are removed.

## State

- `.agents/worktree-setup.sh` clones each `node_modules` folder with copy-on-write (`cp -cR` on macOS, `cp -a --reflink=always` elsewhere), then deletes `.gitmodules` and `.vscode` inside the clone, and falls back to the old `tar` copy when cloning fails.
- Verified by a run in a scratch repository under `$TMPDIR`: it printed "Packages cloned", left no `.gitmodules` or `.vscode`, and the symlinks and the `apps/app` and `packages/service` folders were intact. It took about 90 s, no faster than a copy; the gain is disk space.
- Verified by `git worktree list` at the end of the session: 14 worktrees remain under `.worktrees` (25 at the start, about 28 GB in total). Free space went from 3 GB (100 % used) to 26 GB (87 %).
- The deletions came from the owner's choice "clean and merged only". Most were removed by a process outside this session before the approved commands ran; only `toolbar-trailing-separator` was removed by this session.
- Assumed: 14 local branches already merged into main have no worktree left (`worktree/automatic-provider-install`, `companion-presets`, `desktop-voice-setup`, `in-pane-details`, `mention-icons`, `pane-notches`, `publish-pane-folding`, `quest-first-message`, `rebase-diffs`, `resume-after-background`, `ritual-menu-placement`, `sidebar-refresh`, `skill-tab-completion`, `skill-tab-landing`) plus `mission/update-during-running-turn-b6198594`. `worktree/antigravity-sign-in` is not merged.
- Remaining worktrees: `full-project-prune` (active quest), `re-document` (one commit not in main), `borderlands-push` (clean, only untracked `node_modules`), and ten with uncommitted changes to tracked files (`conversation-title-select`, `errand-header-actions`, `locate-file-diffs-1cce923a`, `pairing-direct-path`, `pane-focus-and-errand`, `pane-fold-controls`, `quest-access-panel`, `quest-placeholder`, the two `review-and-refactor-since-0-1-12-*`, `review-follow-through`).
- The clone shares data only as of the copy: a later `bun install` in the main checkout does not update existing worktrees.
- No changelog entry was written for the script change.

## Decisions

- git-twig is not adopted: it clones only tracked files (about 100 MB per worktree) and not ignored ones, while `node_modules` (about 1.1 GB) is the bulk. Dependencies are cloned by the script instead.
- Shared writable `node_modules` through hardlinks or symlinks is rejected, because it weakens isolation between worktrees.
- Worktrees with uncommitted changes are never removed without the owner's explicit decision.

## Next

1. Ask the owner whether to delete the 15 merged local branches listed in State (`git branch -d`, safe because they are merged).
2. For the ten worktrees with uncommitted changes, compare each change with main and report which are already contained, then ask the owner before removing any.
3. Ask whether to remove `borderlands-push`.
4. Add a changelog entry for the script change in the file of the release that ships it.

## Open questions

- Which process removed the worktrees outside this session, and whether it will remove more. The owner can answer.
- Whether worktrees should be re-cloned from the main checkout after its dependencies change.

## Sources

- `.agents/worktree-setup.sh`
- `AGENTS.md` (Tooling and Git section)
- `https://github.com/leostera/git-twig/blob/main/README.md`
