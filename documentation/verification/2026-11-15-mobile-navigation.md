# Verification: navigation on a narrow window (CHG-0292)

Environment: macOS, Electron 45.3.1 over the Expo web server (port 8104), fake harness, fresh profile and data under the ignored `.expo/mobile2/`, viewport set to 390 × 780 by Playwright. The One theme, dark, only.

Checks run: `bun run check`, `bun run typecheck`, `bun run test apps/app` (415 passed, 8 skipped), after rebasing onto `origin/main` at the 0.1.4 release (the rename to Outlore and Chronicler).

Window drive (clicks forced: an occluded window never settles Playwright's "stable" check), scripts in `2026-11-15-mobile-navigation/`:
- `drive.js`: the menu button opens the full-screen menu; Workshop opens and closes the menu and shows no Back; the cross closes the menu; Realms and Rituals open from it.
- `drive-back.js`: Chronicler fills the content area under the top bar; its restore button closes it; Borderlands opens from the menu.
- `drive-parent.js`: a quest started in the wide sidebar, opened in the narrow window, goes Back to the Borderlands list.

Not checked: a real phone, safe areas, the native build, light and Gild looks, a realm's quest's Back, touch gestures, other screens at phone widths, and starting a quest on a narrow window (no button).
