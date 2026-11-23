# Handoff: Errand notch order

Supersedes: none
Workspace: OUTLORE, `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Show errand notches in the same top-to-bottom order as the sidebar, including when an errand pane is folded.

## State

- Verified by source inspection: the quest edge follows the sidebar tree order and places a folded errand at its position in that tree.
- Recorded verification: 46 focused tests, workspace lint, and all seven typechecks passed.
- The running app has yet to be checked.

## Decisions

- The sidebar tree sets the order of errand shortcuts.
- The existing shortcut limit, overflow state dot, and inactive errand filtering still apply.

## Next

1. In the desktop app, open a quest with errands whose activity order differs from their sidebar order.
2. Compare the notches with the sidebar, then fold an errand pane and compare again.

## Open questions

None.

## Sources

- `documentation/capabilities/mission-tracking/specifications.md`
- `documentation/verification/2026-11-23-errand-notch-order.md`
- `apps/app/src/shell/paneNotches.ts`
