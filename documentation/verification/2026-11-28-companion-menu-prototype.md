# Proof: the Companions tab and shared chain editor follow the prototype

- **Verdict:** not proven (C1 to C3 and C7 proven; C4 unproven; C5 and C6 await a human eye)
- **Work:** working tree on `1fb76dac` (branch `feat/companion-menu-prototype`, uncommitted when verified)
- **Agreement:** the owner's requests in this quest (2026-11-27, 2026-11-28): the menu "should look like the prototype", left and right columns balanced in width, rows named by their model instead of "Backup 1, 2, 3", no "Custom" entry and no "Presets" header, the prototype's behavior; [companion-presets specifications](../capabilities/companion-presets/specifications.md) as updated by CHG-0796.
- **Environment:** macOS (Darwin 27.2), Bun and Vitest from the repository, `react-native-web` rendering to static markup, sandboxed shell; no desktop window, browser or phone was driven.
- **Date:** 2026-11-28

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | The list has one card for each preset, no "Presets" header and no Custom entry, whatever the thread's stack | request | proven |
| C2 | Each card lists its models numbered, with provider icon, model (account in brackets) and effort; rows of the editor are named by model, never "Backup N" or "Companion" | request | proven |
| C3 | The footer reads "Nothing changed yet." / "You changed this companion.", its buttons are disabled until a change, and a new companion offers Save as new and Discard but no Overwrite | request, specifications | proven |
| C4 | Choosing a card hands its stack to the thread, and Overwrite or Save as new from a thread also hand the saved chain to the thread | specifications | unproven |
| C5 | The two columns have equal width and the look matches the prototype | request | awaiting human judgment |
| C6 | Choosing a card, unfolding a row and dragging feel fluid (the owner's remark of 2026-11-28: "lack of fluidity") | request | awaiting human judgment |
| C7 | Nothing else regressed | repository checks | proven |

## Evidence

### C1: cards without header or Custom

- **Check:** `CI=1 bunx vitest run apps/app/test/editors/presetEntries.test.ts apps/app/test/editors/presetChooser.test.ts apps/app/test/editors/companionPicker.test.ts` ("marks no preset and adds no Custom entry when the stack matches none", "lists each numbered model of a companion's chain under its name without a Presets header", "shows no Custom entry and no Presets header when the stack matches no preset").
- **Shown able to fail:** the same tests asserted the opposite (a Custom entry, a "Presets" title) before this change; mutation was not run.
- **Result:** pass in the full run below.
- **Reproduced:** by the author only.

### C2: numbered rows named by model

- **Check:** `presetChain.test.ts` ("naming a Companion in a row"), `presetChooser.test.ts` (card chain), `companionPicker.test.ts` ("shows the selected companion directly in the unified chain editor with model names", "shows the model name rather than Companion while backups are unread").
- **Shown able to fail:** not run (no mutation); the tests replaced assertions on "Backup 1" and "Companion".
- **Result:** pass in the full run below.

### C3: the footer

- **Check:** `presetChain.test.ts` ("showing the footer of the chain editor"), `presetChooser.test.ts` ("controlling a draft in the chain editor", "editing a companion not made yet").
- **Result:** pass in the full run below. Not shown able to fail.

### C4: handing the stack to the thread

- **Check:** `threadPresets.test.ts` covers the preset layer (`presetChoiceOf`), not `ThreadPresetCard`, which calls `presetChoice.onPreset` after Overwrite and Save as new. No test renders that component with a pressed button.
- **Result:** unproven. A component test with a recorded `onPreset` would prove it.

### C7: regressions

See the table below.

## Regressions

| Check | Command | Starting commit | End state |
| --- | --- | --- | --- |
| Lint | `bunx biome check apps/app/src/editors apps/app/src/settings apps/app/test/editors apps/app/test/settings` | not run | pass (94 files) |
| App typecheck | `cd apps/app && bunx tsc --noEmit` | not run | pass (exit 0) |
| App tests | `CI=1 bunx vitest run apps/app` | not run | pass (136 files, 1,153 passed, 6 skipped by the sandbox) |
| Workspace typecheck | `bun run typecheck` | not run | run by the pre-commit hook |

## Not proven

- C4: needs a component test of `ThreadPresetCard` pressing Overwrite and Save as new.
- C5 and C6: appearance and feel; screenshots or a recording of the desktop window are needed, and the owner's eye.
- No mutation or before-and-after run was made for C1 to C3; they stay as strong as their tests.

## Reproduce

```sh
bunx biome check apps/app/src/editors apps/app/src/settings apps/app/test/editors apps/app/test/settings
(cd apps/app && bunx tsc --noEmit)
CI=1 bunx vitest run apps/app
```

## New files

None. The tests of `apps/app/test/editors` were rewritten for the new behavior.
