# Handoff: Pane status and errand controls

Supersedes: `2026-11-20-1752-pane-follow-up.md`
Workspace: Outlore, `main`.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Finish reviewing the pane status and controls in a desktop window and verify errand reopening and Stop end to end.

## State

- Verified by source and git diff: CHG-0605 covers pane icons, selection, status and lifecycle changes since `bec0fab44ad7b41eb5e00979e300c282c07a5d9d`.
- The owner reviewed iterations in the desktop app; final appearance and behavior have not been comprehensively reviewed.
- Verified during the session: 29 thread and approval tests, 15 status tests, seven notch tests and Biome passed; the new errand reopen service assertion and full suite have not been run.
- Stop returns a thread to Resting; legacy and separately held Stopped threads retain Resume, so their behavior needs review against the owner's intent.
- A workspace typecheck found invalid Fresh thread comparisons; those were corrected before the final check.

## Decisions

The owner's requested colors, scope, roll-up and controls are in CHG-0605 and the capability specifications.
An errand reopened by its checkbox returns to Resting without starting a turn.

## Next

1. Verify the errand reopen service assertion and exercise mark done, reopen, Stop and send in the running app.
2. Review the final realm and Borderlands marks, title and notch selectors, creation controls, and Companions layout in the desktop window.
3. Check other tests that assumed Stop leaves a thread Stopped, and reconcile any failures with the new behavior.
4. Revisit the previous handoff's unresolved review items if still relevant.

## Open questions

- Should existing or budget-held Stopped threads also resume upon a new message, or is explicit Resume still wanted for those cases?
- Do the selected status colors and icons remain clear in all themes and sizes?

## Sources

- `documentation/changelog/0.1.13-Prototype.md` (CHG-0605).
- `documentation/capabilities/mission-tracking/specifications.md` and `documentation/capabilities/thread-tree/specifications.md`.
- `apps/app/src/foundation/realmMark.ts`, `apps/app/src/conversation/threadTitle.tsx`, `apps/app/src/shell/paneHost.tsx` and `apps/app/src/shell/paneStrip.tsx`.
- `packages/service/src/work/lifecycle.ts`, `packages/service/src/work/missionStates.ts` and `packages/service/test/work/backups.test.ts`.
