# Handoff: Ritual menu placement

Supersedes: none (forked from `2026-11-22-2123-ritual-form-panel.md`)
Workspace: Outlore, `worktree/ritual-menu-placement`, targeting `origin/main`.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Confirm that Ritual creation and editing appear in the middle panel and that a saved Ritual's tabs and Companion settings work in the running app.

## State

Verified with `git log` and the committed diff: `2efda783` implements CHG-0660 on top of `ad4740b9`.
Recorded verification from the implementation turn: Biome, seven workspace typechecks, 40 focused tests and eight related pre-commit tests passed.
Verified before this handoff with `git ls-remote origin refs/heads/main`: remote main was at `ad4740b9`, and the fast-forward push was pending.
Live desktop and paired-phone acceptance remain open.

## Decisions

The regular Companion selector on the form and the Companions tab edits the Ritual's primary and ordered fallback Companions for future runs.
Missives continues to show run history while editing a Ritual by message remains an open product decision.

## Next

1. Check that remote main contains `2efda783` and this handoff.
2. Follow the wide, narrow and paired-phone acceptance steps in [work in progress](../../documentation/work-in-progress.md#ritual-form-and-tabs--2026-11-23--window-check-pending).
3. Record the owner's acceptance or any placement, navigation, or selector issues discovered in the running app.

## Open questions

The owner has yet to decide whether Missives should accept requests to edit a Ritual.

## Sources

- Implementation commit `2efda783`.
- [CHG-0660](../../documentation/changelog/0.2.3-Pre-Alpha.md#chg-0660--2026-11-23--ritual-form-placement-and-companion-selection).
- [Rituals specification](../../documentation/capabilities/rituals/specifications.md).
