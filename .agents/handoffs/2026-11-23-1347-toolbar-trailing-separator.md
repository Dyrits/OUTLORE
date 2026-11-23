# Handoff: Conversation toolbar trailing separators

Supersedes: none
Workspace: OUTLORE, worktree/toolbar-trailing-separator, based on 60b5d6cb

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Show a conversation toolbar separator after a New Quest or New Errand button only when another toolbar control follows it.

## State

Verified by reviewing the source diff: both buttons now conditionally render their trailing separator when the quest panel button or pane controls follow.
Desktop visual acceptance is pending.

## Decisions

Use the presence of the quest panel button or pane controls to decide whether the last action needs a separator.

## Next

1. Open a desktop quest or errand whose New Errand button is the final toolbar icon and check that the button has no trailing separator.
2. Open a pane that shows a toolbar control after the New Quest or New Errand button and check that the groups still have a separator between them.

## Open questions

None.

## Sources

- [Conversation toolbar source](../../apps/app/src/conversation/threadPane.tsx)
- [Release changelog](../../documentation/changelog/0.2.3-Pre-Alpha.md#chg-0665--2026-11-23--omit-trailing-conversation-toolbar-separators)
