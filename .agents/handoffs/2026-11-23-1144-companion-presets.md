# Handoff: Companion presets

Supersedes: none
Workspace: Outlore, `worktree/companion-presets` in `.worktrees/companion-presets`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Deliver Companion preset management to remote `main` and verify the Workshop and Companions tab in a running app.

## State

- Verified by reading the implementation and recorded tests. The Workshop can add, edit, rename and delete presets. The shared Companions panel can save the current stack.
- Verified by Git. The worktree started at `ad4740b9`.
- Verified by reading the regression assertions. The settings tests now account for the preset library and its owner-only status.
- Desktop and paired-device interaction remain unverified.

## Decisions

- Renaming a built-in preset keeps its routing role. Deleting it clears its tier assignment.
- Saving a preset copies the primary Companion and its ordered backups. The host compares names without regard to case.

## Next

1. Check the delivery commit and remote `main`. If the push is pending, finish the commit gate and obtain approval for the exact protected-branch push.
2. Follow the live checks in the verification record on the desktop and on a paired device.

## Open questions

- Does the preset card and inline save form work as expected at desktop and phone widths? Check both in a running app.

## Sources

- [Companion preset specification](../../documentation/capabilities/companion-presets/specifications.md).
- [Verification record](../../documentation/verification/2026-11-23-companion-preset-management.md).
- [Release changelog](../../documentation/changelog/0.2.3-Pre-Alpha.md), CHG-0661.
