# Handoff: Inactivity warnings in realm Missives

Supersedes: `2026-11-22-0234-quest-auto-archive.md`
Workspace: Outlore, `.worktrees/inactivity-missives` on `worktree/inactivity-missives`, based on `891c972f`.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Warn in realm Missives when a quest or errand has gone quiet. Confirm the notice reads clearly and its quest link opens from the desktop app and a paired device.

## State

- Verified through the realm conversation request on a controlled clock. Attention warnings become eligible after four hours and Resting warnings after twelve hours. Outlore posts one notice per quest per sweep, with a linked quest and the count of due errands. A thread's next owner or agent message starts a new interval.
- Verified by the existing tracking suite on the starting revision and the implementation. Fulfilled quests still archive after the configured delay. The warning service does not start Companion turns.
- Verified through red and green tests, the full suite, workspace checks, builds, and independent review. See the verification record for the exact checks and limits.
- The original checkout contains unrelated daily check-in documentation. The implementation and this handoff are in the task worktree. Check the branch's publication state with Git before relying on it.

## Decisions

- Both owner messages and Companion replies reset the timer. Outlore checks at startup and hourly. It uses the message history of the errand that caused an inherited Attention state.
- Each thread can qualify once per latest message. When several errands qualify in one sweep, the notice groups them by state. Quest-panel actions and daily background check-ins have separate scope.

## Next

1. In the desktop app, open a realm's Missives with a due quest and a due errand. Check the quest title, count, warning text, and Open quest control. Open the same quest from the notice on a paired device.
2. Record the window and paired-device results in the verification record and working state.

## Open questions

Does the notice read clearly in a busy realm, and does its quest link open as expected on both devices?

## Sources

- [Ending a quest](../../documentation/capabilities/mission-tracking/specifications.md#ending-a-mission)
- [Verification](../../documentation/verification/2026-11-22-inactivity-missives.md) and [work in progress](../../documentation/work-in-progress.md)
- [Scheduled service](../../packages/service/src/work/inactivityMissives.ts) and [service check](../../packages/service/test/work/inactivityMissives.test.ts)
- [Missives feed check](../../apps/app/test/conversation/inactivityMissives.test.ts)
