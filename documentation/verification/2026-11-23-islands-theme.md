# Islands theme verification

CHG-0668 starts at `4776ad15` on `worktree/sidebar-directions`.

Checks run on 2026-11-23 in `.worktrees/sidebar-directions`:

- `bun run test apps/app/test/foundation/islandsRules.test.ts apps/app/test/foundation/themeRules.test.ts apps/app/test/foundation/palettes.test.ts apps/desktop/test/appIcon.test.ts` — 42 passed, 6 skipped (the skips are Iskios's exempt contrast checks). The palette contrast checks run on both Islands looks through the theme list.
- `tsc --noEmit` in `apps/app` and `tsc -p .` in `apps/desktop` passed.

## Window check

A throwaway desktop instance (`OUTLORE_DATA_DIR` in a temporary folder, `OUTLORE_HARNESS=fake`, the Expo web server on port 8123) was driven over the DevTools protocol with the theme stored as Islands.

1. Light look, overlay sidebar: the top bar lies on the cool canvas and the content panel floats with a hairline, rounded corners, and a shadow.
2. Pinned sidebar: the sidebar and the content are two islands 10 points apart.
3. Workshop, Look and feel: Canvas, Gap, Radius, and Lift show under Theme; choosing Warm glow, 20, 22, and Strong redrew the canvas, gap, corners, and shadow at once with no reload.
4. Dark look: the near-black canvas, slate islands, and the indigo accent with dark button labels.
5. A new quest in the Borderlands: its panes sit inside the content island.

Not checked: the quest panel column beside a screen without panes, the sidebar pinned on the right, and the Android app.
