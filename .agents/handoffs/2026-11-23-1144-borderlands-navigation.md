# Handoff: Borderlands navigation

Supersedes: none
Workspace: Outlore, main

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Open Borderlands chat directly from its sidebar heading on desktop and phone.

## State

Verified in the sidebar diff that the heading opens the channel, its chevron folds the quest list, and the separate chat row is gone.
Workspace lint and typecheck passed during implementation.
Interaction in a running app remains unverified.

## Decisions

Match realm navigation so the chat stays accessible while the quest list is folded.

## Next

1. In desktop and phone layouts, select Borderlands with its quests folded and confirm the chat opens.
2. Use the chevron to expand and collapse the list and confirm the current conversation stays selected.

## Open questions

None.

## Sources

- `apps/app/src/shell/sidebar.tsx`
- `apps/app/src/shell/railQuests.tsx`
- `documentation/capabilities/conversation-panes/specifications.md`
