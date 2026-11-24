# Handoff: provider logos

Supersedes: none
Workspace: OUTLORE repository, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new file.

## Goal

Correct the inaccurate provider marks shown in the harness list. The requested fix is complete when the shared provider mark component uses accurate marks for Hermes, Muse, Pi, Cursor, and Cline, and the workspace checks pass.

## State

- Verified by file inspection: `apps/app/src/ui/providerMarks.tsx` contains updated marks for Hermes, Muse, Pi, Cursor, and Cline.
- Verified by command output: `bun run check` passes with two existing warnings in `documentation/architecture-audit/architecture-audit-2026-11-24-0731.html`.
- Verified by command output: `bun run typecheck` passes across the workspace.
- Assumed: the visually drawn marks match the providers' current branding at 24 px; no rendered screenshot comparison was performed.
- The logo change is not committed. The working checkout is `main`, two commits behind `origin/main` at the time of this handoff.

## Decisions

- The shared SVG component is the single place to update marks used throughout the app.
- Pi's logo uses its official pi.dev mark and Hermes uses the official NousResearch wing mark. Cline, Muse, and Cursor are compact shapes rather than vendored image assets.

## Next

1. Reconcile local `main` with the two commits on `origin/main`, preserving this logo change.
2. Commit the finished change to `main` and push it to `origin/main` after the owner approves the exact push.
3. Optionally inspect a rendered providers screen at its actual display size and adjust marks that do not read accurately.

## Open questions

- Whether the owner wants visual adjustments after reviewing the marks in the running app.

## Sources

- `apps/app/src/ui/providerMarks.tsx`
- Official Hermes wing asset: https://web-assets.nousresearch.com/marketing/d658d7d78f65a8885b382f75fa0f44bc26e33c45/assets/hermes-landing/teams/hermes-wing.svg
- Official Pi logo: https://pi.dev/logo-auto.svg
- Cline brand guidelines: https://www.clinecode.app/brand
- Muse download page and app icon: https://ai.meta.com/muse/download/
