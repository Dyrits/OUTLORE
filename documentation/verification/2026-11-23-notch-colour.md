# Notch color beside the gap · 2026-11-23

CHG-0674 starts at `3965a610` on `mission/explore-sidebar-designs-872c1f3c`.

## Cause

In the Islands layout the notch's fill was exactly the canvas color, but the gap beside it is darker because the drop shadows of the neighbouring islands fall on it. The glow was not the cause: with a flat canvas (no glow) the gap still read darker once Lift was above zero.

## Measured before the fix

Red channel read from a screenshot at the notch and at the gap beside it, One light, flat canvas, gap 10.

| Lift | Notch | Gap |
| --- | --- | --- |
| 0 | 220 | 220 |
| 1 | 220 | 212 (216 at gap 20) |
| 3 | 220 | 201 (210 at gap 20) |

Other themes at the default Lift, from the full before table (`/private/tmp/claude-501/notch/matrix-before.log`, 4 themes, 2 looks, 3 canvases; not kept in the repository): One light notch 220,220,221 against gap 212,212,213; Iskios light 234,227,217 against 225,219,212; Slate dark 17,19,24 against 17,18,21.

## Measured after the fix

One light, flat canvas.

| Lift and gap | Notch | Gap |
| --- | --- | --- |
| 1, 10 | 214 | 212 |
| 1, 20 | 216 | 216 |
| 3, 10 | 201 | 201 |

The straddling notch in One light after the fix matches the strip across the gap (`after-straddle-one-light.png`).

## Checks

- `bunx vitest run test/foundation/islandsRules.test.ts` in `apps/app`: 38 passed.
- `bunx biome check` on `apps/app/src/foundation`, `paneStrip.tsx`, and the test: no fixes.
- Biome and all seven typechecks exited 0 on the measured state (run by the measuring errand).

## Screenshots

`2026-11-23-notch-colour/`: `before-{left,right,straddle}-{one-light,slate-dark,mono-light}.png` and `after-{left,right,straddle}-one-light.png`.

## Not checked

- The full after table over four themes, two looks, and three canvases, and the after close-ups for Slate dark and Black & white light.
- A console and nested-button check after the fix.
- A left-edge notch beside a pinned sidebar: it is shaded as if one island is beside it (two are), so it may read about three levels light in the light look.
- The straddling notch keeps its full hairline outline across the gap; the other themes were not looked at after the fix.
