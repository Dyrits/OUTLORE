# Handoff: Desktop sidebar and composer

Supersedes: none
Workspace: Outlore, `worktree/sidebar-refresh`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Make the desktop sidebar feel like part of the conversation workspace and keep the running-turn composer placeholder short.
Finish with a desktop review of both changes.

## State

- Verified from the source diff that the desktop sidebar follows CHG-0587 and the shared composer shows “Write for the next turn…” while a turn is running.
- The original sidebar checks reported 141 passing shell tests, and the original composer check reported five passing conversation tests.
- Desktop appearance is pending.

## Decisions

- Keep the sidebar divider and align Chronicle with the conversation pane headings.
- Start empty desktop realms collapsed and reveal “No quests yet” when expanded.
- Keep the next-turn cue in the composer placeholder and rely on the existing controls for steering.

## Next

1. In the desktop window, compare the Chronicle heading and sidebar surface with the conversation panes.
2. Expand an empty realm, select a quest, and check the row highlight and fold controls.
3. Check that the running-turn placeholder fits in a narrow quest pane.

## Open questions

Does the sidebar feel cohesive in the desktop window, and does the shorter placeholder fit at the owner's usual pane width?

## Sources

- [CHG-0587](../../documentation/changelog/0.1.13-Prototype.md#chg-0587--2026-11-20--align-the-desktop-sidebar-with-the-conversation-panes)
- [Sidebar specification](../../documentation/capabilities/conversation-panes/specifications.md#the-sidebar)
- [Sidebar](../../apps/app/src/shell/sidebar.tsx)
- [Composer placeholder](../../apps/app/src/conversation/threadConversation.ts)
