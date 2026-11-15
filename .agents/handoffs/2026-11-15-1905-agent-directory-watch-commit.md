# Handoff: Agent directory watch notes, commit and push to main

Supersedes: none
Workspace: ISKIOS repository. Main checkout `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS` on branch `main` (3ba47a7). Task checkout `.worktrees/agent-directory-watch` on branch `worktree/agent-directory-watch`, base `3ba47a7`.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Land the nine agent-directory watch entries in `documentation/inspirations.md` and their research note on `main`, committed and pushed, with none of the other uncommitted changes in the main checkout. Done means both files are on `origin/main`, the push was approved by the owner, and the task checkout's return route is recorded (it already is; see Sources).

## State

- **Done, verified 2026-11-15 19:05**: `documentation/inspirations.md` in the task checkout has 70 added lines, under "Watch list from an agent directory (2026-11-15)" in "Agent workspaces and harnesses" (`git -C .worktrees/agent-directory-watch diff --stat`). Products: Hermes Agent, Grok Bot, agentes.chat, Codync, Bloks, Muse Bot (not identified), OpenFuse, Noodle, OpenBot (CopilotKit).
- **Done, verified**: `documentation/research/agent-directory-2026-11-15.md` is new and untracked in the task checkout. It cites the page each claim came from, checked 2026-11-15.
- **Verified**: the task branch's HEAD is `3ba47a7`, with nothing committed yet.
- **Verified**: the main checkout is at `3ba47a7`, the same commit as `origin/main` (fetched 2026-11-15 19:05). `git status` there shows uncommitted work from another session that is not part of this task: `apps/app/App.tsx`, `apps/app/src/conversation/conversation.tsx`, `apps/app/src/lore/lore.tsx`, `apps/app/src/settings/settings.tsx`, `apps/app/src/shell/{appScreen,chroniclerDock,dashboard,shell,topBar}.tsx`, `documentation/work-in-progress.md`, and untracked `apps/app/src/shell/mobileMenu.tsx`, `documentation/changelog/0.1.5-Prototype.md`, `documentation/verification/2026-11-15-mobile-navigation.md` and its folder. **Do not stage or commit these with this work.**
- **Verified**: quest journal entry #1 records this work (update_journal returned "Recorded entry 1").
- **Verified**: `AGENTS.md` now links this handoff under "Latest handoffs". To keep three linked, the Outlore rename handoff (`2026-11-15-1458-outlore-rename.md`) was dropped from that list. The file stays in the folder, and its thread still has open items (owner's look, tag approval, real update from Iskios).
- **Assumed**: the research note's citations still match the pages, which were read once on 2026-11-15.
- **Unverified, marked in the note**: the Grok Bot docs page (`docs.x.ai/grok-bot/overview.md`) returned 404, so the "shared computer" claim is secondary-only. Noodle's per-bot sandbox mechanism and CopilotKit OpenBot's per-coworker isolation are not stated on their pages; secondary reviews claim them, unverified.
- **Not committed**: this handoff file itself is in the main checkout, untracked.

## Decisions

- The watch entries say "Taken: none yet" and reuse no code from these nine products. All are ideas only, and license terms are recorded per product in the note.
- Research was done inline in the thread that wrote this, not in a background thread.
- The commit covers only `documentation/inspirations.md` and `documentation/research/agent-directory-2026-11-15.md`, plus this handoff and its `AGENTS.md` line if the owner agrees they belong with it. The owner's mobile-navigation work is excluded.
- Pushing code needs the owner's approval first (`AGENTS.md`, Approvals; pushing code is listed there). The pre-push hook refuses protected-branch pushes. Bypassing it with `git push --no-verify` needs the owner's approval before it runs.

## Next

1. Ask the owner, in plain words, for approval to push the two files (plus the handoff and `AGENTS.md` line if included) to `origin/main`. Name what it affects: everyone with access to the repository will see them. Do not push before the answer.
2. Commit in the task checkout: `git -C .worktrees/agent-directory-watch add documentation/inspirations.md documentation/research/agent-directory-2026-11-15.md`, then commit with a message such as "Add agent directory watch list to inspirations (2026-11-15)". End the commit message with the attribution line the session's reminder gives.
3. Bring that commit onto `main` without touching the other changes: from the main checkout, `git cherry-pick <sha>`. The two files are not dirty there, so it should apply. Afterwards run `git status` and confirm that only the other session's files remain uncommitted.
4. Commit this handoff and its `AGENTS.md` line on `main`, separately or in the same commit, once the owner says which.
5. Push `origin main` only after approval. If the pre-push hook refuses, stop and ask the owner before using `--no-verify`.
6. Keep the task worktree for review. Syncing, publishing a branch and removing the worktree need separate requests.

## Open questions

- Muse Bot: no product by that name was found. The owner must give the link on the directory card (owner).
- OpenFuse: the repository is `CopilotKit/OpenMuse`, but its README calls the product OpenFuse, and the clone command uses `OpenMuse.git`. The reason is unexplained; check whether the repository was renamed (owner or the repository).
- agentes.chat: the site says AGPL and links the `agentes-chat` GitHub organisation. Confirm the repository and license before any idea from it is taken.
- Whether the owner's uncommitted mobile-navigation work in the main checkout should be committed by its own session, not this one (owner).

## Sources

- Task checkout: `.worktrees/agent-directory-watch` (branch `worktree/agent-directory-watch`, base `3ba47a7`). Return route written in its git directory: `$(git -C .worktrees/agent-directory-watch rev-parse --absolute-git-dir)/return-destination`.
- Changed files: `documentation/inspirations.md` and `documentation/research/agent-directory-2026-11-15.md` in the task checkout.
- Primary pages read 2026-11-15: https://github.com/NousResearch/hermes-agent; https://raw.githubusercontent.com/leepokai/Codync/main/README.md; https://raw.githubusercontent.com/hamedgitty/bloks/main/README.md; https://github.com/CopilotKit/OpenMuse; https://github.com/pdparchitect/noodle; https://x.ai/news/introducing-grok-bot; https://agentes.chat; https://open.bot/; https://github.com/CopilotKit/OpenBot. Not reachable: https://docs.x.ai/grok-bot/overview.md (404).
- Quest journal entry #1.
- Governing rules: `AGENTS.md` (Handoffs, Tooling and Git, Approvals); `documentation/conventions.md` for code, not used here.
