# Handoff: Quest and errand tab actions

Supersedes: none
Workspace: OUTLORE, `main` at `32721c2e`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Finish the owner's request to archive/delete quests and errands or mark them fulfilled directly from the Quests and Errands tabs, reusing existing icons and flows. The implementation is on `main`; complete the remaining desktop window review.

## State

- Verified: commit `32721c2e` (`Add quest and errand tab actions (CHG-0637)`) is on local `main` and was read back from `origin/main` with the same full object id `32721c2ed3cc01981e4eb4028676e0f3198c6802`.
- Verified: the worktree rebase preserved the quest action commit while retaining main's concurrent changes. The changelog assigns CHG-0637 because CHG-0630 through CHG-0636 were already used.
- Verified: `bun run typecheck`, `bun run check`, and `git diff --check` passed on the rebased tip. The full suite had passed earlier in the feature worktree: 2,704 passed, 64 skipped, zero failures.
- Pending: desktop window review of tab card actions, running-quest confirmation, and empty-quest trash icon in both conversation header layouts.
- The main checkout has unrelated uncommitted background-check-in work in `documentation/backlog.md`, `documentation/changelog/0.2.2-Pre-Alpha.md`, `documentation/outline.md`, and `documentation/capabilities/background-check-ins/`. Preserve it.

## Decisions

- Empty quests use the shared trash icon and the existing ending flow; populated quests and errands use the archive icon. Done checkboxes can reopen fulfilled items.
- The tab actions are CHG-0637. CHG-0631 was already assigned to the errand draft Companion picker on main.

## Next

1. Review the running desktop UI for the interactions listed above.
2. Record the review result in the changelog and work-in-progress note, preserving any concurrent edits.

## Open questions

- Do the card controls and confirmations have the intended appearance and interaction in the desktop window?

## Sources

- `apps/app/src/shell/channelQuests.tsx`
- `apps/app/src/shell/railActions.tsx`
- `apps/app/src/ui/archiveButton.tsx`
- `apps/app/src/conversation/threadPane.tsx`
- `apps/app/src/conversation/mobileHeader.tsx`
- `documentation/capabilities/conversation-panes/specifications.md`
- `documentation/changelog/0.2.2-Pre-Alpha.md` (CHG-0637)
- `documentation/work-in-progress.md`
