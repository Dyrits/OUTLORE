# Handoff: the Workshop's draft preset and Overwrite, after the first try failed

Supersedes: `2026-11-25-0018-preset-draft-and-overwrite.md`
Workspace: OUTLORE repository, branch `main`, code commit `a04164bb` on top of `b706f13b`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

A new custom Companion preset is made in the Companions tab, like the built-in tiers, and a Companion changed in a quest, errand, or realm can be written back to the preset it came from.
Done means the owner has tried both in a running window and is content.

## State

- The owner tried CHG-0712 (the draft and Overwrite, handoff 0018) and said it "doesn't really work as I want". They did not say what failed: the question about it was skipped. This is not yet known to be fixed.
- A cause found by reading the code (CHG-0713, `a04164bb`): the Companions tab is drawn by the shell, outside `WorkshopTabsProvider`, and `isSamePicker` (`apps/app/src/editors/pickerState.ts`) redraws it only when its key changes. The draft was read through the page's provider, so the tab always saw none. The draft now lives in `apps/app/src/settings/workshopDraft.ts`, a store with `useWorkshopDraft`; `workshopTabs.tsx`, `companionTable.tsx`, and `workshopCompanions.tsx` read it there. `DraftPreset` gets `onFocus` from `WorkshopCompanions` props, since the tab cannot use the provider.
- Unchanged since 0018: Overwrite in a quest's Companions tab (`editors/companionPicker.tsx`, `presetOverwrite.tsx`, `SetStack` edit). It uses the picker's own props, which `isSamePicker` does cover.
- Verified now: workspace typecheck, Biome, and 822 app tests passed (the pre-commit hook passed on `a04164bb`); a new test covers the store's notifications.
- Assumed, not checked: everything in a running desktop window, including whether the draft now shows. Effects do not run in the repo's static layout tests, so no test covers the reveal.
- Landing: `a04164bb` and this handoff are pushed to `origin/main` together, after the owner approved the push. Check with `git branch -r --contains a04164bb`.
- A shell command that created a temporary folder under `/private/tmp/claude` was refused ("This thread is not at work") twice, and the same command without it ran. Plain `CI=1 bunx vitest run apps/app` worked.
- The untracked `documentation/research/illustrate-p2p-direct-path.html` in the checkout is another session's; leave it.

## Decisions

- Owner, 2026-11-25: Add preset opens the Companions panel directly with no name asked first; the name is asked when saving as a new preset. Overwrite belongs to changing a preset in a quest, realm, or errand, and not to the Workshop. Recorded in CHG-0712 and the Companion presets specification.
- The draft starts as a copy of the Companion the tab shows, or the default. The owner has not confirmed this.
- Overwrite is offered for built-in tiers too, after one confirmation, and targets the preset last chosen in that tab (a thread does not store its source preset).

## Next

1. Ask the owner to try the Workshop again with this build, and to say what still fails: Workshop → Presets → Add preset, with the panel closed, open on a preset, and open on Default. Ask what they expected instead if it still does not match.
2. If the panel still does not show the draft, check that `AddPreset` runs `startDraft`, that `Chevron`'s effect in `companionTable.tsx` presses the table's button, and that `WorkshopCompanions` reads `useWorkshopDraft()`.
3. In a quest: choose a preset, change its model, and Overwrite should appear.

## Open questions

- What exactly did the owner see fail after CHG-0712? Only the owner can answer.
- Should the draft always start from the default Companion instead of the one shown?
- Should Overwrite survive closing and reopening the tab? It does not now.

## Sources

- `apps/app/src/settings/workshopDraft.ts`, `workshopTabs.tsx`, `workshopCompanions.tsx`, `companionTable.tsx`, `presetActions.tsx`
- `apps/app/src/editors/pickerState.ts`, `companionPicker.tsx`, `presetOverwrite.tsx`
- `documentation/changelog/0.2.6-Pre-Alpha.md` (CHG-0711 to CHG-0713)
- `documentation/capabilities/companion-presets/specifications.md`
