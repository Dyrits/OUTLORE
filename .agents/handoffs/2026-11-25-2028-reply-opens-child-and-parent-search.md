# Handoff: Reply opens the child thread, on-demand parent search, opener tail, and reply strip alignment

Supersedes: `2026-11-25-2000-reply-opens-child-and-parent-search.md`
Workspace: outlore (repository root, branch `main`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Clicking Reply opens its child quest or errand directly instead of a bottom reply box, anchored reply strips align with their anchor message bubble, child threads know when an owner message was echoed with "Also send to", and child threads read their opener's history on demand via `read_parent_messages` with a 5-message clipped first-turn tail for owner-opened errands.
Done means the owner has verified these behaviors in the desktop window and accepted CHG-0746, CHG-0748, CHG-0749, and the reply-strip alignment fix.

## State

- **Reply opens child thread, on-demand parent search, opener tail, and Antigravity quota fallback (verified: committed as `fd7caa0e` and pushed to `origin/main`):** Covers CHG-0746, CHG-0748, CHG-0749, the C7 aside test in `offTopic.test.ts` (16/16), the verification proof (`documentation/verification/2026-11-25-opener-tail-and-parent-search.md`), and the Antigravity `inlineFailurePattern` quota fallback.
- **Anchored reply strip alignment (verified: Biome 0 errors, app typecheck `tsc --noEmit`, 41/41 tests in `entries.test.ts`, `replyLineLabels.test.ts`, `conversationSearch.test.ts`):** `entriesOf` (`apps/app/src/conversation/entries.ts`) attaches anchored `ThreadOpened` and `QuestLink` reply lines to their visible anchor `Message` entry, `MessageBubble` and `AgentReply` (`conversationEntries.tsx`, `styles.ts`) render the card and anchored reply lines in one shared column, and `compactBar` / `compactTitle` (`replyLine.tsx`) use `flexGrow: 1, flexShrink: 1, minWidth: 0` so reply bars align to both edges of right-aligned owner bubbles.
- **Assumed:** Desktop window and mobile layout appearance, live Companion use of `read_parent_messages` and the 5-message tail, and live Antigravity quota fallback have not been observed in a running desktop window.

## Decisions

- **Anchored replies share their anchor message's column:** Rendering anchored `ThreadOpened` and `QuestLink` reply strips inside the same column as their visible anchor `Message` card keeps right-aligned owner bubbles and their reply strips flush on both edges while leaving unanchored threads and hidden-system-card anchors as standalone entries.
- **Earlier quest decisions (unchanged from `fd7caa0e`):** Reply creates an empty child immediately (CHG-0746); non-Reply openings copy the first message to the parent; thread instructions enforce one-place replies; `read_parent_messages` uses SQLite FTS5 BM25 on the direct parent with a 5-message clipped first-turn tail for owner-opened non-Reply errands (CHG-0748, CHG-0749).

## Next

1. Open the desktop app and verify Reply in Chronicler and in a quest, right-aligned owner bubble reply strip alignment (short and wide messages), New quest / New errand then write, mobile layout, and the `#` / quest icon on "Also send to".
2. Open an errand in the desktop app with a short prompt (e.g. "fix this") and check that the first turn sees the 5-message tail and calls `read_parent_messages` when asked about earlier parent messages.
3. Settle whether `read_parent_messages` should stay limited to the direct parent or reach grandparents as well.
4. Once accepted in the desktop window, record Delivery for CHG-0746, CHG-0748, and CHG-0749 in `documentation/changelog/0.2.8-Pre-Alpha.md` and update `documentation/work-in-progress.md`.

## Open questions

- Should `read_parent_messages` also reach grandparents, or remain restricted to the direct parent (leaving older context to the quest journal)? Owner decision.
- Where does the stray "Claude" tooltip seen in the owner's earlier screenshot come from? Not yet located.

## Sources

- `documentation/changelog/0.2.8-Pre-Alpha.md` (CHG-0746, CHG-0748, CHG-0749)
- `documentation/verification/2026-11-25-opener-tail-and-parent-search.md`
- `apps/app/src/conversation/entries.ts`
- `apps/app/src/conversation/conversationEntries.tsx`
- `apps/app/src/conversation/replyLine.tsx`
- `apps/app/src/foundation/styles.ts`
- `apps/app/test/conversation/entries.test.ts`
- `.agents/handoffs/2026-11-25-2000-reply-opens-child-and-parent-search.md`
