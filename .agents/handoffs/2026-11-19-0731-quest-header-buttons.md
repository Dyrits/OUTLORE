# Handoff: the quest header's Mark as done and quest icon

Supersedes: none
Workspace: repository `OUTLORE` (`/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`), branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

On a wide window, an open quest's header (top right, after the title and state dot) reads Archive, Mark as done, a vertical separator, then a quest icon that shows or hides the right-hand column on its Quest tab. Done when the owner has seen it in a window and on a phone and accepted it.

## State

- **Built and committed (the commit carrying this file):**
  - `apps/app/src/ui/questHeaderButtons.tsx`: `DoneButton` (a checkbox, ticked and labelled "Mark as not done" once the quest is Done), `HeaderSeparator`, `QuestPanelButton` (the sword without the plus; filled while the Quest tab shows).
  - `apps/app/src/conversation/conversation.tsx` (`ThreadPane`): shows them for a quest's own thread (not an errand, not a Ritual's quest, not an archived quest). Marking done uses `useEnding(...).start("Done")`, with the existing confirmation when threads are at work; unmarking sends `ReopenMission`.
  - `apps/app/src/shell/questTab.ts` (`isQuestTabOpen`, `panelAfterQuestIcon`), `foundation/shellContext.tsx` (`QuestTabButtonContext`), `shell/shell.tsx` (provides the context on the wide layout; the round edge handle is left out while a quest is open, i.e. `props.openMission !== null`).
  - `apps/app/src/quests/questPanel.tsx`: the panel's Mark as done and Archive buttons under Does are removed; an archived quest's panel keeps Reopen.
  - Test `apps/app/test/shell/questTab.test.ts`; changelog CHG-0527 in `documentation/changelog/0.1.12-Prototype.md`; a line in `documentation/capabilities/mission-tracking/specifications.md` under Ending a mission.
- **Verified now (2026-11-19, before the commit):** `bun run check` clean (939 files); `bun run typecheck` passes on all workspaces; `TMPDIR=<repo>/.tmp-test CI=1 bunx vitest run apps/app`: 78 files, 556 passed, 6 skipped.
- **Not verified:** not seen in a window or on a phone (light theme, other looks, the icon's filled state, the checkbox's tick); the full suite was not run, only the app's tests.
- **Known gaps:** the phone's header (`MobileHeader`) and a narrow window have no Mark as done and no quest icon; a quest's journal, lore and budget screens replace the thread pane, so they show no icon and, with the edge handle gone for an open quest, no header way to open the panel there.
- **Not mine, left uncommitted:** `apps/app/src/shell/railQuests.tsx`, `railStyles.ts` and `test/shell/railStyles.test.ts` were being edited by another thread (a realm name's width on the phone). They are not part of this commit.
- **Stash, not to be dropped:** `stash@{0}` ("Writs rename (set aside, not wanted for now)") holds an untracked `documentation/changelog/0.1.12-Prototype.md` with CHG-0526. This work's file has the same name, so popping that stash will conflict on it; my entry is numbered CHG-0527 to keep the numbers apart. Do not pop or drop the stash without the owner's word.

## Decisions

- "Keeping focus when open" was read as the icon staying highlighted while the Quest tab shows; pressed again it closes the column; pressed while the Companions tab shows it switches to Quest. The owner has not confirmed this reading.
- The edge handle is removed only where a quest is open; realm lists and other screens keep it (their panels have no header icon).
- Mark as done follows Archive's visibility rule (a quest's own thread, no Ritual, not archived); an errand and a Ritual's quest get neither.
- Mark as done is not added to the phone header yet (its title is centred between two equal squares; adding a button changes that layout).

## Next

1. Look at the header in a window (dark and light, Iskios, One and Gild looks): the three buttons, the separator, the icon's filled state, marking done, unmarking, a quest with a thread at work (confirmation).
2. Decide with the owner whether the phone header gets Mark as done, and whether the journal, lore and budget screens need a way to open the panel.
3. Decide with the owner what happens to the stash (see State).

## Open questions

- Does "keeping focus" mean the highlight (as built) or keyboard focus on the button? The owner can say.
- Should an errand's header also offer these buttons? Today it shows none; the errand's own action stays in the panel.

## Sources

- `apps/app/src/conversation/conversation.tsx`, `apps/app/src/ui/questHeaderButtons.tsx`, `apps/app/src/shell/shell.tsx`, `apps/app/src/shell/questTab.ts`, `apps/app/src/quests/questPanel.tsx`
- `documentation/changelog/0.1.12-Prototype.md` (CHG-0527), `documentation/capabilities/mission-tracking/specifications.md`
- `packages/service/src/work/ending.ts` (`endMission`, `reopenMission`)
