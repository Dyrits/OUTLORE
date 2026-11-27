# Handoff: the Companion mention with @ is built and pushed

Supersedes: `2026-11-27-0745-companion-mention-built.md`
Workspace: Outlore repository, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

A message that names a model with `@` is answered by that model in the same conversation while the main Companion carries on; done means it works in a real window and on a real harness, not only against the fake harness.

## State

- Everything in the superseded handoff still holds: the Companion mention (CHG-0781, commit `9fe2307c`) is merged into `main` and was verified on the merged tree (Biome clean, typecheck on 7 workspaces, 389 test files passed with 3,273 tests, 0 failed, run with `GIT_CONFIG_VALUE_0=` set). Read that file's State and Decisions for the design and the known gaps.
- This handoff was committed and then `main` was pushed to `origin/main` with the owner's approval (`git push --no-verify origin main`, because the pre-push hook refuses `main`). Check it now with `git log origin/main..main`: an empty list means everything is on origin; assumed until you check.
- Not checked, unchanged: the `@`, `#`, `+` and `$` lists, chips and the keep icon in the desktop window and on the phone; a live harness turn; a real signed-out or over-quota account.
- The worktrees `.worktrees/companion-mention`, `.worktrees/turn-scope` and `.worktrees/quest-visibility` and their branches are merged and still on disk.

## Decisions

None beyond the superseded handoff.

## Next

1. Try `@` in the desktop window and on the phone with a real signed-in model, including an approval question and a signed-out or over-quota account; fix what shows. Check `#`, `+`, `$` and the keep icon in the same pass.
2. Mark a quest as needing the owner when its Companion asks an approval question; make `appGuideTopics.ts` read `marks.ts`.
3. With the owner's agreement, remove the three merged worktrees and branches (git worktree commands need approval and run outside the sandbox).

## Open questions

- Whether the sidebar and the Chronicle should show a Companion's exchange or approval question: the owner has not answered.

## Sources

- `.agents/handoffs/2026-11-27-0745-companion-mention-built.md`.
- `documentation/changelog/0.2.10-Pre-Alpha.md`: CHG-0777 to CHG-0781.
- `documentation/capabilities/thread-messaging/specifications.md` and `blueprint.md`.
