# Handoff: shared companion chain editor, final state before push

Supersedes: `2026-11-27-1621-shared-chain-editor-final.md`
Workspace: Dyrits/OUTLORE, branch `worktree/shared-companion-editor`, based on `b5abfbc`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

One shared chain editor for a Companion preset in the Workshop and in a thread's Companions tab, with Save and Discard instead of autosave, every Workshop control kept, the six-model limit kept, a vertical preset list with a live unsaved preview, Save as new, and a segmented effort bar. Done means the branch is verified, independently reviewed, and pushed to a dedicated branch (never `main`) once the owner's access to the repository works.

## State

- Verified, by test run: `bunx vitest run apps/app` passes (135 files, 1,135 passed, 6 skipped); `cd apps/app && bunx tsc --noEmit` is clean; Biome reports only the 4 older `noImportantStyles` warnings in `documentation/architecture-audit/*.html`, which `b5abfbc` also has.
- Verified, by running the real app: `drive_all.py` (the repro kit, outside the repository) passes 30 of 30 checks against the Expo web build and the real service on the fake harness, including Rename, Delete (ask, Cancel, confirm) and a reload in a thread's edit mode, a draft following its preset through a rename and gone after a delete, Default save and reload, pointer drag in both directions, the edited-preset marker, Save as new, the six-model footer, 390 px overflow, and a second account's brackets. See the proof.
- Verified, by file read and `wc -l`: no file in `apps/app/src/editors` is over 256 lines (`presetChainEditor.tsx` is 255).
- Verified: commits are authored as `Instinct <dyrits@mail.instinct.com>` with a final line `Instinct`. This differs from the repository's convention of a provider and model last line; the author's setup does not give one.
- Assumed: the owner has not yet judged the look of the effort bar and layouts.
- Assumed: an independent reviewer reproduced `6ad0ed0` (14 of 14 checks and a Default save and reload); the end state was not reviewed again at the time of writing. The independent standards review of `6ad0ed0` raised STD-1 to STD-5; STD-1 to STD-5 are fixed here: the footer, Save as new and Delete decisions are plain functions with tests (`footerOf`, `afterSaveAs`, `nextStep`), and the new test file has no `vi.mock` (`vitest.config.ts` aliases the two libraries). Four older test files keep their own `vi.mock` pair, unchanged. The reviewer has not yet checked these dispositions.
- Not pushed. A push attempt earlier was refused with a 403 for the saved token; the owner must fix repository access first.

## Decisions

- Chain limit stays 6 (primary plus `maxBackups` 5), so threads, rituals and paired devices keep one contract. Recorded in CHG-0790.
- Drafts are kept per preset; Save as new resets the source draft and selects the new preset. Default and tier hints live only in the Workshop. Recorded in CHG-0793 and the companion-presets specification.
- Proof lives in `documentation/verification/2026-11-27-shared-chain-editor.md`, in the proof template's form, with screenshots in its sibling folder.

## Next

1. Owner fixes push access to Dyrits/OUTLORE, then push the branch (not `main`) after the verification holds are released.
2. Have the end state independently reviewed, and fix or record each finding.
3. Owner judges the look (C9).
4. Click Rename and Delete in the Workshop panel itself (only the thread's edit mode, which shares the component, was clicked).

## Open questions

- Is the look of the effort bar and the layouts right? The owner decides.

## Sources

- Proof: `documentation/verification/2026-11-27-shared-chain-editor.md`
- Changelog: `documentation/changelog/0.2.12-Pre-Alpha.md` (CHG-0790 to CHG-0793)
- Specification: `documentation/capabilities/companion-presets/specifications.md`
- Earlier handoffs: `.agents/handoffs/2026-11-27-1510-shared-chain-editor.md`, `.agents/handoffs/2026-11-27-1520-shared-chain-editor-continued.md`
