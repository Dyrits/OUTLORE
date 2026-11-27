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
- Settling an open capability decision: read its `draft.md` under [capabilities](documentation/capabilities/).
- First-slice implementation or review: read [first-slice design](documentation/first-slice-design.md) and the relevant `documentation/capabilities/<capability>/blueprint.md`; settle the listed review decisions before production code.
- Choosing the next work: [backlog](documentation/backlog.md) for candidates and deferrals.
- Designing a capability covered by an inspiration: [inspirations](documentation/inspirations.md) for ideas adopted and follow-up checks; date new findings.
- Relying on what another product does, or designing a capability that an inspiration covers in depth: [research](documentation/research/) holds primary-source research notes (the product's own code and documents, each claim cited with path and commit); read the note for that product and topic, and add a new note there instead of settling a claim from a summary.
- Recording agreements or verified deliveries: append each to the file of the release it ships in, in the [changelog](documentation/changelog/) (one file per release, named by its version, such as `0.1.2-Prototype.md`; work after the newest tag goes in the next version's file, created with its first entry).
- Re-verifying a batch or relying on its claims: read its [verification evidence](documentation/verification/) and distinguish recorded results from checks run now.
- Proposing structural refactors: read previous [architecture audits](documentation/architecture-audit/).
- Revisiting security findings: read the dated [security audit](documentation/security-audit/).
- Revisiting visual directions or source artwork: read the [art direction boards](documentation/art-direction/) and [brand notes](documentation/brand/README.md).
- Reproducing the README screenshots and GIFs: read the [recording guide](documentation/readme/recording/README.md).
- Updating a vendored connector server: read the [vendor guide](packages/service/vendor/README.md) for its pinned source and build.
- Writing or reviewing code: read [conventions](documentation/conventions.md).
- Changing `apps/app`: read [apps/app/AGENTS.md](apps/app/AGENTS.md) for Expo-specific rules.
- Writing Effect code: read `packages/service/node_modules/effect/AGENTS.md` completely for the installed version; search Effect's `src/` for APIs it does not cover.

## Tooling and Git

Read [.agents/ai-tooling.md](.agents/ai-tooling.md) before reinstalling or measuring AI tools, or recovering a session.
Use the root `package.json` for current commands and the README for setup.

Make a task's git worktree in `.worktrees/<name>` (git-ignored, on a `worktree/<name>` branch), never beside the checkout: a thread's sandbox writes its own folder, so a worktree beside it makes every command there ask the owner.
Then run `.agents/worktree-setup.sh` in it, which copies the installed packages without the files a sandbox cannot write (`bun install` fails there on `.gitmodules`).
Tests run inside a thread's sandbox with no `env -u` and no escape from it; the few that need what a sandbox withholds (Seatbelt, a terminal, a disk image, the process table) are skipped there and run on the owner's machine and in CI.

The [pre-commit hook](.githooks/pre-commit) runs Biome on staged files, runs the workspace typecheck when code or configuration is staged, and runs related tests when TypeScript is staged.
Fix reported issues and stage the corrected files again.

Every commit message ends with a standalone attribution line naming the provider and model that wrote it, in the form `<Provider> - <Model>`, such as `Mistral - Z.ai GLM 5.3` or `Anthropic - Claude Sonnet 5.5` (owner, 2026-11-21).

The [Git guard](.agents/hooks/guard-git.py) asks before, or blocks, pushes to `main`, commands that lose local work, and commands that skip a gate (`commit --no-verify`, `-c core.hooksPath`) or move a branch off its commits (`branch -f`).
The [pre-push hook](.githooks/pre-push) refuses protected-branch pushes and remote-ref deletion.
A person can approve a push to `main` with `git push --no-verify`; an agent must obtain the user's approval before bypassing the hook.

## Handoffs

Find session-specific context in [.agents/handoffs/](.agents/handoffs/), ordered by the timestamp in each filename.
Read the newest handoff for the task being resumed and check its claims against its sources and the current working tree.
Handoffs are shared and committed; preserve existing files and write a new handoff for later state.
When adding a handoff, keep only the three newest current handoffs linked below; older and superseded handoffs remain available in the folder.

Latest handoffs:

- To resume Companion answer frames, in-frame follow-ups, opt-in context, the side-chat jump menu, and usage-limit refusal by model group (CHG-0786, CHG-0787, CHG-0788 with the Standards and Specifications review fixes; live desktop and phone check and a live Antigravity turn remaining), read the [current handoff](.agents/handoffs/2026-11-27-1220-companion-frames.md). Handoffs are shared and committed.

- To resume quest tab switching dropping stale Errands list requests (fixed in `paneSession.ts` at `fab6138b` with regression tests and reproduced proof; live desktop check C4 and deferred `SPEC-1` realm-switch channel `listRequest` follow-up remaining), read the [current handoff](.agents/handoffs/2026-11-27-1138-quest-tab-list-request.md). Handoffs are shared and committed.

- To resume connectors OAuth sign-in fixes, Standards refactors, and specification updates (CHG-0785: all 25 Standards findings, OAuth failure-path fixes, UI refresh/Cancel, and spec updates committed on `main` at `69723d9b`; live Atlassian sign-in and desktop Cancel check pending), read the [current handoff](.agents/handoffs/2026-11-27-1133-connectors-oauth-review-and-fixes.md). Handoffs are shared and committed.

