# Handoff: Pane header controls

Supersedes: `2026-11-21-2118-pane-expand-icon.md`
Workspace: Outlore at /Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS. The fix was prepared on `worktree/pane-header-controls` for `main`.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Show pane layout controls only when multiple conversation panes are visible. Check the outward-arrow icon in the desktop window once the fix lands.

## State

- Verified by reading the change: Expand and Fold appear in split view. Expand gives one pane the available width and leaves the other panes accessible from their edge notches.
- The desktop window review is pending. The quest journal records the app suite and the original reproduction.

## Decisions

- The Expand button uses two outward arrows. A full-width pane uses its edge notches to reopen other conversations.

## Next

1. Confirm CHG-0625 is on `main`. If a push is still pending, check the branch and obtain approval for the protected-branch push.
2. In the desktop window, open another conversation pane from its notch, expand either visible pane, and reopen its neighbor. Check the arrow icon and header spacing in both layouts.

## Open questions

- Does the arrow read clearly beside the quest completion and Fold controls in the desktop window? The owner can confirm after trying it.

## Sources

- `apps/app/src/shell/paneHost.tsx`
- `apps/app/src/ui/questHeaderButtons.tsx`
- `apps/app/test/shell/paneSession.test.ts`
- `documentation/capabilities/conversation-panes/specifications.md`
