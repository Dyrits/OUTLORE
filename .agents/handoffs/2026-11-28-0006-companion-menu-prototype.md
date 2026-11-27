# Handoff: Companion menu prototype layout

Supersedes: none
Workspace: /Users/dgerrits/Codelab/Dyrits/OUTLORE (branch `feat/companion-menu-prototype`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Rebuild the Companions tab and shared chain editor to match the prototype layout and behavior (balanced two-column cards, no "Presets" header or "Custom" entry, unified model-named fallback rows with direct editing).
Done looks like the pull request reviewed and merged, with the remaining unproven test (C4) and the owner's visual and fluidity check (C5, C6) settled.

## State

- Work commit `f230940f` ("Rebuild the Companions tab as balanced cards with one chain editor") is on branch `feat/companion-menu-prototype`, one commit ahead of `origin/main` (`1fb76dac`), with a clean working tree (verified via `git status`, `git show --stat f230940f`, and `git fetch origin`).
- `f230940f` includes the UI and test changes across `apps/app/src/editors/`, `apps/app/src/settings/`, and `apps/app/test/editors/`, removes `threadCompanionDetails.tsx` and `threadPresetEditor.tsx`, updates `documentation/capabilities/companion-presets/specifications.md`, adds `CHG-0796` to `documentation/changelog/0.2.14-Pre-Alpha.md`, updates `documentation/work-in-progress.md`, and adds the verification proof at `documentation/verification/2026-11-28-companion-menu-prototype.md` (verified by reading `git show --stat f230940f` and those documents).
- The review cleanup removed the single-valued `kind` field from `PresetEntry` before committing (recorded in `CHG-0796`; assumed, not independently re-reviewed in this turn).
- Verification verdict in `documentation/verification/2026-11-28-companion-menu-prototype.md` is **not proven**: C1, C2, C3, and C7 are marked proven by Biome (94 files), `apps/app` typecheck, and `CI=1 bunx vitest run apps/app` (136 files, 1,153 passed, 6 skipped), while C4 (pressing Overwrite or Save as new in `ThreadPresetCard` hands the saved chain to the thread) is unproven and C5/C6 (visual match and fluidity) await a human eye (verified by reading the proof; the test runs themselves were recorded by the previous turn and passed the pre-commit hook for `f230940f`).
- Integration check against `origin/main` found nothing behind; `origin/feat/companion-menu-prototype` did not exist before the push step (verified via `git fetch origin` and `git ls-remote origin feat/companion-menu-prototype`).

## Decisions

- Removed the "Presets" header, the "Custom" list entry, and the separate read/edit mode split (`threadCompanionDetails.tsx`, `threadPresetEditor.tsx`) so clicking a companion card applies it to the thread and opens its chain directly in the right-hand editor (owner request in this quest, recorded in `documentation/capabilities/companion-presets/specifications.md` and `CHG-0796`).
- Replaced "Companion" and "Backup 1, 2, 3" row titles with model names (with account and effort), a `Primary` pill on row 1, a `FALLBACK ORDER` header, and balanced `flex: 1` columns with a `16px` gap (owner request, recorded in `CHG-0796`).
- Kept the Workshop companions panel sharing the same card layout and `+ Add a companion` control rather than removing companion selection from Workshop; the owner offered removing it only if it added complexity.

## Next

1. Review the opened pull request for `feat/companion-menu-prototype` and inspect the Companions tab in the live desktop app to judge visual parity (C5) and fluidity (C6).
2. Address the owner's remark that the interaction "feels like it lack of fluidity" (transitions, drag/collapse feel, or layout shift when switching cards or unfolding rows).
3. Add a component test for `ThreadPresetCard` pressing Overwrite and Save as new to verify `presetChoice.onPreset` receives the saved chain (proves C4) and update the proof.

## Open questions

- What specifically feels lacking in fluidity (card switching, row expand/collapse animation, drag reordering, or responsiveness)? Only the owner using the live desktop app can answer.
- Should companion selection remain in Workshop now that it shares the same card layout, or be removed as the owner suggested if it adds complexity? The owner can decide during PR review.

## Sources

- Prototype reference: https://files.instinct.com/dl5uu9ezr010-five-outlore-companion-menu-layouts
- Work commit: `f230940f` on branch `feat/companion-menu-prototype`
- Specifications: `documentation/capabilities/companion-presets/specifications.md`
- Changelog: `documentation/changelog/0.2.14-Pre-Alpha.md` (`CHG-0796`)
- Verification proof: `documentation/verification/2026-11-28-companion-menu-prototype.md`
- Work in progress: `documentation/work-in-progress.md`
