# Handoff: Plan-limit rings, shortest window outermost

Supersedes: none
Workspace: OUTLORE, worktree `.worktrees/usage-rings`, branch `worktree/usage-rings`, rebased on `origin/main` 271265a and pushed to `origin/main` with this handoff

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner asked that the plan-limit rings put the shortest window on the outer ring and the longer ones inside it: for Claude, the 5-hour window outside and the weekly window inside (CHG-0511). Done means the owner has looked at the rings in a window.

## State

- Verified now: `ringStackOf` in `apps/app/src/editors/planRings.ts` sorts windows by length ascending (then reset time ascending), so index 0 is the outer ring. A reading saved without `windowMinutes` falls back to the earliest reset outermost.
- Verified now: `apps/app/test/editors/planRings.test.ts` expects the new order; the app's tests passed (74 files, 535 passed, 6 skipped), `tsc --noEmit` in `apps/app` and Biome were clean, and the pre-commit typecheck passed on all workspaces.
- Verified now: CHG-0511 is in `documentation/changelog/0.1.10-Prototype.md`.
- Assumed: the rings look right in a window and on a phone. Nothing visual was seen; an Electron window cannot open in the thread's sandbox.
- Assumed: no other file states the old order. A search of `documentation`, `apps/app/src` and `packages/service/src` for "surround", "outermost" and "longest" found only the changed code, tests and the CHG-0500 entry, but no capability specification states the ring order.

## Decisions

- The order is by window length, not by reset time, as CHG-0500 decided; only its direction changed, at the owner's request ("the outer circle is the lowest window, then going to the longer one").
- Records of CHG-0500 and CHG-0467 stay as history; CHG-0511 supersedes their direction.

## Next

1. Ask the owner to look at the rings in a window and on a phone with two and with three windows (OpenCode Go).
2. If a specification should state the ring order, add it to the budget-control specification, which today says nothing about it.

## Open questions

- Does the 5-hour ring outside read well at the 44 point size? Only the owner's look answers it.

## Sources

- The change: `apps/app/src/editors/planRings.ts` (`ringStackOf`), `apps/app/test/editors/planRings.test.ts`.
- The changelog: `documentation/changelog/0.1.10-Prototype.md`, CHG-0511; the reversed entry is CHG-0500 in `documentation/changelog/0.1.9-Prototype.md`.
- The commit: the one on `origin/main` titled "Put the shortest plan-limit window on the outer ring (CHG-0511)".
