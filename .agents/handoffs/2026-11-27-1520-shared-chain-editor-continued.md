# Handoff: shared companion chain editor, second state

Supersedes: `2026-11-27-1510-shared-chain-editor.md`
Workspace: Dyrits/OUTLORE, branch `worktree/shared-companion-editor`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

One shared editor for a companion preset everywhere, with Overwrite, Discard and Save as new, the Workshop's unique controls kept, six models at most. Done when the Workshop's duplicate editing is gone and the result was checked in the running app.

## State

Built and verified by tests (typecheck, Biome, `apps/app` 135 files, 1,106 passed): chain editor with draft, Overwrite, Discard, Save as new; draft shown as unsaved in the Companions tab list and the Workshop custom list; models listed under each preset in the left list; new-preset editing on the same editor (`settings/draftPreset.tsx`); segmented `EffortBar` in `companionBody.tsx`; the six-model limit pinned by a test that fails at seven. Seen in real Chrome (react-native-web harness with a fake store, real `CompanionPanel`) at 800 and 390 px. Not verified: the live app, desktop window, phone, native drag. Not done: removal of the Workshop panel; rename, delete and tier hints still live only there; on a phone width a long row title clips its "Order N" badge.

## Decisions

The limit stays six. Commit author is Instinct with an Instinct attribution line. Nothing is pushed: the push waits for the owner's go-ahead on verification and a token with write access.

## Next

1. Decide where Default, tier hints, rename and delete live, then remove the Workshop panel. 2. Fix the clipped badge. 3. Run the app on a live service at desktop and phone width. 4. Independent review and a fresh-context rerun of the proof. 5. Push the branch.

## Open questions

Whether the Workshop Companions panel is removed or reduced to Default only. The owner answers.

## Sources

`documentation/capabilities/companion-presets/specifications.md`, `documentation/changelog/0.2.12-Pre-Alpha.md` (CHG-0790, CHG-0791), `documentation/verification/2026-11-27-shared-chain-editor.md`.
