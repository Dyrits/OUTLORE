# Verification: pane notch titles on hover and focus

- **Work:** CHG-0630, on `main`. Recorded results below come from this session's runs on 2026-11-22; nothing was seen in a desktop window.
- **What the change is:** each notch (`apps/app/src/shell/paneStrip.tsx`, `PaneNotches`) shows its `NotchPart` title in a small card beside the notch while the pointer hovers over it or keyboard focus rests on it (`onHoverIn`/`onHoverOut`/`onFocus`/`onBlur`, the same reveal as the plan-limit rings), extending inward from the pane edge so it covers nothing outside the pane. The icon, the state dot, the notch size, and the one-press open are unchanged; a notch whose title is empty shows no card. The native `title` attribute could not be used: react-native-web 0.21.4 drops the `title` prop (it is not in its forwarded props), so a `title` spread is a silent no-op — see the finding below.
- **Commands run now (in this thread's sandbox):**
  - `bunx biome check apps/app/src/shell/paneStrip.tsx`: clean.
  - `bun run typecheck` (all workspaces): exit 0.
  - `CI=1` app suite (`vitest run` in `apps/app`): 92 files, 704 passed, 6 skipped, 0 failed. The checkout also held another session's uncommitted work (`threadTree.tsx`, `companionPicker.tsx`, two new test files) during the run, so the counts include it.
- **Not checked:** nothing was seen in a desktop window: the card's look and placement on left and right edges, a stack of several notches, long titles, tabbing with the keyboard, and the light and Gild looks (the card uses `surface`/`edge`, which each look remaps). The full workspace suite was not run; the app suite covers the changed code.
- **Found beside the work:** `tooltipOf` (`apps/app/src/ui/pointer.ts`) spreads a `title` prop that react-native-web 0.21.4 never forwards to the DOM, so the tooltips it claims on the usage chart's bars, the usage headline, and shortened counts (`usageChart.tsx`, `usageSummary.tsx`, `count.tsx`) never show. Recorded in the backlog.
