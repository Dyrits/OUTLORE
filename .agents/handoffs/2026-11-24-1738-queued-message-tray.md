# Handoff: Stacked queued-message tray with Steer toggle and unsteer

Supersedes: none
Workspace: Outlore, branch `worktree/publish-queued-message-tray` (rebased on `origin/main` `3cc6d8bd` and published to `origin/main`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Replace faded undelivered owner message cards in the conversation feed with a collapsible stacked tray above the composer (option B) supporting Edit, Delete, Clear all, a toggleable Steer control (`SteerQueuedMessage` / `UnsteerQueuedMessage`), and Interrupt, then verify its appearance and interactions in the running desktop and mobile app.

## State

- `UnsteerQueuedMessage` contract (`packages/contracts/src/requests.ts`, `results.ts`, `requestSources.ts`), `requeueSteered` in `packages/service/src/work/messaging.ts`, and its handler in `packages/service/src/work/messagesHandlers.ts` are implemented (verified by `bun run typecheck` and `packages/service/test/work/steering.test.ts`, 15/15 passing).
- Stacked tray logic (`apps/app/src/conversation/queuedMessages.ts`) and component (`apps/app/src/conversation/queuedMessageTray.tsx`) are wired above the composer in `apps/app/src/conversation/threadPane.tsx` and `apps/app/src/conversation/guildmaster.tsx`, and pending owner messages are excluded from `entriesOf` until delivered (`apps/app/src/conversation/entries.ts`, `conversationEntries.tsx`, `conversationFeed.tsx`; replaced `queuedMessageActions.tsx` removed) (verified by `apps/app/test/conversation/queuedMessages.test.ts` 4/4, `apps/app/test/conversation/entries.test.ts` 28/28, and `bun run typecheck`).
- Idle background sweeps (`timedSweep.ts`, `rituals.ts`, `budgetPeriods.ts`, `ending.ts`, `inactivityMissives.ts`) now wait on `changes.pubsub` when nothing is scheduled (`CHG-0703`), resolving the `TestClock` timeouts in `loreHistory.test.ts`, `loreOverTime.test.ts`, and `loreProposals.test.ts` (verified by `timedSweep.test.ts`, `sweepFailures.test.ts`, `tracking.test.ts`, `ritualRuns.test.ts`, and all three lore suites).
- Specification (`documentation/capabilities/thread-messaging/specifications.md`) and changelog (`documentation/changelog/0.2.5-Pre-Alpha.md`, `CHG-0702` and `CHG-0703`) are updated.
- Visual rendering in light and dark looks on desktop and narrow/phone widths is not yet verified in the running app.

## Decisions

- Option B (stacked tray above the composer with header count, collapse chevron, Clear all, and numbered rows) was selected by the owner from `documentation/art-direction/2026-11-24-queued-message-options.html`, extended with a toggleable Steer button and an Interrupt button (`CHG-0702`).
- Edit and Delete buttons stay disabled while a message is steered, matching the service invariant that only queued messages (`is_queued = 1`) can be edited or removed; turning Steer off re-enables them.
- `UnsteerQueuedMessage` sets `is_queued = 1` only when `sender_kind = 'user' AND is_queued = 0 AND delivered_turn_id IS NULL AND is_conversation_only = 0`, and refuses with `"This message was already taken in by the running turn."` otherwise.
- `timedSweep` accepts `null` from `untilNext` and waits solely on `wakeOn` when idle (`CHG-0703`); `autoArchiveLayer` keeps a daily fallback when `shouldAutoArchive` is enabled so direct-SQL state updates still archive.

## Next

1. Open the running desktop app in both dark and light looks and queue multiple messages during a running turn in a quest, an errand, and Chronicler's conversation.
2. Verify the stacked tray layout above the composer: collapse/expand chevron, pending count summary, Clear all removing only queued messages, numbered delivery order, inline Edit save/cancel, Remove, Steer toggle on/off (including error display if already taken in), and Interrupt.
3. Verify narrow/phone width wrapping so row actions wrap cleanly without clipping text.
4. Once verified, mark the visual check done in a follow-up handoff or remove this handoff's pointer from `AGENTS.md`.

## Open questions

None.

## Sources

- `documentation/art-direction/2026-11-24-queued-message-options.html`
- `documentation/capabilities/thread-messaging/specifications.md`
- `documentation/changelog/0.2.5-Pre-Alpha.md` (`CHG-0702`, `CHG-0703`)
- `packages/contracts/src/requests.ts`, `packages/contracts/src/results.ts`, `packages/contracts/src/requestSources.ts`
- `packages/service/src/work/messaging.ts`, `packages/service/src/work/messagesHandlers.ts`, `packages/service/test/work/steering.test.ts`
- `packages/service/src/work/timedSweep.ts`, `rituals.ts`, `budgetPeriods.ts`, `ending.ts`, `inactivityMissives.ts`, `packages/service/test/work/timedSweep.test.ts`
- `apps/app/src/conversation/queuedMessages.ts`, `apps/app/src/conversation/queuedMessageTray.tsx`, `apps/app/test/conversation/queuedMessages.test.ts`
