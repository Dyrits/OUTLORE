# Handoff: An empty errand a Reply opened is deletable

Supersedes: none (forked from `2026-11-25-2028-reply-opens-child-and-parent-search.md`)
Workspace: outlore (repository root, branch `main`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

An errand or quest opened by Reply and still holding nothing of its own must be deletable, not only archivable, even though the message it replies to is shown at its top.
Done means the owner has seen the bin icon on such an errand in the desktop window and deleted one.

## State

- **Errand deletion (verified: `bunx vitest run test/work/archivingErrands.test.ts test/work/replies.test.ts` passed, 29 tests; Biome clean; the 7-workspace `bun run typecheck` passed):** `emptyErrandCondition` (`packages/service/src/work/emptyQuest.ts`) holds for an errand with no message, no turn, and no errand beneath it; `archiveThread` (`errandEnding.ts`) deletes such an errand through the new `eraseEmptyErrand` (`deleting.ts`); `ThreadSummary.isEmpty` (`packages/contracts/src/threadRecords.ts`, set in `missionDetail.ts`) feeds the bin icon and "Delete errand" label in `errandHeaderActions.tsx` and `paneThread.tsx`; a deleted errand's pane returns to its parent through `onSelect`.
- **Quest case (verified: read `replies.test.ts` line 303 and `emptyQuestCondition`):** an empty quest a Reply opened from Chronicler was already empty (`mission.isEmpty`) because the anchor message lives in Chronicler's mission; no change was made.
- **Recorded as CHG-0755** in `documentation/changelog/0.2.9-Pre-Alpha.md`.
- **Assumed:** the behavior in a running desktop window (icon, pane returning to the parent, mobile layout) was not observed. The owner reported a quest also showing Archive; it was not reproduced.
- **Not committed:** `bun.lock` carries an unrelated local edit that predates this work and stays out of every commit.

## Decisions

- **An errand counts as empty without its anchor message:** the anchor belongs to the parent conversation, so only the errand's own messages, turns, and child errands decide (CHG-0755).
- **Archive on an empty errand deletes it, as on an empty quest:** no new request; the existing `ArchiveThread` carries it (CHG-0755).

## Next

1. Open the desktop app, Reply on a message of a quest, and check the bin icon, the delete, and the pane returning to the quest; also Reply from Chronicler and check the quest's icon in the sidebar and header.
2. If a quest opened by Reply still shows Archive instead of Delete, get its steps from the owner and inspect `isEmpty` for that mission (`emptyQuestCondition`).
3. Update `documentation/work-in-progress.md` once the owner accepts.

## Open questions

- Which quest showed Archive instead of Delete in the owner's report? Owner can answer.

## Sources

- `documentation/changelog/0.2.9-Pre-Alpha.md` (CHG-0755)
- `documentation/changelog/0.2.8-Pre-Alpha.md` (CHG-0746)
- `packages/service/src/work/emptyQuest.ts`, `deleting.ts`, `errandEnding.ts`, `missionDetail.ts`
- `apps/app/src/conversation/errandHeaderActions.tsx`, `paneThread.tsx`, `threadPaneHeader.tsx`
- `packages/service/test/work/archivingErrands.test.ts`, `replies.test.ts`
