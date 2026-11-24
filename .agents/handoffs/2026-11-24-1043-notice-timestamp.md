# Handoff: Outlore notice timestamps

Supersedes: none (forked from `2026-11-22-0255-inactivity-missives.md`)
Workspace: Outlore, `worktree/notice-timestamp` based on `bb861db7`, targeting `origin/main`.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Show when Outlore posted an inactivity notice and make the notice easier to scan in the realm's Missives.

## State

- Verified in the rebased source that the notice header displays the stored posting date and time beside the Outlore label and quest shortcut.
- Verified from the previous run's output that 90 focused tests and the workspace typecheck passed before rebasing onto the 0.2.4 release.
- The running layout remains unverified.

## Decisions

- Reuse the locale-aware message timestamp so existing notices display their original posting time.
- Put the quest shortcut in the header and let the message use the full card width below the divider.

## Next

1. Open a realm's Missives with an inactivity notice in the running desktop app.
2. Check that the timestamp matches when the notice was posted, that the text wraps at phone width, and that the shortcut opens the linked quest.

## Open questions

- The owner can judge the revised card once it is visible on desktop and on a paired phone.

## Sources

- [Notice renderer](../../apps/app/src/conversation/conversationEntries.tsx)
- [Notice styles](../../apps/app/src/foundation/styles.ts)
- [Inactivity specification](../../documentation/capabilities/mission-tracking/specifications.md#ending-a-mission)
- [Release entry](../../documentation/changelog/0.2.5-Pre-Alpha.md)
