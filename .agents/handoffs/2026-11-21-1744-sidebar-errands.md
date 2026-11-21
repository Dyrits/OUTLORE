# Handoff: Sidebar errands

Supersedes: none
Workspace: Outlore, `worktree/sidebar-errands-publish`, based on `6ba6cdb0`.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Restore nested errands in the desktop sidebar and open the Quests and Errands tabs from their sidebar links. Confirm both links in a running window.

## State

The sidebar changes and verification notes were committed on `worktree/sidebar-errands` as `b1504dfa` and `61f699e0`. The landing branch applies those changes on top of the Workshop permission modes. The [verification record](../../documentation/verification/2026-11-21-sidebar-errands.md) records the test runs and the pending window check. Check the current remote ref to see whether the landing commit reached `main`.

## Decisions

Wide windows open the realm or Borderlands Quests tab and the quest Errands tab. Narrow windows open the corresponding list views. Local `main` has a separate Rituals commit, so this delivery starts from the remote tip.

## Next

1. Run the window checks in the verification record with a quest that has nested errands and a realm with more than five quests.
2. Record the observed results.

## Open questions

The desktop and narrow-screen interactions still need a window check.

## Sources

- [Conversation panes](../../documentation/capabilities/conversation-panes/specifications.md)
- [Mission tracking](../../documentation/capabilities/mission-tracking/specifications.md)
- [Verification record](../../documentation/verification/2026-11-21-sidebar-errands.md)
