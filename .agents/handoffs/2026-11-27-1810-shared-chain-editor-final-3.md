# Handoff: shared companion chain editor, after the Workshop rename fix

Supersedes: `2026-11-27-1628-shared-chain-editor-final-2.md`
Workspace: Dyrits/OUTLORE, branch `worktree/shared-companion-editor`, based on `b5abfbc`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

One shared chain editor for a Companion preset in the Workshop and in a thread's Companions tab, with Save and Discard instead of autosave, every Workshop control kept, the six-model limit kept, a vertical preset list with a live unsaved preview, Save as new, and a segmented effort bar. Done means the branch is verified, independently reviewed, and pushed to a dedicated branch (never `main`) once the owner's access to the repository works.

## State

- Pushed: `76b753a` is on `worktree/shared-companion-editor`; an independent review of it found no blocking issue. This handoff adds a follow-up on top of it (CHG-0794), pushed to the same branch.
- Verified, by test run: `bunx vitest run apps/app` passes (135 files, 1,136 passed, 6 skipped); `cd apps/app && bunx tsc --noEmit` is clean; Biome reports only the 4 older `noImportantStyles` warnings in `documentation/architecture-audit/*.html`.
- Verified, by running the real app: `drive_all.py` passes 30 of 30 and `workshop_rename_delete.py` 12 of 12 (Rename, Delete, Cancel and a reload in the Workshop panel at desktop and 390 px). See the proof.
- Verified: the follow-up fixed the Workshop panel staying on the old name after Rename (the editor then read "Nothing changed yet." while the list said unsaved) and the loss of unsaved chains when another Companion was chosen.
- Verified: commits are authored as `Instinct <dyrits@mail.instinct.com>` with a final line `Instinct`, which differs from the repository's provider and model last line.
- Assumed: the follow-up has not been reviewed independently yet.
- Known limit: at 390 px the panel closes when its preset is renamed; pressing the preset's chevron reopens it with the draft kept.

## Decisions

- Chain limit stays 6 (primary plus `maxBackups` 5), so threads, rituals and paired devices keep one contract. Recorded in CHG-0790.
- Drafts are kept per preset; Save as new resets the source draft and selects the new preset. Default and tier hints live only in the Workshop. Recorded in CHG-0793 and the companion-presets specification.
- Proof lives in `documentation/verification/2026-11-27-shared-chain-editor.md`, in the proof template's form, with screenshots in its sibling folder.

## Next

1. Independent review of the follow-up (CHG-0794) on top of `76b753a`.
2. Open the pull request once the owner approves its title and words.
3. Owner judges the look of the effort bar and layouts (C9) if they want to.

## Open questions

- None blocking.

## Sources

- Proof: `documentation/verification/2026-11-27-shared-chain-editor.md`
- Changelog: `documentation/changelog/0.2.12-Pre-Alpha.md` (CHG-0790 to CHG-0793)
- Specification: `documentation/capabilities/companion-presets/specifications.md`
- Earlier handoffs: `.agents/handoffs/2026-11-27-1510-shared-chain-editor.md`, `.agents/handoffs/2026-11-27-1520-shared-chain-editor-continued.md`, `.agents/handoffs/2026-11-27-1628-shared-chain-editor-final-2.md`
