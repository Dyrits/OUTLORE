# Handoff: Pane notches, ids in titles, and one status list

Supersedes: `2026-11-20-1345-pane-notches.md`
Workspace: Outlore, `main`, one commit delivered to `origin/main` (see State).

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Check in the desktop window the work of one session on the app's panes, titles and statuses, and settle the open choices below. Done means the owner has seen each item in a window and answered the open questions.

## State

All of it is in one commit on `main`; none of it has been seen in a window. Verified by the implementing threads (Biome, app and service typechecks, app tests 672 passed, service tests 1516 passed); not re-run by me after the last edits, so treat as assumed.

- A pane that has notches keeps a 26 px margin on that edge (`notchWidth` in `shell/paneStrip.tsx`, applied in `shell/paneHost.tsx`) so the icon covers no text (CHG-0592 follow-up, in CHG-0598's entry area of the changelog).
- Only the last open pane has a right edge: its folded panes, then its own children. A realm's edge lists quests only. Children are one notch per active errand (quest pane) or per active quest (realm or Borderlands pane), at most four, then a `+N` notch that opens the Errands or Quests tab; sorted in `shell/childNotches.ts` (CHG-0598, order changed by CHG-0600).
- The errand starter pane is folded when a quest opens (CHG-0596).
- Titles: a quest or errand is "Quest" or "Errand" until named, shown as `[Q-XXXXXX]` or `[E-XXXXXX]` (first six hex characters of its UUID, capitals; display only) through `nameWithId` in `foundation/displayId.ts`; `set_mission_title` also names the calling errand (CHG-0597).
- Statuses (CHG-0599 agreement, CHG-0600 delivery): Fresh, Underway, Waiting, Attention, Failed, Resting, Stopped, Fulfilled, Archived, stored and shown as the same word; migration `0067_status_names`; `isYourTurn` removed (Resting is the owner's turn); roll-up in `work/missionStates.ts` with `ThreadSummary.shownState`; realm mark in `shell/realmMark.ts`.
- Smaller fixes: a separator between the header's actions and the layout controls; the Companion button stays selected while the Companions tab is open (press again to leave); long free-text answers in a resolved choice bubble wrap inside the card.
- Not verified: rendering of notches (overlap, column height with folded panes plus four children plus `+N`, the `+N` at 26 px), the restored teal and the row corners, the header, and the conversion on a real existing database (tested only on a test database). `biome check --write` ran over the whole repository, so other files may have been reformatted.

## Decisions

- Short id of six characters, derived from the UUID, display only; no stored short id. The owner rejected a longer scoped id (`R-…#Q-…#E-…`) as too much. Recorded in CHG-0597.
- Statuses and roll-up as in CHG-0599; a main thread that reported its result leaves the quest Resting, and only the owner's "Mark as done" makes it Fulfilled (an implementation choice of the status thread, not yet confirmed by the owner).
- Realm mark and the notch order as in CHG-0599 and CHG-0600.

## Next

1. In the desktop window, check the notches in each layout (realm alone, realm and quest, realm and errand, quest alone, quest and errand, errand alone), including the `+N` notch and the margin.
2. Check the status dots (Fresh grey, Resting teal), the sidebar, the pane headers, and the board columns (Attention, Underway, Resting, Fulfilled).
3. Convert a copy of a real database and check the statuses.
4. Resume the folding review items from the superseded handoff that still apply (Restore, title picker, narrow layout), and its question about the realm and Borderlands icons.

## Open questions

- Should "Mark as done" be renamed to match Fulfilled? Its label appears in the quest and errand headers, the auto-archive settings, `foundation/labels.ts`, and the `act_on_mission` and `report_result` tools; a Ritual's state still says Done. The owner answers.
- Is it right that a quest stays Resting when its main thread reports, until the owner marks it done?
- Are the castle and compass the right icons for a realm and the Borderlands?
- Should the "New errand" starter notch stay on a quest's right edge beside its errands?

## Sources

- [Changelog: CHG-0592, CHG-0596 to CHG-0600](../../documentation/changelog/0.1.13-Prototype.md)
- [Mission tracking specification: Mission state](../../documentation/capabilities/mission-tracking/specifications.md)
- [Thread states](../../documentation/capabilities/thread-tree/specifications.md)
- [Notch components](../../apps/app/src/shell/paneStrip.tsx) and [pane host](../../apps/app/src/shell/paneHost.tsx)
- [Child notch order](../../apps/app/src/shell/childNotches.ts), [status roll-up](../../packages/service/src/work/missionStates.ts), [id helper](../../apps/app/src/foundation/displayId.ts)
