# Handoff: desktop conversation panes and Chronicle

Supersedes: `2026-11-20-0220-desktop-conversation-panes.md`
Workspace: Outlore, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Review the desktop conversation layout for Pre-Alpha and resume the agreed Chronicle follow-up when the owner is ready.

## State

- Verified in Git: `4d175911` contains the desktop channel, quest and errand panes, Reply anchors, attributed follow-ups, quest-origin moves, and the initial Chronicle.
- Recorded verification for that commit: 2,588 tests passed and 62 skipped. Typecheck, staged Biome, and Expo export passed. Electron and Chromium failed to launch, so the revised layout still needs a window check.
- Verified in the specification: the richer Chronicle has an unread badge, an attention feed, filters, links to specific messages or requests, and History. The delivery evidence covers the initial list and conversation links.

## Decisions

- The desktop sidebar keeps expandable realm groups and quest rows. The realm name opens its chat. A quest opens its errands through the conversation or the Errands tab.
- New follow-up work from an errand starts with an attributed message in the quest. Reply opens a quest-level errand. Existing nested errands keep their stored parents and use the third pane.
- Chronicle has one sidebar item. See CHG-0569 for the attention feed and History agreement. Phone navigation and pane identity wait for a later batch.

## Next

1. Check the sidebar, both quest tabs, Reply, legacy errand return, and the Workshop round trip in a desktop window.
2. Resume the Chronicle attention feed when the owner asks to continue.

## Open questions

- Desktop interaction and appearance await the window check.
- Missives as a tab label and a realm-level Quests tab are proposals.

## Sources

- [Specification](../../documentation/capabilities/conversation-panes/specifications.md)
- [Blueprint](../../documentation/capabilities/conversation-panes/blueprint.md)
- [Verification](../../documentation/verification/2026-11-19-conversation-panes.md)
- [Changelog](../../documentation/changelog/0.1.13-Prototype.md), CHG-0565 to CHG-0567 and CHG-0569
