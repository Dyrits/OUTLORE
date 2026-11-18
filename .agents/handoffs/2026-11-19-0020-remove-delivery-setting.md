# Handoff: Remove the send-delivery setting; icons on Steer and Interrupt

Supersedes: `2026-11-18-2142-queue-steer-interrupt.md`
Workspace: OUTLORE, branch `main`; committed from the main checkout as CHG-0523 (the commit that adds this file)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner saw no Steer or Interrupt on a message sent while the agent ran. The cause was a saved `defaultDelivery: "Steer"` that CHG-0519 did not migrate, and the owner asked to remove the setting and give Steer and Interrupt icons (CHG-0523). Done means the owner has looked at a queued message in a window and on a phone.

## State

- Verified now (database read, read-only): the owner's `settings` row in `~/Library/Application Support/Outlore/outlore.sqlite` held `defaultDelivery: "Steer"`, which delivered every message at once and so never queued it.
- Verified now (command output, before the commit): Biome clean, `bun run typecheck` passes on all workspaces, `CI=1 bun run test` passes (267 files, 2,179 tests passed, 55 skipped).
- Verified now (code read): `Settings.defaultDelivery` is gone from contracts, the default settings and the Settings screen; `SendMessage` with `delivery: null` queues (`messagesHandlers.ts`); a suggestion's Continue always queues (`suggestions.ts`); `SendMessage.delivery` and `MessageDelivery` stay so a caller can still ask for Steer. Steer and Interrupt on a queued message's card have `SteerIcon` and `InterruptIcon` (`apps/app/src/ui/composerIcons.tsx`).
- Assumed: an existing database with the old `defaultDelivery` key opens in the running app (read from the schema, which ignores extra keys; not run). The icons and card look right in light and dark and on a phone; no window was opened.
- Not in this commit: edits by another session in the working tree (`apps/app/src/foundation/{onePalettes,palettes,theme}.ts`, `apps/app/src/shell/{questListRows,railQuests,railRows}.tsx`) were left uncommitted.

## Decisions

- No setting for delivery; a message always queues, and Steer or Interrupt is chosen after sending. The owner: "It makes no sense to have it." Recorded in CHG-0523.
- Existing saved values are ignored, not migrated.
- The Messaging card in Settings keeps only "Show errands opened by agents", titled "Errands opened by agents" (my choice; the owner has not seen it).

## Next

1. Ask the owner to look at a running thread with a queued message in a window and on a phone, including the two icons.
2. Ask the owner whether to drop the unused `Composer` `alternative` leftovers (still used by the errand form's "Start anyway"), as the superseded handoff left open.
3. Ask whether Stop should delete a queued message instead of keeping it (still unanswered).

## Open questions

- Should Stop delete a queued message instead of keeping it faint until Resume? Only the owner answers.
- Is "Errands opened by agents" the right title for the remaining Messaging card?

## Sources

- The change: `packages/contracts/src/records.ts`, `packages/service/src/core/settings.ts`, `messagesHandlers.ts`, `suggestions.ts`, `apps/app/src/settings/settings.tsx`, `apps/app/src/conversation/{conversationEntries,threadConversation,useThreadConversation}.ts*`, `apps/app/src/ui/composerIcons.tsx`.
- The changelog: `documentation/changelog/0.1.11-Prototype.md`, CHG-0523 (and CHG-0519 in `0.1.10-Prototype.md`).
- The spec: `documentation/capabilities/thread-messaging/specifications.md#delivery`.
- The commit: the one on `main` that adds this file (`git log --oneline -3`).
