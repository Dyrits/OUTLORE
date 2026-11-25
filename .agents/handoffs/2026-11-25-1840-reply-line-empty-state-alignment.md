# Handoff: Reply line empty state and alignment

Supersedes: `2026-11-25-1756-agent-reply-first-reply-line.md`
Workspace: outlore (repository root, branch `main`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner called the reply line's indentation a failure and asked that a message with no replies show nothing instead of "No replies yet".
Done means the owner has looked at the reply line in the desktop window and accepted its alignment, and CHG-0741, CHG-0742 and CHG-0744 are recorded as Deliveries.

## State

- **Empty state (verified: `replyLineLabels.test.ts` passes, 5 tests):** `replyCountLabelOf` returns null for zero or unknown replies unless the thread is Underway ("Opening…"); `CompactReplyBar` draws no count text for null.
- **Alignment (verified: Biome and `tsc --noEmit` clean in `apps/app`; no test covers layout):** `compactRow` lost its 14 px left margin, the elbow lost its right margin, and the bar's left padding is 4 px, so the elbow sits at the card's left edge and the text at the card's 14 px text inset.
- **Assumed:** the owner's complaint was the offset to the right of the card; I did not see their screenshot, and nothing was seen in the desktop window.
- **Not done:** a line under the owner's own message, which is right-aligned and as wide as its text, stays on the left.
- **Other work in the tree, not part of this commit:** `commentable.tsx`, `commentable.web.tsx`, `conversationEntries.tsx`, `styles.ts` and `messageActions.tsx` carry another session's uncommitted changes.

## Decisions

- **No count text when there are no replies:** the owner's instruction; recorded in CHG-0744.
- **The elbow at the card's left edge, text at its inset:** my reading of "starts where the message starts" from CHG-0742; recorded in CHG-0744.

## Next

1. Look at the reply line in the desktop window, light and dark, under an agent message and under an owner message.
2. If a line under an owner message must follow the right-aligned card, pass the sender to the line and align it (`conversationEntries.tsx`, `replyLine.tsx`); ask the owner which edge first.
3. Once accepted, record the Deliveries in the `0.2.8-Pre-Alpha` changelog and remove the work-in-progress entry.

## Open questions

- Should a reply line under the owner's right-aligned message sit under the card's left edge, its right edge, or stay at the left of the pane? The owner's look answers.

## Sources

- `documentation/changelog/0.2.8-Pre-Alpha.md` (CHG-0741, CHG-0742, CHG-0744)
- `documentation/work-in-progress.md`
- `apps/app/src/conversation/replyLine.tsx`, `apps/app/src/conversation/replyLineLabels.ts`
- `apps/app/test/conversation/replyLineLabels.test.ts`
- `apps/app/src/foundation/styles.ts` (`messageRow`, `messageRowUser`, `messageRowAgent`)
