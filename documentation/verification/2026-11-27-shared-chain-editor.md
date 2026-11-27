# Proof: shared companion chain editor (CHG-0791 to CHG-0794)

- **Verdict:** proven for every claim except C9 (the look of the effort bar and the layouts, which needs a human) and the items in "Not proven".
- **Work:** `b5abfbc..HEAD` on branch `worktree/shared-companion-editor`, the working tree clean at the time of writing.
- **Agreement:** the owner's message of 2026-11-27 14:57 on their authenticated chat, relayed with the task (the repository itself holds no approval) (shared editor everywhere, Save and Discard instead of autosave, every Workshop control kept, six-model cap kept, a vertical preset list with a live unsaved preview, Save as new, a segmented effort bar, a cap test that fails at 7, a check in the running app at desktop and phone widths), `documentation/capabilities/companion-presets/specifications.md`, and the changelog entries CHG-0791 to CHG-0794.
- **Environment:** Linux sandbox, Bun, Vitest 5.1.1, the Expo web export of `apps/app` served statically, the real service started with `OUTLORE_HARNESS=fake` on a fresh data directory (loopback WebSocket), headless Google Chrome driven by Playwright with a stand-in for the Electron preload. No desktop window, no phone.
- **Date:** 2026-11-27

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | The Workshop panel and the thread's Companions tab list presets in one vertical list and edit them in the same chain editor | owner go-ahead, spec "Workshop display" | proven |
| C2 | A preset is edited as a draft: Overwrite saves it, Discard drops it, nothing autosaves | owner go-ahead, spec "edit mode" | proven |
| C3 | Default, the tier hints, and Add, Rename and Delete of presets are still in the Workshop | owner go-ahead | proven |
| C4 | A chain holds at most six models (a primary and five backups) | owner go-ahead, existing contract | proven |
| C5 | The list shows a preset's unsaved draft, and marks the preset in edit mode apart from the thread's own checked Companion | owner go-ahead, review finding | proven |
| C6 | Save as new creates the preset, selects it, clears the source draft, refuses a taken name, and survives a reload | owner go-ahead | proven |
| C7 | Rows reorder by pointer drag in both directions | owner go-ahead | proven |
| C8 | A row names its account in brackets only when the harness has two or more accounts | spec "chain rows" | proven |
| C9 | The segmented effort bar and the layouts look right at 1400 px and 390 px | owner go-ahead | no horizontal overflow proven; the look awaits human judgment |
| C10 | Default's chain saves and is still there after a reload | owner go-ahead | proven |
| C11 | The repository's size and naming rules hold for the files this work touches | `apps/app/AGENTS.md`, `documentation/conventions.md` | proven for size (checked), review of the rest recorded below |

## Evidence

### C1: one list and one editor
- **Check:** `drive_all.py` checks "Workshop panel lists Default, tiers and custom presets with their models" and the thread checks "Edit resumes the draft" and "Edit mode has Rename and Delete". The old Workshop editor files are deleted (`git diff --stat b5abfbc..HEAD`).
- **Shown able to fail:** the same script on a worktree of `b5abfbc` fails the first check and stops at the next step (no "Preset Default" in the old UI).
- **Result:** pass on the end state; `shots/w1_workshop_list.png`.
- **Reproduced:** by the author only for the final tip. An independent reviewer reproduced 14 of 14 checks on `6ad0ed0`.

### C2: Save and Discard
- **Check:** `presetChooser.test.ts` ("controlling a draft in the chain editor"), `presetChain.test.ts` ("showing the footer of the chain editor"), and `drive_all.py` "A draft is kept after Done", "Discard clears the draft", "Default's overwrite is saved".
- **Shown able to fail:** mutation, `canOverwrite: !isNew` changed to `canOverwrite: isNew` in `presetChain.ts`: 2 tests fail; restored afterwards.
- **Result:** pass.
- **Reproduced:** author only.

### C3: Workshop controls
- **Check:** `drive_all.py` "Workshop panel keeps the tier hint and Rename/Delete", the Default checks of C10, the "+ Add preset" text in the list check, and in a thread's edit mode: Rename to a new name, Delete asks to confirm, Cancel keeps the preset, confirming Delete removes it, and a reload agrees. A draft made before the rename follows the preset to its new name, and none is left after the delete (the independent final review found the draft staying under the old name; `keptRenamed` and `keptWithout` in `useDraftStack.ts` fix it, with 3 unit tests). `presetManagementFlow.test.ts` covers the steps of Delete. In the Workshop panel itself, `workshop_rename_delete.py` (12 checks, kit) saves a preset, drafts on it, renames it (the draft follows and the panel stays on it), asks to Delete, Cancels (preset and draft kept), confirms Delete (preset and draft gone), reloads, and repeats Rename and Delete at 390 px. This found the panel staying on the old name after Rename; `onRenamed` now selects the renamed preset (CHG-0794). Before that fix the draft check failed in the real app; with the unsaved chains held in the component they were lost on every switch of Companion, so they are held in `workshopKept`, and removing its notification fails its unit test. Screenshots: `workshop-renamed-draft-desktop.png`, `workshop-delete-confirm-desktop.png`, `workshop-draft-390.png`, `workshop-delete-confirm-390.png`. At 390 px the panel closes when its preset is renamed (its table moves under the new name); pressing the preset's chevron reopens it with the draft kept.
- **Shown able to fail:** mutation, the Delete ask step changed to stay idle: 1 test fails; restored. The tier hint check also passes at `b5abfbc`, so it proves the control was kept, not that the check can fail.
- **Result:** pass.
- **Reproduced:** author only.

### C4: six-model cap
- **Check:** `apps/app/test/editors/presetChain.test.ts`; `drive_all.py` "A chain stops at six models" and "Footer actions are on screen after scrolling a six-model chain".
- **Shown able to fail:** mutation, `maxChain = maxBackups + 1` changed to `maxBackups + 2`: 1 test fails; restored afterwards.
- **Result:** pass; `shots/w2_six_chain_footer.png`.
- **Reproduced:** author; the reviewer reproduced the cap checks on `6ad0ed0`.

### C5: draft preview and the edited marker
- **Check:** `presetChooser.test.ts` ("marking the preset in edit mode"); `drive_all.py` "The edited preset's row says editing and unsaved" and "still says editing after Discard, with no unsaved".
- **Shown able to fail:** mutation, the `editing` comparison in `presetChooser.tsx` replaced by an empty name: 2 tests fail; restored afterwards.
- **Result:** pass.
- **Reproduced:** author only.

### C6: Save as new
- **Check:** `drive_all.py` "A taken name is refused and the draft stays", "Save as new creates the preset and selects it", "The new preset is still there after a reload", "Save as new from a thread selects the new preset and clears the source draft".
- **Shown able to fail:** not shown. The independent review of `25d887f` reported the source draft left behind after Save as new, and `6ad0ed0` fixed it; the check was not rerun against `25d887f`.
- **Result:** pass; `shots/t1_thread_after_save_as.png`.
- **Reproduced:** reviewer on `6ad0ed0`; author on the end state.

### C7: pointer drag
- **Check:** `drive_all.py` "Dragging the backup's grip above the primary makes it the primary" and "Dragging the primary below the last row puts the first Companion back as primary" (real mouse drag on the grip, not the arrow buttons).
- **Shown able to fail:** the check compares the primary before and after; the drag in each direction changes it, so a no-op drag fails it. Not run as a mutation.
- **Result:** pass.
- **Reproduced:** author only.

### C8: account labels
- **Check:** `presetChain.test.ts` ("naming a Companion in a row"); `drive_all.py` "With one account the chain rows name no account", then it adds a second Claude account in Providers (an API key account with a throwaway key) and checks "With two accounts the chain rows name the account in brackets" (row text "Sonnet 5.5 (e2b)").
- **Shown able to fail:** the one-account check and the two-account check are the two sides of each other; the first would fail if brackets always appeared.
- **Result:** pass; `shots/a1_two_accounts.png`.
- **Reproduced:** author only.

### C9: look
- **Check:** `drive_all.py` "390 px picker has no horizontal overflow" and "390 px picker lists the models under each preset"; screenshots `shots/m1_390_picker.png`, `shots/w1_workshop_list.png`.
- **Shown able to fail:** not shown for the overflow check (it was not run against an earlier commit).
- **Result:** pass for overflow. The look is for the owner to judge.
- **Reproduced:** author only.

### C10: Default persists
- **Check:** `drive_all.py` "Default opens in the shared editor, without account pickers", "Default's overwrite is saved", "Default's backup is still there after a reload".
- **Shown able to fail:** the check counts "1 backup" before and after, so a save that does not persist fails it.
- **Result:** pass.
- **Reproduced:** an independent reviewer reran Default save and reload on `6ad0ed0` and it passed.

### C11: conventions
- **Check:** `wc -l` on `apps/app/src/editors/*.tsx` (largest `presetChainEditor.tsx`, 255 lines; `companionPicker.tsx`, 236) and `bun run typecheck` and Biome.
- **Shown able to fail:** `companionPicker.tsx` was 273 lines before the split and the independent standards review flagged it.
- **Result:** all files at or under 256. Review findings: size, boolean naming, test titles and footer logic are fixed; the new `presetChooser.test.ts` has no `vi.mock`: `vitest.config.ts` aliases `react-native` to `react-native-web` and `react-native-svg` to `apps/app/test/fixtures/svgStandIn.ts`. Four older test files still carry their own `vi.mock` pair, unchanged. The Save as new and Delete decisions are plain functions (`afterSaveAs`, `nextStep`) with tests.
- **Reproduced:** author only.

## Regressions

| Check | Command | Starting commit | End state |
| --- | --- | --- | --- |
| Tests | `bunx vitest run apps/app` | pass, 132 files, 1,084 passed, 6 skipped | pass, 135 files, 1,136 passed, 6 skipped |
| Typecheck | `cd apps/app && bunx tsc --noEmit` | pass | pass |
| Biome | `bunx biome check` | 4 warnings, all `noImportantStyles` in `documentation/architecture-audit/*.html` | the same 4 warnings, none in changed files |
| Real app | `drive_all.py` through `run.sh` | fails (first check) | 30 of 30 checks pass, plus 12 of 12 in `workshop_rename_delete.py` |

## Not proven

- Resizing the window between phone and desktop widths with the panel open closes the panel (the click-throughs set the width first); not changed here.
- The look of the effort bar and the layouts (C9): human judgment.
- Pointer drag was not run as a mutation (C7).
- A desktop window, a phone, and a live harness: not run.
- An independent reviewer has not reproduced the end state; they reproduced `6ad0ed0`.
- The two scripted Playwright browser checks (`drive_all.py`, `workshop_rename_delete.py`) depend on the external `repro-kit.tgz` archive, which is not in the repository and cannot currently be obtained from a fresh checkout; those checks cannot currently be independently reproduced without that archive.

## Reproduce

From a fresh checkout (unit tests, typecheck, and lint):

```sh
git checkout worktree/shared-companion-editor
bun install
bunx vitest run apps/app
(cd apps/app && bunx tsc --noEmit)
bunx biome check
```

The browser click-throughs below used an external verification archive (`repro-kit.tgz`, kept outside git; not present in a fresh checkout, so these two checks cannot currently be independently reproduced from a fresh checkout without obtaining that archive). With that archive unpacked into `kit`:

```sh
tar xzf repro-kit.tgz && cd kit
# needs Playwright for Python and Google Chrome; picks a free HTTP port, stops if it is busy
REPO=/path/to/OUTLORE EXPORT_DIR=/tmp/webout OUT=/tmp/shots bash run.sh drive_all.py
REPO=/path/to/OUTLORE EXPORT_DIR=/tmp/webout OUT=/tmp/shots bash run.sh workshop_rename_delete.py
```

## New files

`documentation/verification/2026-11-27-shared-chain-editor/*.png` (screenshots) are committed with this proof. The repro kit (`drive_all.py`, `workshop_rename_delete.py`, `run.sh`, `README.md`) is kept outside the repository in `repro-kit.tgz` and is not committed.
