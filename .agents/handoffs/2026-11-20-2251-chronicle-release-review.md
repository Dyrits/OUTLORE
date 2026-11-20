# Handoff: Chronicle release review

Supersedes: `2026-11-20-2154-review-follow-through.md`
Workspace: Outlore, `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Hand the review changes to the 0.2.0 Pre-Alpha release quest with their verification evidence and remaining desktop checks.

## State

- Verified by 49 focused tests in the prepared worktree: the Chronicle uses the named message or request, handles older peers without question IDs, opens quest-level notices at the latest message, and removes an approval after any answer.
- Verified on the unchanged code at `c22dbd0f`: the OpenCode plan-limit assertion reproduced on the first attempt and passed on retry.
- Verified by launch attempts: Electron and Chromium failed before loading the app, so desktop interaction remains unverified.
- Verified by matching hashes during integration: the local `styles.ts` and `questions.tsx` edits remained outside the review.

## Decisions

- An approval stays in Needs attention after reading and leaves it after Allow, Always Allow, Deny, or withdrawal.
- A Chronicle notice for a specific item opens that item, and a quest-level notice opens the latest message.
- The owner directed the push to proceed with the desktop smoke check recorded as pending.

## Next

1. Run the packaged desktop smoke check for Chronicle scrolling and request removal, Companions tab switching, and the Fulfilled errand open, fold, and reopen sequence.
2. Continue the 0.2.0 Pre-Alpha release in its release quest.

## Open questions

- Timed reminder cadence, the Realm tab, and whether Chronicler channel replies belong in the unread feed remain open.
- The previous handoff lists the remaining Standards follow-ups.

## Sources

- [Chronicle verification](../../documentation/verification/2026-11-20-chronicle-targets.md).
- [Conversation pane specifications](../../documentation/capabilities/conversation-panes/specifications.md#main-conversations-and-channels) and [CHG-0610](../../documentation/changelog/0.1.13-Prototype.md#chg-0610--2026-11-20--chronicle-links-to-messages-and-requests).
