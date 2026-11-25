# Handoff: Reply opens the child thread, on-demand parent search, and opener tail

Supersedes: none
Workspace: outlore (repository root, branch `main`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Clicking Reply on a message opens its child quest or errand directly instead of a bottom reply box, child threads know when an owner message was echoed with "Also send to", and child threads read their opener's history on demand via `read_parent_messages` (with a 5-message clipped first-turn tail for owner-opened errands).
Done means the owner has verified these behaviors in the desktop window and accepted CHG-0746, CHG-0748, and CHG-0749 (and the bundled Antigravity quota-fallback fix).

## State

- **Reply opens the child thread and copies non-Reply openings (CHG-0746) (verified: Biome, 7-workspace typecheck, `replies.test.ts` 25/25, `questOrigins.test.ts`, `questMoves.test.ts`, `instructions.test.ts`, full suite):** `ReplyToMessage.text` is optional; Reply in Chronicler or a quest creates and opens an empty quest or empty errand anchored to the message, with the bottom Reply box and starter reply banner removed (`guildmaster.tsx`, `threadPane.tsx`, `replies.tsx`, `errandStarter.tsx`, `paneHost.tsx`, `replies.ts`, `tree.ts`).
- **Non-Reply first message copy and "Also send to" awareness (verified: `replies.test.ts` 25/25, `questOrigins.test.ts`, `sendToParentControl.tsx`):** Opening a quest or errand without Reply copies the first message to the parent as conversation only (`copyOpeningToParent` in `questOrigins.ts`), reversing CHG-0572 for empty quests; migration `0078_message_sent_to_parent` records `sent_to_parent` so `deliveredTextOf` (`messaging.ts`) appends a delivery note to child threads, and `sendToParentControl.tsx` renders the parent's realm `#` or quest icon.
- **On-demand parent search and 5-message first-turn tail (CHG-0748, CHG-0749) (verified: mutation-checked and independently reproduced in `documentation/verification/2026-11-25-opener-tail-and-parent-search.md`, plus `offTopic.test.ts` 16/16 for asides):** Replaced the 40-message opener snapshot with a conversation-count line plus `read_parent_messages` (`parentMessages.ts`, migration `0079_message_search` FTS5 index with triggers and code fallback); owner-opened non-Reply errands receive the last 5 clipped (500-char) opener messages on their first turn only (`openerTailOf` in `journal.ts`, migration `0080_thread_opener_tail`, `startingContext.ts`).
- **Antigravity inline quota-reached fallback (verified: `antigravityProvider.test.ts` and `acpProtocol.test.ts` 47/47, Biome, full suite):** Added `inlineFailurePattern` in `acpProviderDefinition.ts`, `acpHarness.ts`, `acpProviders.ts`, and `antigravityProvider.ts` so `⚠ ... quota reached ...` fails the turn with `HarnessFailure` and triggers backup/Ritual fallback.
- **Full suite and lint (verified: `bun run check`, `bun run typecheck`, `bun run test`):** Biome passed (0 errors, 3 pre-existing warnings in untouched files), all 7 workspaces typechecked cleanly, and 398/403 test files passed (3,381 passed, 30 skipped, 1 pre-existing failure in `acpLaunchHygiene.test.ts` caused by the ACP session's inherited `TMPDIR`, confirmed identical on `210891d5`).
- **Assumed:** Desktop window and mobile layout appearance, live Companion use of `read_parent_messages` and the 5-message tail, and live Antigravity quota fallback have not been observed in a running desktop window.

## Decisions

- **Reply creates an empty child immediately (CHG-0746):** Both Chronicler-to-quest and quest-to-errand Reply open an empty child anchored to the message; unused empty children remain and can be deleted, with no system message posted on open.
- **Non-Reply openings copy the first message to the parent (CHG-0746):** Reverses CHG-0572 for empty quests and extends it to errands opened from the errand pane; the copy wakes no one, becomes the anchor, and is not duplicated in the child's pinned root or reply count.
- **One-place reply discipline (CHG-0746):** Thread instructions in `instructions.ts` direct children to answer their first message in the child only, and parents woken by "Also send to" to answer only when addressed to them.
- **FTS5 + 5-message first-turn tail instead of 40-message snapshot or embeddings (CHG-0748, CHG-0749):** Direct parent only, SQLite FTS5 with BM25 and porter stemming (with a code fallback if FTS5 is absent), plus a 5-message clipped first-turn tail for owner-opened non-Reply errands so short prompts like "fix this" have immediate context without per-turn token bloat.

## Next

1. Open the desktop app and verify Reply in Chronicler and in a quest, New quest then write, New errand then write, mobile layout, and the `#` / quest icon on the "Also send to" checkbox.
2. Open an errand in the desktop app with a short prompt (e.g. "fix this") and check that the first turn sees the 5-message tail and calls `read_parent_messages` when asked about earlier parent messages.
3. Settle whether `read_parent_messages` should stay limited to the direct parent or reach grandparents as well.
4. Once accepted in the desktop window, record Delivery for CHG-0746, CHG-0748, and CHG-0749 in `documentation/changelog/0.2.8-Pre-Alpha.md` and update `documentation/work-in-progress.md`.

## Open questions

- Should `read_parent_messages` also reach grandparents, or remain restricted to the direct parent (leaving older context to the quest journal)? Owner decision.
- Where does the stray "Claude" tooltip seen in the owner's earlier screenshot come from? Not yet located.

## Sources

- `documentation/changelog/0.2.8-Pre-Alpha.md` (CHG-0746, CHG-0748, CHG-0749)
- `documentation/verification/2026-11-25-opener-tail-and-parent-search.md`
- `documentation/capabilities/conversation-panes/specifications.md`
- `documentation/capabilities/thread-tree/specifications.md`
- `documentation/work-in-progress.md`
- `packages/service/src/work/parentMessages.ts`
- `packages/service/src/work/journal.ts`
- `packages/service/src/work/startingContext.ts`
- `packages/service/src/work/tree.ts`
- `packages/service/src/work/replies.ts`
- `packages/service/src/work/questOrigins.ts`
- `packages/service/src/work/messaging.ts`
- `packages/service/src/harness/acpHarness.ts`
- `packages/service/src/harness/antigravityProvider.ts`
