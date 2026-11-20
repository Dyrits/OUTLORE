# Handoff: conversation pane polish

Supersedes: `2026-11-20-0847-conversation-panes-blank-panel-fix.md`
Workspace: Outlore, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Review the desktop conversation panes with the owner after integrating the requested changes.
Resume the Chronicle attention follow-up when the owner asks.

## State

- Verified against the worktree diffs: CHG-0572 through CHG-0576 and CHG-0582 are combined in the main checkout from `1a24828a`.
- The changelog records checks run in the individual worktrees.
- Existing first-message copies remain in realm history.
- Desktop and narrow layout appearance and interaction still await review.

## Decisions

- Messages sent from an empty quest's composer stay in the quest.
- Use the specifications for pane controls, title pickers, errand actions and the Quest sidebar.

## Next

1. Check folding the deepest pane, expanding and restoring a pane, Equal widths, creating an errand and switching titles in the desktop app.
2. Check the errand header actions on desktop and in a narrow window, and open the three Knows panels.
3. Resume the Chronicle attention follow-up when requested.

## Open questions

- Sharing one strip between adjacent folded panes awaits the owner's decision.
- The scope of future Skills and Tools switches is open.

## Sources

- [Changelog](../../documentation/changelog/0.1.13-Prototype.md)
- [Conversation panes specification](../../documentation/capabilities/conversation-panes/specifications.md)
- [Thread panel specification](../../documentation/capabilities/thread-panel/specifications.md)
- [Previous verification](../../documentation/verification/2026-11-19-conversation-panes.md)
