# Verification: the phone menu's foot sits at the bottom of the screen

- **Work:** CHG-0508, on `main` at `5d5cb26` plus the fix in `apps/app/src/shell/shell.tsx`.
- **Environment:** macOS, Electron 45.3.1 over the Expo web server (port 8081), `OUTLORE_HARNESS=fake`, throwaway data at `/tmp/outlore-dbg-data`, driven over CDP (`--remote-debugging-port=9333`) with a raw-WebSocket script. Viewport 390 × 780 for the phone layout, 1200 × 800 for the wide one. One theme, dark.
- **Verdict:** the foot (plan-limit rings slot and the **Workshop** row) is pinned to the bottom of the full-screen menu after the fix and was at the top before it; the wide rail is unchanged.

| Claim | Before the fix | After the fix |
| --- | --- | --- |
| Phone menu (390 × 780), **Workshop** row's bottom edge | 317 px of 780 (foot right under the list) — [screenshot](2026-11-18-phone-menu-foot/phone-menu-before.png) | 772 px of 780 (8 px padding above the screen's bottom) — [screenshot](2026-11-18-phone-menu-foot/phone-menu-after.png) |
| Wide window (1200 × 800), **Workshop** row's bottom edge | 792 px of 800 | 792 px of 800 — [screenshot](2026-11-18-phone-menu-foot/wide-after.png) |

The loop: start `bunx expo start --port 8081` in `apps/app` and Electron with `--remote-debugging-port`, open the page, set the viewport with `Emulation.setDeviceMetricsOverride`, click `[aria-label="Open the menu"]`, then measure `getBoundingClientRect()` of `[aria-label="Workshop"]`. Green means the row's bottom is within 160 px of the viewport's bottom. The script asserted red before the fix and green after, and the wide layout stayed green throughout.

Cause: on a narrow window the full-screen menu wrapped the `Sidebar` in a column `View` (`narrowContent`), and the sidebar's own style has no vertical grow, so its root was only as tall as its content and the foot followed the list. The wide frame is a row, so the sidebar stretches there; the fix makes the menu wrapper a row (`menuScreen`) so the sidebar stretches the same way.

Checks: `bun run check` (911 files) clean, `bun run typecheck` clean on all seven workspaces, `bun run test apps/app` 74 files, 534 passed, 6 skipped.

Not checked: a real phone (the narrow web layout in Electron stands in for it, as in earlier batches), the plan-limit rings themselves (the fake harness reports no plan limits, so the loop measured the foot's Workshop row; the rings render in the same foot above it), light and Iskios looks, and a window resized across the 820 px breakpoint while the menu is open.
