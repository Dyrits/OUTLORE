# Handoff: Verify quest and errand notches

Supersedes: none
Workspace: Outlore, `main` after publication

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Verify the two right-edge controls in the running desktop app and confirm the interaction with the owner.

## State

- Verified from commit `1cacbfbe` and the staged diff against `688a0272` that the batch is applied on top of the published notice timestamp change.
- Verified on the implementation branch that the 20 focused tests passed and Biome reported two existing warnings in the architecture audit.
- Assumed pending: a live desktop check of the controls, especially after folding a pane.

## Decisions

- The owner chose to open the existing Quests or Errands tab in the current pane after considering a sidebar picker.
- The list notch carries the highest active urgency and remains available on an empty list.
- Left-edge notches reopen folded parents directly, and the Ritual pane offers Errands for its runs.

## Next

1. In a desktop window, open a realm channel and use both right-edge controls with an empty list and again with several active quests.
2. Repeat with errands, including a folded errand and a folded parent pane, and confirm the list notch's urgency dot.
3. Check the labels with keyboard focus and confirm the visual result with the owner.

## Open questions

Does switching to the list tab feel right when moving between several active conversations? The owner can answer after using the desktop build.

## Sources

- [Conversation panes specification](../../documentation/capabilities/conversation-panes/specifications.md#panes)
- [Working state](../../documentation/work-in-progress.md#two-child-controls-on-conversation-panes--2026-11-24)
- [Pane edge tests](../../apps/app/test/shell/paneNotches.test.ts)
