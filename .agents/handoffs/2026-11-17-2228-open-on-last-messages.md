# Handoff: conversations open on their last messages

Supersedes: none
Workspace: OUTLORE, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

A quest, a side-quest, and Chronicler's conversation open on their newest entry, not part way up. Done when the owner sees that in the running app (desktop window, and a phone if the phone build is in use), on a long thread too, and the owner accepts the look.

## State

The change is in the working tree on `main`, committed as the step that follows this handoff (see Next).

- Done: the feed is an inverted list. `useFollowNewest(entries)` in `apps/app/src/conversation/useConversationFeed.ts` returns `data` newest first, `inverted: true`, and `follow()` scrolls to offset 0 on send. The scroll-to-end-on-measure logic and its scroll tracking are removed. Verified: file read and diff.
- Done: `newestFirstOf` in `apps/app/src/conversation/entries.ts`; the two feeds (`conversation.tsx`, `guildmaster.tsx`) drop `data={entries}` and move the draft footer to `ListHeaderComponent` (it draws at the bottom of an inverted list); `useThreadConversation.ts` computes `entries` before the hook. Verified: diff.
- Done: two tests in `apps/app/test/conversation/entries.test.ts` ("newestFirstOf" block, nested in the turn-actions describe). Verified: `ELECTRON_RUN_AS_NODE=1 node_modules/.bin/electron node_modules/vitest/vitest.mjs run apps/app/test/conversation` from the repository root gave 8 files and 63 tests passing, run after the last code edit.
- Done: `bun run typecheck` in `apps/app` passes (`tsc --noEmit`, no output). Verified: run after the last code edit.
- Done: `bunx biome check apps/app/src/conversation apps/app/test/conversation` reports no fixes needed. Verified: run after the last code edit.
- Done: CHG-0442 in `documentation/changelog/0.1.7-Prototype.md` (Agreement and Delivery); a "Conversation opens on its last messages" section at the top of `documentation/work-in-progress.md`; a sentence appended to the backlog's "Scroll indicator, to settle" item. Verified: file read after the edits in the same session.
- Not verified: the old fault itself. The earlier approach (scroll to the end on each content measurement) was not reproduced, so the cause of "not opening on the last messages" is not confirmed. The inverted list removes that code path rather than fixing a proven bug. Assumed.
- Not verified: the running app. No window or phone was driven, and no web export was built for this change. Assumed to behave as the list pattern does: an inverted list starts at its origin, and content added at the origin keeps the view at the bottom while the offset is 0. react-native-web's inverted support flips the header and footer back (`node_modules/.bun/react-native-web@0.21.4+*/…/dist/vendor/react-native/VirtualizedList/index.js`, `inversionStyle`). Assumed.
- Not verified: wheel or trackpad scrolling on web in the inverted list (react-native-web has a patch for inverted wheel handling, but it was not exercised), the Guildmaster's empty state, a long thread's performance, and the full suite.
- Known unrelated: `apps/app` tests `pairingOffer.test.ts` and `qrScan.test.ts` fail to load (`Cannot find package '@outlore/channel/base64url'`) when run as a whole folder. Not touched by this change. Assumed from earlier handoffs; not re-run here.

## Decisions

- Inverted list rather than scroll-to-end: the owner asked that the conversation open on its last messages; an inverted list starts at its end without a scroll pass, and new entries land there. Recorded in CHG-0442 (`documentation/changelog/0.1.7-Prototype.md`).
- The scroll cue is not decided. The owner said so explicitly, and it stays in the backlog as "Scroll indicator, to settle" (`documentation/backlog.md`). This change does not show or hide any scroll indicator.
- Sending returns the view to the newest entry (`follow()` scrolls to 0), as before.
- The number: CHG-0441 was taken on `origin/main` by Code Mode's core (CHG-0441, `documentation/changelog/0.1.7-Prototype.md`) while this change was rebased onto it, so this change is CHG-0442.

## Next

1. Commit the working tree on `main` with a message naming CHG-0442, including this handoff and the `AGENTS.md` pointer. Done in the same session as this handoff, unless the commit is already in `git log`.
2. Push `main` to `origin` after the owner approves the push (the pre-push hook and the Git guard apply).
3. The owner looks at a quest with many messages in the desktop window: it should open at the newest message, a reply should land there, scrolling up should hold the place, and sending should bring the view back down. Then the owner decides about the scroll cue.
4. If the window shows the view not at the newest message, the inverted list is the thing to inspect (`apps/app/src/conversation/useConversationFeed.ts`); the earlier approach is in git history before this commit.

## Open questions

- Does the owner accept the look in the window and on a phone? Owner decides.
- How the scroll position is shown (what the cue is, when it shows, which regions get it). Owner decides; see the backlog.
- Is a long thread fine on a phone? Not yet measured. Owner or a window check decides.

## Sources

- `apps/app/src/conversation/useConversationFeed.ts` (`useFollowNewest`)
- `apps/app/src/conversation/entries.ts` (`newestFirstOf`)
- `apps/app/src/conversation/conversation.tsx`, `apps/app/src/conversation/guildmaster.tsx`, `apps/app/src/conversation/useThreadConversation.ts`
- `apps/app/test/conversation/entries.test.ts`
- `documentation/changelog/0.1.7-Prototype.md` (CHG-0442)
- `documentation/work-in-progress.md` (section "Conversation opens on its last messages")
- `documentation/backlog.md` ("Scroll indicator, to settle")
- Quest journal entry 1 (2026-11-17, the batch's summary)
