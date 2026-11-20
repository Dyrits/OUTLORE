# Handoff: desktop conversation panes

Supersedes: `2026-11-19-2330-conversation-panes-batches-1-2.md`
Workspace: Outlore, branch `mission/slack-like-conversation-panes-83921a40`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Review the desktop channel, quest and errand panes with the owner before integrating the branch. Phone navigation and pane identity are deferred.

## State

- Verified by fake-harness tests and SQLite restart. Reply anchors retain the message, the thread parent and the errand brief. From an errand, a delegation call posts an attributed follow-up in the quest. The owner’s Reply can turn it into a sibling errand.
- Verified by automated checks. Channels have distinct identities, including realms without a folder, and inherit the realm’s lore. A quest move transfers its anchor between channels.
- The worktree contains the desktop sidebar and the quest’s Messages and Errands views. The verification note records the browser launch failure and the checks that ran.

## Decisions

- Realm chevrons control sidebar groups. Realm names open chat, quest rows open quests, and errands open inside their quest.
- Chronicle is a separate desktop destination for activity and reminders. Conversations start in channels.
- Legacy descendants keep their parent and reuse the third pane. New errands open directly beneath the quest.

## Next

1. Inspect the desktop sidebar, Reply flow, both quest tabs, navigation between legacy descendants, and Workshop return in a window.
2. Review the worktree with the owner. Integration requires separate authorization.

## Open questions

- The owner’s judgment of the desktop layout and the placement of the Errands tab.

## Sources

- `documentation/capabilities/conversation-panes/specifications.md`
- `documentation/capabilities/conversation-panes/blueprint.md`
- `documentation/verification/2026-11-19-conversation-panes.md`
- `documentation/changelog/0.1.13-Prototype.md`, CHG-0565 to CHG-0567
