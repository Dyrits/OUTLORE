# Phone growing bar and side menu · verification evidence

CHG-0773, 2026-11-26. Distinguish what was run (below) from what was only read.

## Run in this session

- `bun run typecheck`: all seven workspaces pass.
- `bunx biome check apps/app`: clean.
- `CI=1 bun run test apps/app`: 126 files, 1,019 tests passed, 6 skipped. New or changed: `phoneShell.test.ts` (17), `phoneSelection.test.ts` (16), `phoneChoices.test.ts` (6), `phoneScreens.test.ts` (7, static render of the bar, sheet and side menu through react-native-web), `location.test.ts` (24, updated for the removed covers).
- `CI=1 bunx expo export --platform web` in `apps/app`: bundled 1,077 modules; the output went to a temporary folder and was deleted.
- The full `bun run test` failed only in `packages/service` tests that run `git` (own copies, realm repositories, working folders, workspace entries). This sandbox sets `GIT_CONFIG_COUNT` without `GIT_CONFIG_VALUE_0`, so `git` exits with "missing config value"; none of those files is touched by this batch.

## Not run

- A real phone, an emulator, or a browser at a phone's width: no one has seen the bar grow, held a tab, or opened the sheet or the side menu on a screen. The HTML drafts (`documentation/art-direction/2026-11-26-mobile-menu-8-growing-bar.html` and `-9-chat-landing.html`) show the intended behavior; the app was not compared with them by eye.
- The composer with the keyboard open (the bar hides on a native keyboard event; the web build has none), Android gesture and three-button bars under the bar, the quest panel and New errand on a phone, a Ritual quest, and a wide desktop window.
- The animations use React Native's `Animated` with the JavaScript driver (a width cannot use the native one), so their smoothness on a phone is unmeasured.
