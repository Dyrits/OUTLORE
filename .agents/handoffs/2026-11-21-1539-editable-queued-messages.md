# Handoff: Editable queued messages

Supersedes: none
Workspace: Outlore, `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Keep pending messages at the bottom of the conversation through steering. Let the owner edit or remove them while Outlore holds them in its queue.

## State

- Verified on local `main` by Git history. `84bb9552` brings in CHG-0615 and `ea6431f4` records its verification. The changes were developed on `worktree/editable-queued-messages`.
- Verified against the recorded results in [work in progress](../../documentation/work-in-progress.md#editable-queued-messages--2026-11-21--window-check-pending). Biome, workspace typecheck, and the full suite passed on the feature worktree with 2,682 tests passed and 64 skipped. The desktop build passed. Its development server did not listen, so the window check remains open.

## Decisions

- Use delivery acknowledgment to determine how long a message stays at the bottom. Steer ends the edit window because the harness may accept the message before Outlore sees the acknowledgment.
- Edits keep the message's queue position and attachments. Removal withdraws both the message and its attachments.

## Next

1. Launch the desktop app with the fake harness and an isolated data directory. During a long turn, queue two messages, edit one, and remove the other.
2. Steer the edited message. Verify it stays below the live reply until delivery, and check that only the edited text reaches the harness.

## Open questions

Desktop interaction and layout still need a window check.

## Sources

- [Thread messaging specification](../../documentation/capabilities/thread-messaging/specifications.md)
- [CHG-0615](../../documentation/changelog/0.2.1-Pre-Alpha.md#chg-0615--2026-11-21--editable-queued-messages)
- Commits `84bb9552` and `ea6431f4`
