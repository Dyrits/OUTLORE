# Verification: Missives, reply-line samples, the realm's Quests tab, the Chronicle's Activity layout

- **Work:** CHG-0571, uncommitted on `main` on top of `0f549858` (CHG-0570). Recorded results below come from this session's runs on 2026-11-20; nothing was run in a window.
- **Commands run now:**
  - `bun run typecheck` (all workspaces): exit 0.
  - `./node_modules/.bin/biome check` on `packages/contracts/src`, `packages/service/src/work`, `apps/app/src/conversation`, `apps/app/src/shell`: clean after `--write` on the touched files.
  - `TMPDIR=$PWD/.tmp-test CI=1 ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron node_modules/vitest/vitest.mjs run packages/service/test/work/exchangeSamples.test.ts`: 3 passed.
  - The same with `apps/app/test`: 83 files, 651 passed, 6 skipped. Three of those files first failed to load with `SchemaError: Missing key at ["lastExchange"]`, because their summary fixtures predated the field; the fixtures now carry `lastExchange: { owner: null, reply: null }`.
  - `TMPDIR=$PWD/.tmp-test CI=1 bun run test` (full suite, twice): 2,530 passed, 66 skipped, 28 failed. Every failure is `git init` inside the sandbox ("cannot copy ... hooks ... Operation not permitted") in `approvalsFolders`, `folderPicker`, `ownCopies`, `workspaceEntries`, `claudeWorktrees` and `worktrees`; none of them reads a summary this change touches.
- **Not checked:** the look of the Missives tab label, the reply-line blocks, the realm's Quests list, the Chronicle rows and separators, in a desktop window or on a phone; the samples against a live Claude Code or Codex turn (the fake harness writes the messages here); the narrow-window fold of the channel's tabs.
