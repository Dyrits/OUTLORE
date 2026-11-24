# Handoff: Segmented pane tabs

Supersedes: none
Workspace: Outlore, `worktree/segmented-pane-tabs` based on `688a0272`, targeting `origin/main`.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Match the segmented style in the owner's reference screenshot for the conversation pane tabs.

## State

- Verified in the component source that the tabs share a rounded track and the selected tab uses a filled pill with higher-contrast text.
- Verified in the component source that touch tabs still scroll horizontally and expose the currently selected tab to assistive technology.
- The previous session reported a passing Biome check and app typecheck.
- Appearance and interaction in the running app remain unverified.

## Decisions

- Apply the reference style to the shared `PaneTabs` component so realm, quest, and errand panes use the same control.
- Use the theme's control colors and radii to carry the treatment across themes.

## Next

1. Open the realm channel, a quest, and an errand on desktop and compare the selected tab and track with the reference.
2. On a paired phone, swipe through the tabs and check that selection, text contrast, and tap targets work in light and dark themes.

## Open questions

- The owner can confirm the visual match in the running app.

## Sources

- [Shared pane tabs](../../apps/app/src/conversation/paneTabs.tsx)
- [Conversation panes specification](../../documentation/capabilities/conversation-panes/specifications.md)
- [Release entry](../../documentation/changelog/0.2.5-Pre-Alpha.md)
