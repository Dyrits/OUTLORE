# Handoff: Pane notches, statuses and titles, follow-up

Supersedes: `2026-11-20-1527-notches-titles-statuses.md`
Workspace: Outlore, `main`, delivered to `origin/main` in two commits (the earlier one, `b63a5c51`, and the one this handoff is committed with).

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Check in the desktop window the pane, title and status work of this session, and settle the open choices below. Done means the owner has seen each item in a window and answered the open questions.

## State

The earlier state (notch margin, child notches, one status list and its roll-up, folded starter, header separator, Companion button, wrapped choice answers) is in the superseded handoff and in CHG-0592 to CHG-0600. Added since, all in this commit and none seen in a window:

- The id before a name (`[Q-XXXXXX]`, `[E-XXXXXX]`) is removed again: the app shows the stored title; `nameWithId` and `foundation/displayId.ts` are deleted (CHG-0601). A quest is still stored "Quest" and an errand "Errand" until named, and `set_mission_title` still names an errand. The superseded handoff still describes the id; that part is withdrawn.
- Notches between two open panes sit across the line, half in each pane, each pane keeping half a notch of margin on that edge; against the row's edge they stay inside with the full margin (`isStraddling` in `shell/paneStrip.tsx`, applied in `shell/paneHost.tsx`) (CHG-0602).
- The starter pane is folded again whenever another quest opens (an effect on the quest in `shell/paneHost.tsx`). The cause was found by reading the code, not reproduced in a window, so it is assumed.
- The starter's first tab is "Missives" (`shell/errandStarter.tsx`); the owner decided there is no "Errand" tab there.
- The title picker's list shows each entry's state dot (`ui/pickers.tsx`, `conversation/threadTitle.tsx`).
- Window-style Expand and Fold icons were tried and rolled back at the owner's request; the old icons are in place.
- Verified now: Biome clean and the app typecheck passed on these changes. The service and full test suites were not re-run after them; the commit hook runs the typecheck and the tests related to staged files. Not verified: all rendering (notch placement across the line, state dots, header icons) and the conversion of a real database to the new status names.

## Decisions

- No id before a name; stored titles are shown as they are (owner, CHG-0601).
- Statuses, roll-up, notch order and realm mark as in CHG-0599 and CHG-0600; a quest stays Resting when its main thread reports, until the owner marks it done (implementation choice, not yet confirmed).
- The old Expand and Fold icons stay (the owner preferred them).

## Next

1. In the desktop window, check the notches in each layout (realm alone, realm and quest, realm and errand, quest alone, quest and errand, errand alone), including the notch across the line, the `+N` notch and the margins.
2. Check the starter stays folded when opening a quest after using "+" on another one.
3. Check the status dots (sidebar, pane headers, title picker, board) and convert a copy of a real database to check the new status names.
4. Resume the folding review items from earlier handoffs that still apply (Restore, narrow layout).

## Open questions

- Should "Mark as done" be renamed to match Fulfilled (headers, auto-archive settings, `foundation/labels.ts`, `act_on_mission`, `report_result`; a Ritual's state still says Done)? The owner answers.
- Is it right that a quest stays Resting after its main thread reports, until the owner marks it done?
- Are the castle and compass the right icons for a realm and the Borderlands?
- Should the "New errand" starter notch stay on a quest's right edge beside its errands?

## Sources

- [Changelog: CHG-0592, CHG-0596 to CHG-0602](../../documentation/changelog/0.1.13-Prototype.md)
- [Mission tracking specification: Mission state](../../documentation/capabilities/mission-tracking/specifications.md)
- [Thread states](../../documentation/capabilities/thread-tree/specifications.md)
- [Pane host](../../apps/app/src/shell/paneHost.tsx) and [notch components](../../apps/app/src/shell/paneStrip.tsx)
- [Child notch order](../../apps/app/src/shell/childNotches.ts) and [status roll-up](../../packages/service/src/work/missionStates.ts)
- [Title picker](../../apps/app/src/conversation/threadTitle.tsx)
