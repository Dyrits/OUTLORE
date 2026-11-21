# Handoff: Architecture audit follow-through

Supersedes: none
Workspace: Outlore, `worktree/audit-follow-through`, based on `eaf8fb69` with main through `e8fff58d` integrated

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Complete the relevant findings from the 2026-11-21 architecture audit. Verify the refactored pane and Chronicle behavior in a desktop window.

## State

- Verified against Git and the verification record. Commit `b9002803` implements A1–A5, B1–B4, C1–C3, and the duplicate restart-key lookup portion of C5. Merge `9c073e89` preserves the channel-fold default from main.
- Recorded automation passed. The full suite passed 2,673 tests with 64 skipped before the channel-fold merge. After that merge, 688 app tests passed with 6 skipped, and the app typecheck, Biome and Expo web export passed.
- Window interaction remains open. Both isolated Electron launches ended with `SIGABRT` before the window opened.

## Decisions

- Keep C4's SQL as written. Replies filter and count unread messages. Waiting and Failed retain their rows and compute a read flag.
- Keep C5's startup grant lookup because the grants can change while folder approval waits on the owner.
- Preserve the channel-fold default through the empty loading chain and the older-host fallback for Chronicle targets that omit the question ID.

## Next

1. Open a desktop build of the audit branch with an isolated data folder. If Electron still aborts, record the launch error before checking the interface.
2. Open a quest and confirm that the channel starts folded and opens through its notch. Check pane resizing, narrow and wide sidebars, Workshop return, and Chronicle links to messages and requests.
3. Record the window results in the verification record and update the work-in-progress note.

## Open questions

Do the pane and Chronicle changes behave as expected in a running desktop window?

## Sources

- [Architecture audit](../../documentation/architecture-audit/architecture-audit-2026-11-21-0702.html)
- [Verification record](../../documentation/verification/2026-11-21-architecture-follow-through.md)
- [Conversation panes specification](../../documentation/capabilities/conversation-panes/specifications.md)
- `b9002803`, `9c073e89`, and `e8fff58d`
