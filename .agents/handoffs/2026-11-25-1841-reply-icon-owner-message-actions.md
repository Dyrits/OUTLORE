# Handoff: Reply icon and owner message actions

Supersedes: none (forked from `2026-11-25-1840-reply-line-empty-state-alignment.md`)
Workspace: outlore (repository root, branch `main`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner asked that Reply be an icon beside the Copy icon at the bottom right of a message, shown only on hover, and that their own messages also carry Copy and a timestamp.
Done means the owner has looked at both in the desktop window and accepted them, and CHG-0747 is recorded as a Delivery.

## State

- **Built (verified: Biome and `tsc --noEmit` in `apps/app` clean; `ELECTRON_RUN_AS_NODE=1 node_modules/.bin/electron node_modules/vitest/vitest.mjs run apps/app/test/conversation` passes, 17 files, 118 tests):**
  - `messageActions.tsx` is new: `MessageActions` draws a Reply arrow (when `useReplies()` offers one and the message exists) and `CopyButton`, hidden by opacity and `pointerEvents` unless `MessageHoverContext` is true.
  - `commentable.web.tsx` provides that context from its hover and focus state and no longer draws Reply; it always renders its wrapper, even with no comments context.
  - `commentable.tsx` (phone and native) is now a pass-through, and the "Message actions" menu is gone; the context defaults to true, so the icons always show there.
  - `conversationEntries.tsx`: the agent's footer uses `MessageActions`; owner messages get a footer with `stampOf(message.sentAt)` always shown and `MessageActions` (Copy copies `sent.body`, not the joined comments or terminal output).
  - `foundation/styles.ts`: `replyCopy` removed, `replyFooter` comment updated.
- **Assumed:** the layout, the hover behavior in react-native-web, the arrow glyph and the always-visible time were not seen in the running app; no test covers them.
- **Not changed:** notices and thread-sender messages have no footer, so no Reply or Copy, as before.
- **Other work in the tree, not part of this commit:** CHG-0745 and CHG-0746 (Chronicle Reply opens an empty quest: `guildmaster.tsx`, `threadAnchors.ts`, `instructions.ts`, `questsHandlers.ts`, `replies.ts`, `replies.test.ts`) belong to another session.

## Decisions

- **Time always visible, icons on hover:** my reading of "have a timestamp I guess"; the owner said only the icon is hover-only. Recorded in CHG-0747.
- **Icons stay shown where nothing hovers (phone):** the phone has no pointer; recorded in CHG-0747.
- **Footer reserves a 20 px row under every owner message:** it keeps the layout from shifting on hover; if it looks heavy, the owner can ask for the time on hover too.

## Next

1. Look at an agent reply and an owner message in the desktop window, light and dark, with the pointer on and off the card.
2. If the footer row under owner messages is too tall or the time should also hide, adjust `replyFooter` or the context use in `conversationEntries.tsx`.
3. Once accepted, record the Delivery in the `0.2.8-Pre-Alpha` changelog and remove the work-in-progress entry.

## Open questions

- Should the owner's time also appear only on hover? The owner's look answers.

## Sources

- `documentation/changelog/0.2.8-Pre-Alpha.md` (CHG-0747, CHG-0738)
- `documentation/work-in-progress.md`
- `apps/app/src/conversation/messageActions.tsx`, `commentable.web.tsx`, `commentable.tsx`, `conversationEntries.tsx`
- `apps/app/src/ui/copyButton.tsx`
