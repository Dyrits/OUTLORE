# Handoff: conversation pane folding and title pickers

Supersedes: `2026-11-20-1112-conversation-pane-polish.md`
Workspace: Outlore, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Review folding, restoring, and switching conversations in the desktop window.
Resume the Chronicle attention follow-up when the owner asks.

## State

- Verified in the local diff against `1a24828a`: the earlier pane polish and Quest sidebar changes are present alongside grouped folded strips, the Errand composer and title picker changes, Restore with one open pane, and the title picker styling.
- Earlier checks recorded in the quest journal include 33 passing pane-layout tests after the Restore change and passing Biome and workspace typechecks after the picker styling change.
- An earlier shell and conversation run reported 214 passes, two failures and one error, including a conversation-send failure whose cause remains unverified.
- Desktop appearance and interaction remain unverified.

## Decisions

- Adjacent folded panes share one 44 px strip, with equal sections stacked vertically and each section reopening its pane.
- The Quest composer leaves errand creation to the Errand pane in the pane layout and keeps its Open errand button in the single-conversation layout.
- The open title button and selected row use squircle corners where supported and an 8 px radius elsewhere.

## Next

1. Fold adjacent panes in the desktop window, reopen each from its strip, and check that Restore brings back the previous widths.
2. Start and switch errands from the Errand pane, including switching from New errand when two or more errands exist, and review the title chevron and selected row.
3. Review the narrow layout and the three Knows panels, then resume the Chronicle follow-up when requested.

## Open questions

- Confirm with the owner that the sections of the shared strip should stack vertically.
- The scope of future Skills and Tools switches is open.

## Sources

- [Changelog](../../documentation/changelog/0.1.13-Prototype.md)
- [Conversation panes specification](../../documentation/capabilities/conversation-panes/specifications.md)
- [Thread panel specification](../../documentation/capabilities/thread-panel/specifications.md)
- [Pane layout tests](../../apps/app/test/shell/paneChain.test.ts)
