# Handoff: Pane notch titles

Supersedes: none
Workspace: OUTLORE, `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Make folded quest and errand panes and their shortcuts identifiable when several share an emblem. Finish by checking the title cards in the desktop window.

## State

- Verified by inspecting commit `e5ca2600` on local `main`. CHG-0630 uses the shared `PaneNotches` component to show each notch's title on pointer hover and keyboard focus.
- Verified by reading the recorded evidence. The implementation session reported passing Biome, workspace typecheck, and 704 app tests. The app run included concurrent edits from another session.
- Desktop visual verification remains pending in the verification record and work in progress. Check the current remote branch with Git if publication status matters.

## Decisions

- Use a title card extending inward from the notch. This preserves the compact stack and keeps opening a conversation to one press.
- Use the shared notch component for folded panes and shortcuts. The native web title attribute issue is documented in the verification record.

## Next

1. In the desktop app, open a quest with several errand shortcuts and folded panes. Check titles on hover and Tab focus, placement on both edges, long titles, and the light and Gild looks. Confirm one press opens the intended conversation.
2. Record the desktop results in the verification record and update the work-in-progress entry.

## Open questions

- Desktop inspection will show whether the inward placement stays readable with stacked notches and long titles.

## Sources

- [PaneNotches implementation](../../apps/app/src/shell/paneStrip.tsx)
- [Conversation panes specification](../../documentation/capabilities/conversation-panes/specifications.md)
- [CHG-0630 release record](../../documentation/changelog/0.2.2-Pre-Alpha.md)
- [Verification record](../../documentation/verification/2026-11-22-notch-titles.md)
- [Work in progress](../../documentation/work-in-progress.md)
