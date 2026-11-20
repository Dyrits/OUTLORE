# Handoff: Desktop sidebar and conversation pane review

Supersedes: `2026-11-20-1211-sidebar-and-composer.md`
Workspace: Outlore, `worktree/sidebar-refresh`, based on `94d50905`; delivery target is `origin/main`.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Review the desktop sidebar, channel headers, list actions, and composer spacing in a running window.

## State

- Verified in the source diff that the sidebar uses one content-edge rule and puts a section divider between Chronicle and Realms.
- Verified in the source diff that realm and Borderlands headers omit the Chronicler subtitle and that their Quests lists offer creation before the first row.
- CHG-0589 and CHG-0590 record the Errands action and the errand composer changes, with the focused verification runs for each delivery.
- Desktop visual acceptance is pending.

## Decisions

- Use the same section divider above Realms as above Borderlands.
- Put list creation actions above existing entries so they are available in empty lists.
- Use the shared composer spacing across chat panes and keep the pane inset around the new errand form.

## Next

1. Check the sidebar divider in docked, pinned, and overlay modes, and check the Chronicle separator.
2. Open Missives and Quests in a realm and in Borderlands, then exercise New quest and New errand from their respective tabs.
3. Compare the composers at the bottom of the channel, quest, and new errand panes, and check the running-turn placeholder at a narrow width.

## Open questions

Does the divider weight and input spacing feel consistent in the owner's desktop window?

## Sources

- [Conversation panes specification](../../documentation/capabilities/conversation-panes/specifications.md)
- [Release changelog, CHG-0587 through CHG-0590](../../documentation/changelog/0.1.13-Prototype.md)
- [Sidebar render](../../apps/app/src/shell/sidebar.tsx)
- [Channel quest list](../../apps/app/src/shell/channelQuests.tsx)
- [Quest and errand panes](../../apps/app/src/conversation/paneThread.tsx)
