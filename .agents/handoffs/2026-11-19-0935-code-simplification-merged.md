# Handoff: code simplification, merged into main

Supersedes: `2026-11-19-0900-code-simplification.md`
Workspace: repository `OUTLORE` (`/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`), branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

A behavior-preserving simplification of the whole codebase against `documentation/conventions.md` (CHG-0529). Done when the 28 sandbox-only test failures are seen to pass on the owner's machine.

## State

- **Verified now:** commit `7880ab0` ("Simplify the codebase: shared helpers, smaller files, no single-letter names") is on `main` and on `origin/main`; the branch `code-simplification` that carried it is deleted locally and on GitHub. What the commit changed is in CHG-0529 (`documentation/changelog/0.1.12-Prototype.md`) and in the superseded handoff's State, which still holds.
- **Branch clean-up (done at the owner's request):** 28 local branches already merged into `main` are deleted, and so are `code-simplification` and `worktree/android-apk` on GitHub. Kept on the owner's choice, because they hold commits that `main` lacks: 23 local branches (`worktree/rr-*` except `rr-a`, `rr-f`, `rr-g` and `rr-integration`, plus `android-self-update`, `effort-title-case`, `worktree/agent-directory-watch`, `worktree/android-update`, `worktree/status-bar`, and the three live worktrees `worktree/bundled-voice`, `worktree/context-window`, `worktree/context-window-redo`), `worktree/stop-button`, and the stale tracking ref `origin/worktree/stop-button`, which holds 2 commits found nowhere else (the branch is no longer on GitHub; do not run `git fetch --prune` before saving them).
- **Not done:** the stale tracking refs `origin/installed-app-and-review-fixes` and `origin/one-side-panel` remain locally (both already merged; GitHub no longer has them). Deleting a branch left `branch.<name>` sections in `.git/config`, because the sandbox cannot lock that file; they are harmless.
- **Assumed:** that the app and desktop windows behave as before; the 28 failing tests were not run on the owner's machine.

## Decisions

- Branches with commits not in `main` are kept until the owner says otherwise.
- Pushes to `main` and deletions on GitHub went through `--no-verify` with the owner's approval each time.

## Next

1. Run the full suite on the owner's machine and confirm the 28 failures pass.
2. Ask the owner which of the kept branches still matter, and save the 2 commits behind `origin/worktree/stop-button` before pruning.
3. Optionally continue with the 40 files over 256 lines, the largest first: `shell.tsx`, `codex.ts`, `threadTools.ts`, `questPanel.tsx`.

## Open questions

- Which kept branches can go? The owner decides.

## Sources

- `documentation/changelog/0.1.12-Prototype.md` (CHG-0529).
- `.agents/handoffs/2026-11-19-0900-code-simplification.md`.
- `git branch -vv`, `git branch -r`, `git log main`.
