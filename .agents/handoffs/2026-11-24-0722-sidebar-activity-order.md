# Handoff: Sidebar ordered by latest activity

Supersedes: `2026-11-23-2020-sidebar-status-order.md` for the sidebar's quest and errand order; that handoff's status-first order is replaced by CHG-0679.
Workspace: OUTLORE, `mission/sidebar-sorts-by-last-activity-7d871130` based on `2b1de99c` (origin/main), in `.worktrees/sidebar-sorts-by-last-activity-7d871130`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The desktop sidebar orders quests (each realm, and the Borderlands) and sibling errands (under each visible parent) by latest activity, newest first, whatever their status. The owner's words: "Fix the sorting of the sidebar to sort by last activity, having the most recent first."

## State

- Verified in code: `placementsOf` sorts with `latestFirstOf` from `questRecency.ts`, and `rankedRowsOf` sorts siblings by `thread.lastActivityAt`, newest first. The `compareUrgency` comparator is no longer used in `questTree.ts`. `railOutline.ts` and `childNotches.ts` are unchanged.
- Verified by running `CI=1 bun run test apps/app/test/shell`: 185 tests passed across 20 files. The two rewritten railOutline tests and the two added tests (a Failed quest with older activity below a newer Resting quest; errand siblings of different shown state) are among them.
- Verified by running `bun run typecheck`: all seven workspaces exit 0.
- Verified by running `bunx biome check` on the three changed TypeScript files: clean after one formatting fix.
- Not verified: the running desktop app. The sidebar order has not been looked at on screen.
- Spec: `documentation/capabilities/mission-tracking/specifications.md` line about the sidebar preview now says latest activity first. The notch order rule (about line 79) is unchanged.
- Changelog: `documentation/changelog/0.2.4-Pre-Alpha.md` holds CHG-0679, the first entry of that release.

## Decisions

- Status no longer ranks quests or errands in the sidebar. Only latest activity does, newest first.
- The open quest keeps a preview slot; the other slots fill in list order, as before.
- Notch urgency order (`compareUrgency` in `childNotches.ts`) is kept on purpose: notches still show the most urgent child first.
- CHG-0679 is the id for this change; it was unclaimed on origin/main at 2b1de99c.

## Next

1. Open the desktop app on a realm with at least five quests in mixed statuses. Confirm the newest-activity quest comes first, regardless of Failed or Attention on older quests.
2. Expand a quest with three or more errands with different statuses. Confirm the siblings are newest first under their visible parent.
3. Confirm the open quest still keeps its preview slot when it is not among the newest four.

## Open questions

- Whether the owner wants the preview to show Failed and Attention quests first after all. The request was for activity order alone, so the change follows that.

## Sources

- `apps/app/src/shell/questTree.ts`
- `apps/app/src/shell/questRecency.ts`
- `apps/app/src/shell/railOutline.ts`
- `apps/app/src/shell/childNotches.ts`
- `apps/app/test/shell/railOutline.test.ts`
- `apps/app/test/shell/questTree.test.ts`
- `documentation/capabilities/mission-tracking/specifications.md`
- `documentation/changelog/0.2.4-Pre-Alpha.md`, CHG-0679
- `.agents/handoffs/2026-11-23-2020-sidebar-status-order.md`
