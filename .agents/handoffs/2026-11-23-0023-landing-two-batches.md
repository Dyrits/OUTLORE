# Handoff: Landing the quest's two batches

Supersedes: none
Workspace: Outlore, `mission/outlore-next-batch-0b321042`, starting revision `7026ce8769b84ede53046aab2e51e6ce52da17b6`.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Land the quest's two rejected-loss and New-realm batches on `main` and close their outstanding reviews. Done looks like: both commits on `origin/main`, the changelog carrying CHG-0642 and CHG-0645 each once, and the desktop window reviews recorded where the owner performed them.

## State

- Verified by pushed refs after the landing push: CHG-0642 (Preserve interrupted Codex messages) and CHG-0645 (New realm sources) sit on `origin/main` as commits `1c1ac15b` and `fa89b327` (or their later renumbered equivalents if another rebase intervened). Check `git log origin/main` before building on them.
- Verified locally before pushing: workspace `bun run typecheck` green, `bun run check` clean, and the 62 focused tests of both batches green on the combined tip `fa89b327` (39 interrupted-message tests in `packages/service/test/harness/codex.test.ts` plus `steering` and `replayAndHistory`, and the realm tests in `packages/service/test/work/realmRepositories.test.ts` and `apps/app/test/realms/`).
- Verified in the branch tree: the changelog reads CHG-0640 (check-in admission), CHG-0641 (Chronicle source types), CHG-0643 (Ritual form), CHG-0644 (remote terminals), then CHG-0642 and CHG-0645 from this quest, each number once.
- Assumed, not yet done: the desktop live-turn interrupt check (handoff `2026-11-22-2140`) and the New-realm chooser window review (handoff `2026-11-22-2144`). Both need a real desktop window or paired device, so they are the owner's by-hand checks.
- Local `main` in the primary checkout was left untouched (it holds another session's uncommitted work and stays behind `origin/main` until that session pulls `--ff-only`).

## Decisions

- The batches are committed per contributor: CHG-0642 authored with the repo-configured identity and the `Z.ai - GLM-5.3` attribution line; CHG-0645 authored as `Claude Sonnet 5.5 <noreply@anthropic.com>` with the `Anthropic - Claude Sonnet 5.5` attribution line. No cross-author squash was made.
- Renumbering happened three times because concurrent quests landed CHG-0640, CHG-0641, CHG-0643, and CHG-0644 while approval was pending; the final numbers CHG-0642 (kept, unclaimed on main) and CHG-0645 (next free) are recorded in the changelog, the workspace-attachment specification, the work-in-progress file, and the verification record.
- Landing used one fast-forward push of the stacked branch (`mission/outlore-next-batch-0b321042:main`) with `--no-verify`, after the owner's explicit approval in the quest; `git merge-base --is-ancestor origin/main <branch>` was verified so `main` was never force-replaced.

## Next

1. If the push in State is absent, stop: land the stacked branch instead of building on the worktrees.
2. Have the owner run the desktop live-turn interrupt check and record its outcome against `documentation/verification/2026-11-22-interrupted-codex-messages.md`.
3. Have the owner review the New-realm chooser in the desktop window and on a paired device, then record the outcome against `documentation/verification/2026-11-22-new-realm-sources.md`.
4. Clear the two window-review lines from `documentation/work-in-progress.md` once the reviews pass.
5. The two worktrees (`.worktrees/outlore-next-batch-3e6266c7`, `.worktrees/outlore-next-batch-0b321042`) can be removed once the reviews are closed; their branches are already on `main`.

## Open questions

None blocking. Whether the first release supports one verified Companion for daily background check-ins or several from day one remains open in the check-ins thread (handoff `2026-11-22-2153`), not this one.

## Sources

- Branches: `mission/outlore-next-batch-3e6266c7` (CHG-0642) and `mission/outlore-next-batch-0b321042` (CHG-0645), both based on `main` at `dc056290`.
- Changelog: `documentation/changelog/0.2.2-Pre-Alpha.md`, entries CHG-0642 and CHG-0645.
- Verification: `documentation/verification/2026-11-22-interrupted-codex-messages.md` and `documentation/verification/2026-11-22-new-realm-sources.md`.
- Handoffs by thread: `2026-11-22-2140-interrupted-codex-messages.md`, `2026-11-22-2144-new-realm-sources.md`.
- Specification: `documentation/capabilities/workspace-attachment/specifications.md` and `documentation/capabilities/thread-messaging/specifications.md`.
