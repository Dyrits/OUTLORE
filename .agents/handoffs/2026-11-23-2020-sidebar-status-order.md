# Handoff: Sidebar status ordering

Supersedes: none
Workspace: OUTLORE, `worktree/sidebar-status-order` based on `fb79088f`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Verify in the desktop app that the sidebar puts quests and sibling errands in status order, with the latest activity first within each status.

## State

- Source inspection confirms that the sidebar ranks quests before choosing preview slots and ranks errand siblings after folding agent-opened threads.
- CHG-0675 records 47 focused tests, lint, and all seven workspace typechecks passing on the initial implementation.
- Live desktop verification is pending.

## Decisions

- Use the existing status order from the mission-tracking specification and the status displayed on each row.
- Keep a preview slot for the open quest and fill the other slots in list order.
- Keep errand nesting and rank siblings under their visible parent.

## Next

1. Open a realm with at least five quests in mixed statuses and confirm that Failed, Attention, and Resting appear first despite newer activity on lower-priority quests.
2. Expand a quest with at least three errands and check the first two rows against their displayed statuses.
3. Open the errands list and check that siblings of equal status are newest first and that nested errands stay under their visible parent.

## Open questions

None.

## Sources

- `documentation/capabilities/mission-tracking/specifications.md`
- `documentation/changelog/0.2.3-Pre-Alpha.md`, CHG-0675
- `apps/app/src/shell/questTree.ts`
- `apps/app/src/shell/railOutline.ts`
- `apps/app/test/shell/railOutline.test.ts`
