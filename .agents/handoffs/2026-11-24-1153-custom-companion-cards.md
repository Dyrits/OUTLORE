# Handoff: Custom Companion cards

Supersedes: none
Workspace: OUTLORE, prepared on `worktree/publish-custom-companion-cards` for `origin/main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Verify in the running Workshop that custom Companion presets look and edit like the built-in presets.

## State

- Verified by source review: custom and built-in presets share the Harness, Model, and Backups rows and open the same Companions panel from the table chevron.
- Verified on the implementation worktree before moving it onto `27800a6c`: workspace Biome and typecheck passed, as did the 18 focused picker and preset tests.
- The Workshop still needs a visual and interaction check in the running app.

## Decisions

- Custom presets save primary and backup changes immediately through the shared editor, using the existing preset update request.
- Custom preset tabs wrap when the preset library is wider than the panel.

## Next

1. Open Workshop → Companions and compare a custom preset with a built-in preset.
2. Open the custom preset's chevron, change the primary Companion and backups, and reopen the Workshop to confirm both changes persisted.
3. Check Rename and Delete on a disposable preset, including what the panel shows after removal.

## Open questions

The owner can confirm the layout in the running Workshop.

## Sources

- [Preset specification](../../documentation/capabilities/companion-presets/specifications.md)
- [CHG-0684](../../documentation/changelog/0.2.5-Pre-Alpha.md)
- [Preset tables](../../apps/app/src/settings/presetsCard.tsx)
- [Companions panel](../../apps/app/src/settings/workshopCompanions.tsx)
