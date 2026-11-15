# Handoff: mobile navigation

Supersedes: none
Workspace: ISKIOS repository, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Make the narrow-window (phone) version of the app usable: reach every place, use Chronicler, and go Back sensibly. The first slice is done; starting a quest and the other screens at phone widths remain.

## State

- Done, committed with this handoff on `main` (CHG-0292, `documentation/changelog/0.1.5-Prototype.md`): below 820 px a top bar with a menu button opens a full-screen menu of large rows (Guild Hall, Realms, Borderlands, Rituals, Craft, Library, Lore, Archive, Reserves, Charter, Workshop), in `apps/app/src/shell/mobileMenu.tsx`. Quests are not listed; Realms and Borderlands open their existing pages.
- Done: on a narrow window Chronicler fills the content area under the top bar (`chroniclerDock.tsx`); its open state on a narrow window is not persisted.
- Done: a quest's Back goes to its parent (its realm's quest list, or the Borderlands) using `archiveParentOf`; Workshop, archive and All lore no longer show a Back to the Guild Hall.
- Verified: before this handoff, `bun run check`, the typecheck and app tests passed (415 passed, 8 skipped), and a 390 x 780 window drive passed with screenshots in `documentation/verification/2026-11-15-mobile-navigation/`. Not rerun since.
- Verified: local `main` equals `origin/main` (`3825f9c`) before the commit, so no rebase was needed.
- Not checked: a real phone, safe areas (notch, home bar), light and Gild looks, Back from a quest inside a realm (only the Borderlands case was driven), touch gestures.
- Known: a nested-button warning from the sidebar `Heading` (`sidebar.tsx`) predates this work and was left alone.

## Decisions

- Full-screen menu of places rather than the sidebar tree or a drill-in level, because the tree is too dense for a phone and the owner commented in favor of full screen; no bottom tab bar (takes height, needs a safe-area decision). Recorded in CHG-0292.
- The "Ask" pill and floating Chronicler card are replaced by the menu button and a full-area Chronicler on narrow windows.
- Top-level pages carry no Back to the Guild Hall; a quest's Back goes to its parent.

## Next

1. Ask the owner whether quest lists on narrow windows should get a "new quest" button; today only Chronicler can start a quest on a phone.
2. Make the Workshop cards and other screens usable at phone widths (the backlog already notes the Workshop).
3. Drive Back from a quest inside a realm, and check safe areas and the light and Gild looks, ideally on a real phone.

## Open questions

- Should the narrow quest lists have a "new quest" button? The owner decides.
- Does the owner's real phone show anything the 390 px window drive did not?

## Sources

- `documentation/changelog/0.1.5-Prototype.md` (CHG-0292)
- `documentation/verification/2026-11-15-mobile-navigation.md` and its folder (drive scripts, screenshots)
- `documentation/work-in-progress.md`
- `apps/app/src/shell/mobileMenu.tsx`, `topBar.tsx`, `shell.tsx`, `chroniclerDock.tsx`, `appScreen.tsx`
