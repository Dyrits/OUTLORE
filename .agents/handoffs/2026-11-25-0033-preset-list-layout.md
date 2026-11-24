# Handoff: the Companions panel's Presets view as tiers plus a custom list

Supersedes: `2026-11-25-0028-preset-draft-store.md`
Workspace: OUTLORE repository, branch `main`, code commit `65ce5435` on top of `e3690a5f`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

A new custom Companion preset is made in the Companions tab, like the built-in tiers, and a Companion changed in a quest, errand, or realm can be written back to the preset it came from.
Done means the owner has tried both in a running window and is content.

## State

- The owner's screenshot (2026-11-25) showed Add preset opening the panel on the Default view with no draft, which is what the build before CHG-0713 does: the tab could not see the draft. CHG-0713 (`a04164bb`) moved the draft into `apps/app/src/settings/workshopDraft.ts`.
- The owner then asked for no tab for each preset: "Light, Balanced, and Heavy" as the default ones, "a custom section, being more like a list". Done in CHG-0714 (`65ce5435`): in the panel's Presets view, `workshopCompanions.tsx` draws the three tiers as tabs, then `CustomPresets` (one row per custom preset with its Companion, the shown one marked, a "+ Add preset" row, and a "New preset / Not saved yet" row while a draft exists), then the editor of what is shown or the draft. Discard returns to the last preset shown.
- Unchanged: Overwrite in a quest's Companions tab (`editors/companionPicker.tsx`, `presetOverwrite.tsx`).
- Verified now: workspace typecheck, Biome, and the app tests passed (822 before the layout change; the pre-commit hook passed on `65ce5435`); `apps/app/test/settings/customPresets.test.ts` draws the list in three cases.
- Assumed, not checked: how the panel looks and behaves in a running window, including the draft's reveal. Effects do not run in the repo's static layout tests.
- Landing: `a04164bb`, `e3690a5f`, `65ce5435`, and this handoff are on local `main`; they are pushed to `origin/main` only if a push was approved after this was written. Check with `git branch -r --contains 65ce5435`. Two earlier requests for the push approval failed with "No running turn to approve".
- Separate problem the owner raised: they could not steer or interrupt this quest's thread. Their screenshot shows the queued-message tray with Edit and Delete icons but no Steer or Interrupt buttons. Those render only when `thread.actions.isInTurn` is true (`apps/app/src/conversation/queuedMessageTray.tsx:189`), which the service sets for state Underway, or Attention with no blocker (`packages/service/src/work/lifecycle.ts:57`). The thread row read Underway in the database while it was working, yet the app refused this thread's own tool calls with "This thread is not at work" and an approval with "No running turn to approve". So the app and the running turn disagreed about the thread's state. The cause is not found.
- The untracked `documentation/research/illustrate-p2p-direct-path.html` in the checkout is another session's; leave it.

## Decisions

- Owner, 2026-11-25: Add preset opens the Companions panel directly, with the name asked only when saving as a new preset. Overwrite belongs to quests, errands, and realms, not the Workshop. The panel shows Light, Balanced, and Heavy as tabs and custom presets as a list, with no tab for each custom preset. Recorded in CHG-0712, CHG-0714, and the Companion presets specification.
- The draft starts as a copy of the Companion the panel shows, or the default. The owner has not confirmed this.
- Overwrite is offered for built-in tiers too, after one confirmation, and targets the preset last chosen in that tab.

## Next

1. Ask the owner to try the build: Workshop → Presets → Add preset (panel closed, open on a tier, open on Default), and "+ Add preset" inside the panel. Check the list, the draft row, Save as new preset, and Discard.
2. Ask what still differs from what they want, if anything.
3. Investigate the steer and interrupt desync in its own errand: reproduce with a thread that runs several tool calls, and compare the thread row's state with what `ReadThread` returns while the tray shows no Steer button.

## Open questions

- Does the owner want the draft to start from the default Companion instead of the one shown?
- Should Overwrite survive closing and reopening the tab? It does not now.
- Why did the app consider this thread not at work while its turn was running?

## Sources

- `apps/app/src/settings/workshopCompanions.tsx`, `workshopDraft.ts`, `workshopTabs.tsx`, `companionTable.tsx`, `presetActions.tsx`
- `apps/app/test/settings/customPresets.test.ts`, `workshopDraft.test.ts`
- `apps/app/src/conversation/queuedMessageTray.tsx`, `packages/service/src/work/lifecycle.ts`
- `documentation/changelog/0.2.6-Pre-Alpha.md` (CHG-0711 to CHG-0714)
- `documentation/capabilities/companion-presets/specifications.md`
