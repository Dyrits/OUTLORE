# Handoff: shared companion chain editor

Supersedes: none
Workspace: Dyrits/OUTLORE, branch `worktree/shared-companion-editor`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

One shared editor for a companion preset (thread tab and Workshop), with Overwrite and Discard instead of autosave, keeping the Workshop's controls and the six-model limit.

## State

Built: `presetChain.ts`, `useDraftStack.ts`, `presetChainEditor.tsx`; `presetEditor.tsx` and `workshopCompanions.tsx` use it. Verified: typecheck, Biome and `apps/app` tests pass (command output). Observed in a browser harness only: drag, Discard, Overwrite. Not built: sidebar preview of an unsaved draft, "Save as new" in the editor, Workshop new-preset draft on the shared editor, removal of the Workshop panel. Not run: live app, phone, desktop. The six-model cap has no test that fails when it changes.

## Decisions

Limit stays six (primary plus five backups) so contracts, Rituals and paired devices stay unchanged. Commit author is Instinct, with an Instinct attribution line instead of the provider and model line.

## Next

1. Add a failing test for the six-model cap. 2. Build the sidebar draft preview. 3. Run the app on a live service, desktop and phone. 4. Decide on Workshop panel removal.

## Open questions

Whether the owner wants the sidebar preview and "Save as new" in this change. The owner answers.

## Sources

`documentation/capabilities/companion-presets/specifications.md`, `documentation/changelog/0.2.12-Pre-Alpha.md` (CHG-0790), `documentation/verification/2026-11-27-shared-chain-editor.md`.
