# Handoff: Slack-like thread replies (Batches 1 and 2)

Supersedes: none
Workspace: Outlore repository, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Make Outlore's channel → quest → errand conversations behave like Slack threads: direct quest/errand opening as replies inheriting the parent's Companion configuration with no extra bubble, compact one-line in-feed reply bars, an unchecked-by-default **Also send to \<parent\>** composer checkbox with message-only vs. full-context sharing, one-message child-to-parent reporting, and quest/errand notices rendered as parent-echoed replies.
Done means Batches 1 and 2 (`CHG-0735` and `CHG-0736`) are merged and pushed to `origin/main` and the owner has visually verified and accepted both batches in the desktop window.

## State

- **Cookout primary-source research (`documentation/research/cookout-2026-11-25.md`, `documentation/inspirations.md`):** completed and on `main` (`8aeff2e9`). Verified: `git log` shows `8aeff2e9` is an ancestor of `main`.
- **Batch 1 — Direct reply-based quest/errand opening and compact reply lines (`CHG-0735`, commit `167142e0` merged into `main`):** realm/Borderlands channels directly open quests under the owner's message using the channel's Companion configuration (`suggest_mission` with no matches) and auto-open the quest pane while casual chat stays in-channel; clicking **Reply** on a quest message opens `ErrandStarter` directly anchored via `OpenThread.anchorMessageId`; single agent `open_thread` anchors directly to the triggering message while multiple errands on one message split into separate agent brief replies; in-feed reply lines render as compact one-line bars while **Quests** and **Errands** tabs keep full cards. Verified: Biome (26 files, 0 errors), workspace typecheck (all 7 packages), and related Vitest suite (289 passed, 3 skipped; 2,322 tests passed) passed on commit `167142e0`.
- **Batch 2 — Parent echo checkbox, one-message reporting, and parent-echoed notices (`CHG-0736`, commit `19b3c983` merged into `main`):** added `SendToParentScope` (`"MessageOnly" | "FullContext"`) on `SendMessage` and `<SendToParentControl>` under quest/errand composers (errands echo to and wake the parent quest; quests echo conversation-only to their realm/Borderlands channel); updated `report_result` (and `send_thread_message`) with optional `includeContext` and one-message child reporting (posts as the errand's reply and echoes to parent in one step, deduplicating identical final turn replies in `turns.ts`); updated `inactivityMissives.ts` to record notices inside the quest as well as echoing to its parent channel; suppressed **Reply** on notices and parent-echoed thread replies while linking them to their originating quest or errand. Verified: Biome (22 files, 0 errors), workspace typecheck (all 7 packages), and related Vitest suite (290 passed, 3 skipped; 2,328 tests passed) passed on commit `19b3c983`.
- **Desktop window visual check:** not yet performed (assumed working from automated tests; needs owner check in the running desktop app).

## Decisions

- **Two-batch split (owner, 2026-11-25):** Batch 1 covers direct reply opening, anchor rules, and compact in-feed reply bars; Batch 2 covers **Also send to \<parent\>** with context toggle, one-message reporting, and parent-echoed notices (recorded in `documentation/changelog/0.2.7-Pre-Alpha.md`, CHG-0735 and CHG-0736).
- **Casual chat stays in-channel:** realm/Borderlands Companions answer greetings and casual chat in-channel without opening a quest, and auto-open the quest pane only when a quest is actually opened.
- **Multiple agent errands split symmetrically:** a single `open_thread` anchors directly to the triggering message with no extra bubble, whereas multiple errands targeting the same message each get their own attributed brief reply so none is asymmetrically tied to an umbrella prompt.
- **Channel echoes from quests are conversation-only:** checking **Also send to \<realm / Borderlands\>** in a quest posts the echo to the channel feed without waking Chronicler or opening a new quest, whereas checking **Also send to \<quest\>** in an errand wakes the parent quest.
- **No Reply button on notices or parent-echoed child replies:** clicking them opens the originating quest or errand instead of starting a duplicate.

## Next

1. Run the desktop app on `main` and visually verify Batch 1: casual channel chat stays in-channel, work messages directly open a quest anchored to the owner's message with the channel's Companion and auto-open the quest pane, **Reply** on a quest message opens `ErrandStarter` directly, and in-feed reply lines show the compact one-line bar.
2. Visually verify Batch 2: test **Also send to \<parent\>** with **This message** and **Full context** from both an errand (wakes parent quest) and a quest (conversation-only in channel), verify one-message `report_result` leaves no duplicate bubble, and confirm inactivity notices and parent-echoed replies show no **Reply** button and open their originating quest/errand on click.
3. Address any visual polish or adjustments from the desktop check, then record `Event: Delivery` in `documentation/changelog/0.2.7-Pre-Alpha.md` once accepted.

## Open questions

- None.

## Sources

- `documentation/capabilities/conversation-panes/specifications.md`
- `documentation/changelog/0.2.7-Pre-Alpha.md` (CHG-0735, CHG-0736)
- `documentation/work-in-progress.md`
- `documentation/research/cookout-2026-11-25.md`
- `documentation/inspirations.md`
- `packages/contracts/src/records.ts`, `packages/contracts/src/requests.ts`
- `packages/service/src/work/parentEcho.ts`, `packages/service/src/work/messagesHandlers.ts`, `packages/service/src/work/tree.ts`, `packages/service/src/work/turns.ts`, `packages/service/src/work/threadTools.ts`, `packages/service/src/work/threadToolHandlers.ts`, `packages/service/src/work/inactivityMissives.ts`, `packages/service/src/work/suggestions.ts`
- `apps/app/src/conversation/sendToParent.ts`, `apps/app/src/conversation/sendToParentControl.tsx`, `apps/app/src/conversation/threadPane.tsx`, `apps/app/src/conversation/conversationEntries.tsx`, `apps/app/src/conversation/commentable.web.tsx`, `apps/app/src/conversation/replyLine.tsx`, `apps/app/src/shell/errandStarter.tsx`
- Commits `8aeff2e9`, `167142e0`, `19b3c983`
