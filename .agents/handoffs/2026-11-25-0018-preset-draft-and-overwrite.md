# Handoff: Add preset opens a draft, and Overwrite belongs to quests

Supersedes: `2026-11-25-0004-custom-preset-creation.md`
Workspace: OUTLORE repository, branch `main`, code commit `1d5fe943` on top of `1f003fef`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

A custom Companion preset is made in the Companions tab, like the built-in tiers, and a Companion changed in a quest, errand, or realm can be written back to the preset it came from.
Done means the owner has tried both in a running window and is content.

## State

- Workshop (CHG-0712, `1d5fe943`): Add preset in Workshop → Presets opens the Companions tab on an unsaved draft. The draft starts as a copy of the Companion the tab shows (the default when on the Default tab). Its Companion and backups are chosen without saving; **Save as new preset** asks for the name, saves, and shows the new preset; **Discard**, closing the tab, or choosing another Companion drops the draft.
  - `apps/app/src/settings/workshopTabs.tsx` holds `draft`, `startDraft`, `setDraft`, `discardDraft`, and `revealing`.
  - `AddPreset` in `presetActions.tsx` calls `startDraft`; the chevron in `companionTable.tsx` presses itself to open the tab when `revealing` equals its focus.
  - `DraftPreset` in `workshopCompanions.tsx` is the draft view. `PresetNameForm` lost its unused `children` and `onCancel`.
  - It replaces the name-first flow of CHG-0711 (`c2001b8d`), already on `origin/main`.
- Quest, errand, realm (same commit): `CompanionPanel` in `apps/app/src/editors/companionPicker.tsx` remembers the preset last chosen in that tab and, once the Companion or backups no longer match any preset, shows **Overwrite “<preset>”** (`editors/presetOverwrite.tsx`) beside Save as a preset. One confirmation, then a `SetStack` edit via `onOverwritePreset` (`useThreadPresets.ts`, `threadTree.tsx`). `SetStack` works for built-in tiers by their display name (`packages/service/src/core/companionPresets.ts`).
- Verified now: workspace typecheck, Biome, and 821 app tests passed; the pre-commit hook passed on `1d5fe943`.
- Assumed, not checked: all behavior in a running desktop window. No test covers the draft, the reveal, or Overwrite, because effects do not run in the repo's static layout tests.
- Landing: `1d5fe943` and this handoff are pushed to `origin/main` together, after the owner approved the push. Check with `git branch -r --contains 1d5fe943`.
- The untracked `documentation/research/illustrate-p2p-direct-path.html` in the checkout is another session's; it was left alone.

## Decisions

- Owner, 2026-11-25: Add preset opens the side menu directly with no name first; the name is asked when saving as a new preset. Overwrite belongs to changing a preset in a quest, realm, or errand, and not to the Workshop, where each change to a saved preset already saves at once. Recorded in CHG-0712 and the Companion presets specification.
- The draft starts as a copy of the Companion the tab shows. The owner did not object; they have not said otherwise.
- Overwrite is offered for built-in tiers too, after one confirmation. Which preset it targets is the one last chosen in that tab, since a thread does not store where its Companion came from; it is lost when the tab is closed.

## Next

1. Ask the owner to try it in a desktop window:
   - Workshop → Presets → Add preset, with the tab closed, then open on a preset, then open on Default. The tab opens on a draft with Save as new preset and Discard. Saving shows the new preset in the list and the tab.
   - In a quest: choose a preset, change the model, and Overwrite appears; confirm and the preset changes.
2. If the tab toggles shut or does not open, look at the `useEffect` in `Chevron` (`companionTable.tsx`).
3. If the owner wants Overwrite to survive closing the tab, the thread would have to store its source preset: that is a service change.

## Open questions

- Should Overwrite remain after the tab is closed and reopened? It does not now.

## Sources

- `apps/app/src/settings/workshopTabs.tsx`, `presetActions.tsx`, `workshopCompanions.tsx`, `companionTable.tsx`, `presetsCard.tsx`
- `apps/app/src/editors/companionPicker.tsx`, `presetOverwrite.tsx`, `useThreadPresets.ts`
- `documentation/changelog/0.2.6-Pre-Alpha.md` (CHG-0711, CHG-0712)
- `documentation/capabilities/companion-presets/specifications.md`
