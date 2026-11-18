# Handoff: Queue by default, with Steer and Interrupt on a queued message

Supersedes: none
Workspace: OUTLORE, branch `main` on `origin/main`, built in the worktree `.worktrees/queue-steer-interrupt`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner was unsure what the composer's Interrupt button does against Stop, and asked for queueing by default with a later choice (CHG-0519). Done means the owner has looked at queued messages in a window and on a phone.

## State

- Verified now (command output): on `origin/main` at 668da32 plus this change, Biome is clean (929 files), `bun run typecheck` passes on all workspaces, and `bun run test` passes (266 files, 2,168 tests passed, 55 skipped).
- Verified now (code read): `defaultDelivery` is Queue (`packages/service/src/core/settings.ts`); the composer (`apps/app/src/ui/controls.tsx`) has no Interrupt button and no second send button, only Send and Stop; `SteerQueuedMessage` (`releaseQueued` in `packages/service/src/work/messaging.ts`, handler in `messagesHandlers.ts`) clears a queued message's mark and wakes its thread; a queued message's card (`conversationEntries.tsx`) shows **Steer** and **Interrupt** while the thread runs, and Interrupt calls the existing `InterruptThread`, after which the next turn starts with the queued messages. A message not yet delivered (`Message.isDelivered` false) is drawn faint, with no text label.
- Verified now (spec): Stopping with a message queued keeps it queued and faint, with no actions, until Resume (thread-messaging specification, Delivery).
- Assumed: the faint card and the two actions look right in light and dark and on a phone. No window was opened.
- Not done here: the main checkout (`/Users/dgerrits/Codelab/Dyrits/CANOPY`) still holds this change as uncommitted edits written there first, as CHG-0514, mixed with other sessions' uncommitted work (Vibe, an older archive-errand draft that `origin/main` has since superseded). They duplicate this commit and will conflict when `main` is updated there; whoever owns that checkout should drop them.

## Decisions

- Queue is the default; Steer and Interrupt are chosen per message, after sending. Recorded in CHG-0519.
- No text indicators ("Queued", "Delivered"): the faint card is the only sign. The owner's words; recorded in CHG-0519.
- Stop with a message queued keeps the message, faint and without actions, until Resume. Chosen as the existing rule for a Stopped thread. The owner was offered deleting it instead and has not answered.
- Interrupt reuses `InterruptThread` and takes every queued message to the next turn with it.

## Next

1. Ask the owner to look at a running thread with a queued message in a window and on a phone, and at Steer and Interrupt there.
2. Ask the owner whether to remove the unused `Composer` `alternative` leftovers (still used by the errand form's "Start anyway") and the setting's now-rare Steer choice; do not remove either without asking.
3. Have the main checkout's duplicate uncommitted edits dropped by their owner.

## Open questions

- Should Stop delete a queued message instead of keeping it? Only the owner answers.
- Should the default setting stay in Settings now that sending always queues unless changed?

## Sources

- The change: `apps/app/src/conversation/conversationEntries.tsx`, `useThreadConversation.ts`, `apps/app/src/ui/controls.tsx`, `packages/service/src/work/messaging.ts`, `messagesHandlers.ts`, `missionDetail.ts`, `packages/contracts/src/requests.ts` (`SteerQueuedMessage`), `records.ts` (`Message.isDelivered`).
- The changelog: `documentation/changelog/0.1.10-Prototype.md`, CHG-0519.
- The spec: `documentation/capabilities/thread-messaging/specifications.md#delivery`.
- The commit: the one on `main` that adds this file (`git log --oneline -3`).
