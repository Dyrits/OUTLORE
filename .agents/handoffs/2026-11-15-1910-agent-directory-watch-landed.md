# Handoff: Agent directory watch list, landed on main

Supersedes: `2026-11-15-1905-agent-directory-watch-commit.md`
Workspace: ISKIOS repository, main checkout `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS` on branch `main`. The change was committed in the task checkout `.worktrees/agent-directory-watch` (branch `worktree/agent-directory-watch`, commit `d6415a5`, base `3ba47a7`) and cherry-picked onto `main` as `a8982fc`.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Get the nine-product watch list and its research note onto `origin/main`, with the owner's approval for the push. Done means `git ls-remote origin refs/heads/main` shows the commit that adds this file, and `AGENTS.md` links this handoff.

## State

- **Verified 2026-11-15 19:10**: local `main` has `a8982fc` on top of `3ba47a7` (`git log --oneline -2`). That commit adds `documentation/inspirations.md` (70 lines) and `documentation/research/agent-directory-2026-11-15.md` (96 lines).
- **Verified**: before the cherry-pick, local `main` and `origin/main` were both `3ba47a7`.
- **Verified**: the main checkout's other uncommitted work is untouched. It is `apps/app/*`, `documentation/work-in-progress.md`, and the untracked mobile-navigation files. It belongs to another session. Do not stage or commit it.
- **Verified**: the pre-push guard, `.githooks/pre-push`, refuses any push to `main` or `master`, and to the default branch. A push of `main` therefore needs `--no-verify`, which AGENTS.md says only the owner may approve.
- **Requested, not yet known**: the owner's approval to run `git push --no-verify origin main`. Whether it landed is not verified by this file.
- **Verified**: `AGENTS.md` links this handoff under "Latest handoffs", replacing the line for `2026-11-15-1905`. The earlier file stays in the folder.
- **Assumed**: the research note's citations still match the pages read on 2026-11-15 (see its Sources).
- **Unverified, marked in the note**: the Grok Bot docs page returned 404; Noodle's sandbox mechanism and CopilotKit OpenBot's per-coworker isolation are secondary claims only.

## Decisions

- The watch entries say "Taken: none yet". No code is reused from the nine products, and their licences are recorded in the note.
- The commit went through the task checkout and cherry-pick, not the sync-tree route. That route stops when the target checkout has uncommitted changes, as the main checkout does.
- The owner asked for the push directly on `main`. Per the owner, main's other changes will be rebased later; that is not this task.
- The push bypasses the pre-push guard, so it needs the owner's explicit approval first (AGENTS.md, Tooling and Git).

## Next

1. Wait for the owner's answer to the approval request for `git push --no-verify origin main`. If it is allowed, run that exact command. If it is refused, leave the commits local and report that.
2. After the push, confirm with `git ls-remote origin refs/heads/main` that it equals `git rev-parse main`. Report the result either way.
3. The owner plans to rebase main's other changes later; not part of this handoff.
4. Keep the task checkout for review. Removing it needs a separate request.

## Open questions

- Muse Bot: no product by that name was found. The owner must give the link on the directory card (owner).
- OpenFuse: the repository is `CopilotKit/OpenMuse`, but its README calls the product OpenFuse. Check whether the repository was renamed (owner or the repository).
- agentes.chat: its site says AGPL and links the `agentes-chat` GitHub organisation. Confirm the repository and licence before taking any idea from it.
- Grok Bot: the launch post says both "own computer" and "share a computer"; the docs page returned 404. Check later.

## Sources

- Local commit `a8982fc` on `main`; task commit `d6415a5` on `worktree/agent-directory-watch`; base `3ba47a7`.
- Files: `documentation/inspirations.md`, `documentation/research/agent-directory-2026-11-15.md`.
- Hook: `.githooks/pre-push` (refuses protected branches `main` and `master`, and the default branch).
- Earlier handoff: `.agents/handoffs/2026-11-15-1905-agent-directory-watch-commit.md`.
- Quest journal entry #1.
- Governing rules: `AGENTS.md` (Handoffs, Tooling and Git, Approvals).
