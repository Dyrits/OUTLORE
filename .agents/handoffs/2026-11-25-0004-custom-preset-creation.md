# Handoff: a custom preset is created in the Companions tab

Supersedes: none
Workspace: OUTLORE repository, branch `main`, code commit `c2001b8d` on top of `746c3001` (release 0.2.5-Pre-Alpha)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner wants a custom Companion preset to work like the built-in ones from the moment it is created: set up in the Companions tab beside the Workshop, not in a form below the list.
Done means Add preset asks for a name and then opens the new preset in that tab, and the owner has seen it in a running window.

## State

- Background (verified, by source and git history): CHG-0684 (`43808bfc`, shipped in 0.2.5) made a saved custom preset show the same Harness, Model, and Backups table as the built-in tiers. It left the creation form alone, which still showed the full stack picker below the list, with clipped effort labels in its backup rows.
- Change (CHG-0711, commit `c2001b8d`):
  - `AddPreset` in `apps/app/src/settings/presetActions.tsx` is a name-only `PresetNameForm`. It saves the preset on the default Companion with no backups (`Add` edit), then calls `reveal("custom:<name>")`.
  - `apps/app/src/settings/workshopTabs.tsx` holds `revealing`, `reveal`, and `revealed`.
  - The chevron in `apps/app/src/settings/companionTable.tsx` presses itself when `revealing` equals its own focus, so the tab opens once the new preset's table is on the page.
  - The thread Companions tab's "Save as a preset" form was not changed: it already asks only for a name.
- Verified now: workspace typecheck, Biome, and the related tests passed through the pre-commit hook on `c2001b8d`; 56 tests under `apps/app/test/settings` and `apps/app/test/editors` passed before the commit.
- Assumed, not checked: the behavior in a running desktop window. No test covers the reveal, because effects do not run in the repo's static layout tests.
- Landing: `c2001b8d` and this handoff are pushed to `origin/main` together, after the owner approved the push. Check with `git branch -r --contains c2001b8d`.
- The release note for the next tag is still to write: the next version file is `documentation/changelog/0.2.6-Pre-Alpha.md`, created with CHG-0711.

## Decisions

- Owner, 2026-11-24: a custom preset should be set up in the Companions tab from creation, as the built-in tiers are. Recorded in CHG-0711.
- The preset starts on the default Companion with no backups. The owner did not ask for another starting point; change it in `AddPreset`'s caller in `presetsCard.tsx` if they do.
- No worktree was made for this work: it ran in the main checkout, so there was none to delete. The many `.worktrees/*` folders belong to other quests and were left alone.

## Next

1. Ask the owner to try it in a desktop window: Workshop → Presets → Add preset, type a name, Save preset. The new preset should appear in the list and open in the Companions tab, where choosing a model or adding a backup saves at once.
   Also try it with the tab already open on another preset, and with the tab closed.
2. If the tab does not open or toggles shut, look at the `useEffect` in `Chevron` (`companionTable.tsx`): it calls `onPress`, which toggles when the tab already shows that table.
3. If it holds, nothing else is planned.

## Open questions

- Should the new preset start from the default Companion and its backups (as now: Companion only, no backups), or copy the default backups too? The owner can say.

## Sources

- `apps/app/src/settings/presetActions.tsx`, `workshopTabs.tsx`, `companionTable.tsx`, `presetsCard.tsx`
- `documentation/changelog/0.2.6-Pre-Alpha.md` (CHG-0711) and `documentation/changelog/0.2.5-Pre-Alpha.md` (CHG-0684)
- `documentation/capabilities/companion-presets/specifications.md`
