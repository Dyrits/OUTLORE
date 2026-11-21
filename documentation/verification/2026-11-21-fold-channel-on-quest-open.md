# Verification: the channel pane folded when a quest opens

- **Work:** CHG-0613, on `main`. Recorded results below come from this session's runs on 2026-11-21; nothing was seen in a desktop window.
- **What the change is:** a quest opened from the sidebar starts with only its own conversation pane open. The realm's channel pane is folded behind its notch on the quest pane's left edge (`apps/app/src/shell/paneChain.ts`, `openedQuestMemory`, used by `usePaneChain`'s initial pane memory; an empty chain, one whose tree is still loading, prunes no folds, so the default survives the first read). Pressing the channel's notch or Restore pane layout brings the channel back, and the owner's folds and shares hold for the rest of the quest.
- **Commands run now (on the owner's machine, outside a sandbox):**
  - `CI=1 bun run test apps/app/test/shell/paneChain.test.ts`: first red (the five new tests failed before `openedQuestMemory` existed), then green, 38 passed, 0 failed.
  - `CI=1 bun run test apps/app`: 88 files passed, 681 tests passed, 6 skipped, 0 failed.
  - `bunx biome check apps/app/src/shell/paneChain.ts apps/app/src/shell/usePaneChain.ts apps/app/test/shell/paneChain.test.ts`: clean.
  - `bun run --filter app typecheck`: exit 0.
- **Not checked:** nothing was seen in a desktop window: the folded channel's notch on the quest pane's left edge, its press revealing the channel beside the quest, and the next quest opening folded again. The full workspace suite was not run for this batch; the app suite covers the changed code.
