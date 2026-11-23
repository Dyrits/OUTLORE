# Islands layout, Slate theme, and Black & white · 2026-11-23

CHG-0672 starts at `d09869c6` on `mission/explore-sidebar-designs-1496211a`.

## What changed

- Islands is the default **layout** in every theme; the Look card's Layout choice offers **Islands** and **Flat**, with Canvas, Gap, Radius, and Lift shown while the layout is Islands.
- The prototype's colors are the new theme **Slate**. A stored theme `islands` opens Slate.
- **Black & white** keeps greys for surfaces, text, borders, and the canvas, and its state colors (danger, success, warning, Waiting's violet, Resting's yellow, Attention's marker, a new blue for Underway) are colored again; they are `monoPalettes` in `apps/app/src/foundation/monoPalettes.ts`.
- The sidebar, each open conversation pane (the realm's, the quest's or Ritual's, the errand's), and a screen without panes are each an island.
- A notch on a pane's outer edge takes the island's color and has no border on its edge side, so it reads as cut into the pane (the owner, 2026-11-23); the realm icon and the other notch icons are unchanged.

## Checks run

- `bunx vitest run` in `apps/app`: 98 files, 783 passed, 6 skipped (the skips need a terminal or Seatbelt).
- `bunx vitest run test/appIcon.test.ts` in `apps/desktop`: 5 passed.
- `bunx biome check` on every changed and new file: passed.
- `bun run typecheck`: all seven workspaces exited 0 (run in the background, after the notch change).

## Window check

A throwaway desktop instance (`OUTLORE_DATA_DIR` in a temporary folder, `OUTLORE_HARNESS=fake`, Expo on port 8241, DevTools on port 9341) was driven over the DevTools protocol, with a quest, an errand, and a Ritual made through the interface.
The window was 1920 by 1050.

1. Each theme in both looks with the Islands layout: `islands-<theme>-<look>.png` for One, Iskios, Black & white (`mono`), and Slate.
2. A quest with its errand open, in four theme and look pairs: `panes-*.png`. Each pane is its own card with the gap between.
3. A folded errand pane, in seven theme and look pairs: `folded-errand-*.png`; close-ups of the left and right notches in `notch-closeup-*.png`.
4. A Ritual: `ritual-one-light.png`.
5. The flat layout: `panes-flat-one-light.png` (quest and errand) and `flat-mono-dark.png`.
6. The pinned sidebar, the sidebar with the pointer at the edge (overlay), and the unpinned sidebar: `sidebar-*-slate-light.png`.
7. Black & white with colored states: `islands-mono-dark-running.png` shows the blue Underway dot and notch dot with the "Working..." line, and `usage-mono-dark.png` shows the orange usage bar and the colored harness dot.
8. The Look card: `look-card-islands.png` (defaults), `look-card-flat.png` (Layout set to Flat hides the Islands rows), and `look-card-islands-live-wide.png` (Warm glow, gap 20, radius 22, lift Deep applied at once). `localStorage["outlore:islands"]` held `{"canvas":"warm","gap":20,"layout":"islands","lift":3,"radius":22}` after the clicks.
9. Saved values from the earlier build: with `outlore.theme` set to `islands` and `outlore:islands` holding only `{"canvas":"warm","gap":6,"radius":10,"lift":2}`, a reload opened Slate in the Islands layout with those settings, with no console error (`legacy-stored-values.png`).
10. The console held no error and no warning except Electron's own security notice, and `document.querySelectorAll("button button")` returned 0 with a quest and errand open in all four themes.

## Not checked

- A phone-width or narrow window, and the Android app: the flat fallback is covered by the layout rules' tests only, and no window was resized.
- The sidebar's plan-limit rings: the fake harness reports no limits, so they could not appear. Their colors (`success`, `warning`, `danger`) are covered by the palette test.
- A Waiting (violet) activity indicator: the fake harness has no approval prompt here; the token is covered by the palette test.
- The right-pinned sidebar edge, dragging the edge between two panes, and the Android build.
- The throwaway app used the fake harness only, so no model quota was spent.
