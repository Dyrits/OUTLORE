# Handoff: Agent reply first in a thread, and the reply line without a box

Supersedes: none
Workspace: outlore (repository root, branch `main`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner found that, in a quest started from the dashboard, their own first message appeared as the first reply of the thread, and that the reply count read one too few.
They then asked for the reply line under a message to start where the message starts, without a bubble or an "Open" label.
Done means the owner has looked at both in the desktop window and accepted them, and CHG-0741 and CHG-0742 are recorded as Deliveries.

## State

- **First message pinned as the root (verified: `entries.test.ts` 32 tests and service `replies.test.ts` 21 tests passed when this was written):** a thread with no anchor, or a quest whose opening message repeats its anchor, pins its own first message as the root and leaves it out of the replies.
  The reply count also counts the questions a thread asked the owner.
  The code is in `packages/service/src/work/missionDetail.ts`, `packages/service/src/work/exchangeSamples.ts` and `apps/app/src/conversation/entries.ts`.
- **Reply line without a box (verified: app `tsc --noEmit` and Biome clean; no test covers it):** `CompactReplyBar` in `apps/app/src/conversation/replyLine.tsx` has no border and no "Open"; an elbow (`compactElbow`) sits beside the pressable area, so the hover fill never covers it, and a small quest or errand mark (`ChipIcon`) ends the line.
  The line has a fixed 14 px left margin, so it does not follow the owner's card width exactly.
- **Mockup:** `documentation/art-direction/2026-11-25-reply-line.html` holds the four alternatives the owner chose from (B).
- **Not verified:** nothing was seen in the desktop window, and the service typecheck of the changes was left to the pre-commit hook.
- **Other work in the tree:** the quest suggestion card (CHG-0739, its own handoff) was staged by another session; this handoff's commit leaves it alone.

## Decisions

- **Option B, the thread elbow, with no "Open" and a small quest or errand mark:** the owner's choice; recorded in CHG-0742.
- **Changelog numbers CHG-0741 and CHG-0742 in `0.2.8-Pre-Alpha.md`:** the work came after the 0.2.7 tag, and CHG-0739 was already taken by the suggestion card.
  An earlier draft of these entries sat in the 0.2.7 file under CHG-0739 and CHG-0740; they were moved and renumbered.

## Next

1. Look at both changes in the desktop window: open a dashboard-started quest and check that the first reply is the agent's and the count is right; check the reply line's elbow, hover and mark in the light and dark themes.
2. Decide with the owner whether the reply line should follow the card's left edge exactly (a short message right-aligned) instead of the fixed 14 px.
3. Once accepted, record the Deliveries in the `0.2.8-Pre-Alpha` changelog and remove the work-in-progress entry.

## Open questions

- Should the quest and errand marks be the sword and the errand chip icon, or something else? The owner's look answers.
- Should the owner's pinned root card and the reply line share one column? The owner's look answers.

## Sources

- `documentation/changelog/0.2.8-Pre-Alpha.md` (CHG-0741, CHG-0742)
- `documentation/work-in-progress.md` (the "Agent reply first and the reply line without a box" section)
- `documentation/art-direction/2026-11-25-reply-line.html`
- `apps/app/src/conversation/replyLine.tsx`, `apps/app/src/conversation/entries.ts`
- `packages/service/src/work/missionDetail.ts`, `packages/service/src/work/exchangeSamples.ts`
- `apps/app/test/conversation/entries.test.ts`, `packages/service/test/work/replies.test.ts`
