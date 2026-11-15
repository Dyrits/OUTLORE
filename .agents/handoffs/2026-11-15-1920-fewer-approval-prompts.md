# Handoff: Fewer sandbox approval prompts, rebased onto origin/main

Supersedes: none
Workspace: ISKIOS repository, task checkout `.worktrees/fewer-approval-prompts` (branch `worktree/fewer-approval-prompts`, three commits), rebased twice: first onto `origin/main` `3825f9c`, then onto `8458902` after a first push was rejected because `origin/main` had moved (mobile navigation as CHG-0292, Dock bounce as CHG-0293 landed there).

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Stop the owner being asked "Run outside the sandbox" all the time: make the test suite and commits run inside the sandbox (CHG-0294), and add an owner-only setting that lets commands leave the sandbox without a question (CHG-0295). Done means both are on `origin/main`, Outlore is rebuilt, and the owner sees fewer questions in a live thread.

## State

- **Verified 2026-11-15 19:25**: the branch is three commits on top of `8458902`: the suite in the sandbox (CHG-0294), the setting (CHG-0295), and this handoff. Both entries were renumbered from CHG-0292/0293 because `origin/main` already used those numbers; the changelog entries, the verification record, the specification and three code comments carry the new numbers. The old tips are in `refs/rebase-backup/fewer-approval-prompts` (before the second rebase) and `refs/rebase-backup/fewer-approval-prompts-1` (before the first).
- **Verified 2026-11-15 19:22, on the final tip after the second rebase**, inside the sandbox in the worktree: `bun run check` passes; `bun run typecheck` passes for all seven packages; `CI=1 bun run test` gives 161 files passed, 1 skipped; 1,603 tests passed, 0 failed, 54 skipped.
- **Verified**: the origin rename to `@outlore/*` meant the worktree's copied packages had no workspace links. `bun install --frozen-lockfile` fails in the sandbox at the `prepare` script (it cannot lock the shared `.git/config`) but still creates the links; `--ignore-scripts` avoids the error. `.agents/worktree-setup.sh` copies packages only and does not create these links after a rename.
- **Not known by this file**: whether the push to `origin/main` was approved and done. Check `git ls-remote origin refs/heads/main`.
- **Not checked**: the skipped tests on a machine where their capability exists (run the suite outside the sandbox once); the toggle on the Permissions page in a window; a live thread; OpenCode's unconfirmed-containment case; the installed Outlore app has none of this until rebuilt.

## Decisions

- Commands only, not file edits outside the folder: the setting covers escapes of the sandbox; edits outside the folder, unprotected harnesses, widening and the linked-folder confirmation still ask. Recorded in CHG-0295 and `documentation/capabilities/action-approval/specifications.md`.
- Pushes, publishing, deleting and paying stay the thread's own judgement and still ask, even with the setting on.
- The changelog entries go in a new `0.1.5-Prototype.md` because 0.1.4 is released and tagged.

## Next

1. Confirm the push of this branch to `origin/main` happened (`git ls-remote origin refs/heads/main` equals the tip).
2. Local `main` still holds `508a696` (mobile navigation), now also on `origin/main`: reset it to `origin/main` after the owner checks that nothing else is uncommitted there.
3. Rebuild and restart Outlore, turn the toggle on in Permissions, and watch a live thread.
4. Run the suite once outside the sandbox and compare the skipped count (18 before CHG-0294).

## Open questions

- Should the setting also cover file edits outside the folder? The owner's wording was "every action outside the sandbox"; commands only was assumed.
- Should `.agents/worktree-setup.sh` also create workspace links, so a worktree needs no `bun install`? The owner decides whether it is worth it.

## Sources

- `documentation/changelog/0.1.5-Prototype.md` (CHG-0294, CHG-0295)
- `documentation/verification/2026-11-15-fewer-approval-prompts.md`
- `documentation/capabilities/action-approval/specifications.md`
- `.agents/worktree-setup.sh`, `vitest.setup.ts`
- `git log origin/main..worktree/fewer-approval-prompts` after the push is verified; backup refs `refs/rebase-backup/fewer-approval-prompts` and `-1`
