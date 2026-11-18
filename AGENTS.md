# Outlore

The app was called Iskios until CHG-0285; Iskios is now a theme. Dated records, ADRs, and the older handoffs keep the name they were written with, and the assistant was renamed Chronicler (`guildmaster` remains in code identifiers).

## Start here

Read [README.md](README.md) for the product overview, setup, commands, and repository layout.
When resuming work, read [work in progress](documentation/work-in-progress.md) first, then the relevant [handoff](#handoffs).
Work proceeds in batches with the iterate skill.

## Documents

Read the documents that apply to the task before making changes:

- Product or design work: [outline](documentation/outline.md) for purpose, actors, and capabilities.
- Design or technical choices: [requirements](documentation/requirements.md) for system-wide obligations.
- Naming: [glossary](documentation/glossary.md) for domain terms and their interface names; use its terms.
- Technical or structural changes: [architecture](documentation/architecture.md) for boundaries, flows, and how requirements are met.
- Reversing an architectural decision: read its [decision record](documentation/architecture-decision-record/); add a record for each new hard-to-reverse choice.
- Capability changes: read `documentation/capabilities/<capability>/specifications.md` for agreed behavior and acceptance.
- First-slice implementation or review: read [first-slice design](documentation/first-slice-design.md) and the relevant `documentation/capabilities/<capability>/blueprint.md`; settle the listed review decisions before production code.
- Choosing the next work: [backlog](documentation/backlog.md) for candidates and deferrals.
- Designing a capability covered by an inspiration: [inspirations](documentation/inspirations.md) for ideas adopted and follow-up checks; date new findings.
- Relying on what another product does, or designing a capability that an inspiration covers in depth: [research](documentation/research/) holds primary-source research notes (the product's own code and documents, each claim cited with path and commit); read the note for that product and topic, and add a new note there instead of settling a claim from a summary.
- Recording agreements or verified deliveries: append each to the file of the release it ships in, in the [changelog](documentation/changelog/) (one file per release, named by its version, such as `0.1.2-Prototype.md`; work after the newest tag goes in the next version's file, created with its first entry).
- Re-verifying a batch or relying on its claims: read its [verification evidence](documentation/verification/) and distinguish recorded results from checks run now.
- Proposing structural refactors: read previous [architecture audits](documentation/architecture-audit/).
- Writing or reviewing code: read [conventions](documentation/conventions.md).
- Changing `apps/app`: read [apps/app/AGENTS.md](apps/app/AGENTS.md) for Expo-specific rules.
- Writing Effect code: read `packages/service/node_modules/effect/AGENTS.md` completely for the installed version; search Effect's `src/` for APIs it does not cover.

## Tooling and Git

Read [.agents/ai-tooling.md](.agents/ai-tooling.md) before reinstalling or measuring AI tools, or recovering a session.
Use the root `package.json` for current commands and the README for setup.

Make a task's git worktree in `.worktrees/<name>` (git-ignored, on a `worktree/<name>` branch), never beside the checkout: a thread's sandbox writes its own folder, so a worktree beside it makes every command there ask the owner.
Then run `.agents/worktree-setup.sh` in it, which copies the installed packages without the files a sandbox cannot write (`bun install` fails there on `.gitmodules`).
Tests run inside a thread's sandbox with no `env -u` and no escape from it; the few that need what a sandbox withholds (Seatbelt, a terminal, a disk image, the process table) are skipped there and run on the owner's machine and in CI.

The [pre-commit hook](.githooks/pre-commit) runs Biome on staged files and runs the workspace typecheck when code or configuration is staged.
Fix reported issues and stage the corrected files again.

The [Git guard](.agents/hooks/guard-git.py) asks before, or blocks, pushes to `main`, commands that lose local work, and commands that skip a gate (`commit --no-verify`, `-c core.hooksPath`) or move a branch off its commits (`branch -f`).
The [pre-push hook](.githooks/pre-push) refuses protected-branch pushes and remote-ref deletion.
A person can approve a push to `main` with `git push --no-verify`; an agent must obtain the user's approval before bypassing the hook.

## Handoffs

Find session-specific context in [.agents/handoffs/](.agents/handoffs/), ordered by the timestamp in each filename.
Read the newest handoff for the task being resumed and check its claims against its sources and the current working tree.
Handoffs are shared and committed; preserve existing files and write a new handoff for later state.
When adding a handoff, keep only the three newest current handoffs linked below; older and superseded handoffs remain available in the folder.

Latest handoffs:

- To resume the sidebar's creation icons (CHG-0507, which removed the creation rows of CHG-0503 to CHG-0506; committed and pushed with this handoff; open: the owner's look in a window and on a phone, and an unrelated uncommitted `shell.tsx` change), read the [current handoff](.agents/handoffs/2026-11-18-1752-creation-icons.md). Handoffs are shared and committed.

- To resume the Android self-update (on `origin/main`; open: a phone check) and the context-window redo (`worktree/context-window-redo`, CHG-0501; open: the owner's merge and look), read the [current handoff](.agents/handoffs/2026-11-18-1435-context-window-redo.md). Handoffs are shared and committed.

- To resume the plan-limit rings' order fix (CHG-0500; committed; push waiting for the owner's approval; open: the owner's look at the rings in a window), read the [current handoff](.agents/handoffs/2026-11-18-1346-plan-ring-order.md). Handoffs are shared and committed.
