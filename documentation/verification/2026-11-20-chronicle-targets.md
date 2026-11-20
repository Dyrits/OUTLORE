# Chronicle navigation and approval verification

- The Chronicle locator tests exercise opening the named message or question, resolving a request from an older peer without a question ID, and returning to the latest message for a quest-level notification.
- The Chronicle service suite passed all five tests in the prepared worktree. It verifies that an open request keeps one row after reading and that Allow, Always Allow, and Deny each remove it.
- The combined navigation and approval build passed all 49 tests in the five focused suites below.
- The navigation errand reported a passing workspace typecheck and Biome check. Its commit hook reported 1,757 passed, 54 skipped and one OpenCode plan-limit test failure after retries. The same assertion failed on unchanged `main` at `c22dbd0f` before passing on retry.
- The integrated patch on `main` passed the hook's Biome and workspace typecheck. The hook's affected suite reported 1,758 passed, 54 skipped, and two failed plan-limit timing cases, `codex.test.ts:161` and `openCodeTurns.test.ts:198`. The exact two failing variants have not been reproduced on the baseline.
- Before the target changes, the four focused pane and Chronicle suites passed 45 tests and the app's Expo web export succeeded.
- The disposable fake service started and the exported app was reachable through a local HTTP server. Electron exited before showing a window, and Chromium could not register its Mach port in either launch attempt.
- Desktop interaction remains unverified, including scrolling a reused pane to its target, the Chronicle badge and filters, Companions tab switching, and reopening a Fulfilled errand after folding it.

Run the focused tests from the repository root.

```sh
bun run test apps/app/test/conversation/chronicleTarget.test.ts apps/app/test/shell/chronicleFeed.test.ts apps/app/test/shell/paneChain.test.ts apps/app/test/shell/paneNotches.test.ts packages/service/test/work/chronicle.test.ts
```
