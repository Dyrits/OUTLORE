# Handoff: Ten phone shell directions

Supersedes: none
Workspace: outlore (repository root, branch `mission/mobile-ui-redesign-options-b71b7362`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner wants the phone to look more like Claude Duet or the Slack mobile app, with a bottom bar like theirs, and asked for options before any app code changes.
Done means the owner has picked a direction (or a mix) from the page, and only then does a batch change `apps/app`.

## State

- **Built (verified: opened in headless Chrome for Testing):** `documentation/art-direction/2026-11-26-mobile-shell.html`, ten live phone frames A to J, a comparison table and a recommendation; no app code changed (CHG-0757 in `documentation/changelog/0.2.10-Pre-Alpha.md`).
- **Checks (verified: run this session):** dark and light screenshots, no script error, no element past a phone's edge, each bar, a quest, Back, the sheets and drawers, the Attention count, E's collapse and J's detents driven by script; Chrome could only run outside the sandbox.
- **Assumed:** the phones' look against the real app's theme tokens and fonts (the page borrows the reply-line page's variables); real-device thumb reach; Safari rendering of `color-mix` and `backdrop-filter`.
- **Recommended:** D first (it keeps the menu's sections as tabs, lowest cost), then B (Duet's loop, the Chronicler in the bar); see the page.
- **Pushed:** nothing; the branch is `mission/mobile-ui-redesign-options-b71b7362`, not merged.

## Decisions

- **Labels say Attention, not "needs you":** the glossary lists "Needs you" as a term to avoid for Attention.
- **The page builds its phones with a small inline script** (data in one place, ten designs as functions), rather than ten hand-written copies of the same markup.

## Next

1. Show the owner the page and ask which direction, or which mix (for example D's bar with B's Chronicler slot), to build.
2. Once chosen, write the batch against `apps/app/src/shell/shell.tsx`, `topBar.tsx` (`NarrowTopBar`), `sidebarOverlay.tsx` and `placeCatalog.ts`, and record the choice in the changelog.
3. Add the outcome to `documentation/work-in-progress.md` when a direction is accepted.

## Open questions

- Should the bar hide in a quest conversation (A, D, I, J) or stay (B, C, G, H)?
- Does the Chronicler get its own slot in the bar, or stay a button in the header?
- Where do Rituals live on the phone (inside a realm, as today, or in the places list)?

## Sources

- `documentation/art-direction/2026-11-26-mobile-shell.html`
- `documentation/changelog/0.2.10-Pre-Alpha.md` (CHG-0757)
- `documentation/research/claude-duet-2026-11-22.md`
- `apps/app/src/shell/topBar.tsx`, `placeCatalog.ts`, `shell.tsx`
