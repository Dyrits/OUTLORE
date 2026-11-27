# Proof: Run shell commands from message code blocks

- **Verdict:** not proven (C1–C3 proven; C4 awaiting human judgment in a live desktop/browser window)
- **Work:** working tree on `b5abfbc9` (branch `feat/run-command-from-message`)
- **Agreement:** Owner request and approved batch decisions (Q1–Q3), recorded in `documentation/capabilities/conversation-terminal/specifications.md` and `documentation/work-in-progress.md`
- **Environment:** macOS, Bun, Node/Electron Vitest (`v5.1.1`), Biome, 7-workspace TypeScript
- **Date:** 2026-11-27

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | Fenced shell code blocks (`bash`, `sh`, `zsh`, `shell`, `fish`, `console`, `powershell`, `pwsh`, `cmd`, `bat`, case-insensitive with optional info strings) are recognized and trimmed; untagged, non-shell, and empty blocks are rejected. | Q1, `specifications.md` | proven |
| C2 | Completed messages, pinned thread roots, and Companion frames render `Run command` beside `Copy code` on fenced shell blocks when a runner is available, and hide it on non-shell/untagged blocks, streaming draft replies, and when `onRunCommand` is `null`. | Q1, Q3, `specifications.md` | proven |
| C3 | Terminal command submission formats single- and multi-line commands with `\r`, writes immediately when ready and running, restarts an exited shell, queues while opening or restarting, and caps automatic restart at one attempt. | Q2, `specifications.md` | proven |
| C4 | Live desktop and paired web window appearance, scroll-into-view, xterm focus, and PTY execution across closed, hidden, running, and exited shell states, plus availability gating on paired web and native phone. | Q2, Q3, `work-in-progress.md` | awaiting human judgment |

## Evidence

### C1: Fenced shell block recognition and trimming

- **Check:** `CI=1 bun run test apps/app/test/conversation/markdownRules.test.ts`
- **Shown able to fail:** Ran the same test file against starting commit `b5abfbc9` in a detached worktree (`.worktrees/verify-before`): 4/11 tests failed (`TypeError: runnableCommandOf is not a function`), exit code 1.
- **Result:** 11/11 tests passed on the end state (exit code 0).
- **Reproduced:** Fresh-context errand `2975441c-0009-4280-8224-52ea8513de27`; matched (11/11 passed, exit 0).

### C2: Run button rendering and gating across messages, roots, drafts, and Companion frames

- **Check:** `CI=1 bun run test apps/app/test/conversation/runCommandButton.test.ts`
- **Shown able to fail:** Ran the same test file against starting commit `b5abfbc9` in a detached worktree (`.worktrees/verify-before`): 3/6 tests failed (no `aria-label="Run command"` in rendered markup for `Markdown`, `AgentReply`, or `EntryView`), exit code 1.
- **Result:** 6/6 tests passed on the end state (exit code 0).
- **Reproduced:** Fresh-context errand `2975441c-0009-4280-8224-52ea8513de27`; matched (6/6 passed, exit 0).

### C3: Terminal command formatting, queueing, and single-attempt exited-shell restart

- **Check:** `CI=1 bun run test apps/app/test/terminal/terminalScope.test.ts`
- **Shown able to fail:** Ran the same test file against starting commit `b5abfbc9` in a detached worktree (`.worktrees/verify-before`): 5/12 tests failed (`terminalCommandInputOf`, `nextTerminalRunActionOf`, and `shouldAutoRestartTerminalOf` missing), exit code 1.
- **Result:** 12/12 tests passed on the end state (exit code 0).
- **Reproduced:** Fresh-context errand `2975441c-0009-4280-8224-52ea8513de27`; matched (12/12 passed, exit 0).

### C4: Live desktop, paired web, and native phone visual and interactive behavior

- **Check:** Manual check in the running desktop window (light and dark themes), paired web browser (with **Allow terminals from paired devices** toggled), and native phone app.
- **Shown able to fail:** Not automated; requires human visual and interactive judgment.
- **Result:** Not run in this headless session.
- **Reproduced:** Not applicable.

## Regressions

| Check | Command | Starting commit | End state |
| --- | --- | --- | --- |
| Biome lint & format | `bunx biome check apps/app/src/conversation/agentReply.tsx apps/app/src/conversation/conversationEntries.tsx apps/app/src/conversation/conversationFeed.tsx apps/app/src/conversation/markdown.tsx apps/app/src/conversation/markdownRules.ts apps/app/src/conversation/messageBubble.tsx apps/app/src/conversation/threadPane.tsx apps/app/src/conversation/useThreadConversation.ts apps/app/src/terminal/terminalPanel.web.tsx apps/app/src/terminal/terminalPanelTypes.ts apps/app/src/terminal/terminalScope.ts apps/app/src/terminal/useTerminal.tsx apps/app/src/ui/runButton.tsx apps/app/test/conversation/markdownRules.test.ts apps/app/test/conversation/runCommandButton.test.ts apps/app/test/terminal/terminalScope.test.ts` | not run | pass (16 files, 0 errors) |
| Workspace typecheck (7 workspaces) | `bun run typecheck` | not run | pass (exit 0) |
| App test suite | `CI=1 bun run test apps/app` | not run | pass (133 files, 1,099 passed, 6 skipped, 0 failed) |

## Not proven

- **C4 (awaiting human judgment):** Live visual polish (play icon alignment and contrast in light and dark themes, right-padding clearance on long code blocks), inverted `FlatList` scroll-into-view and xterm focus, and real PTY execution across closed/hidden/running/exited shells on desktop and paired web require a human look in the running app.

## Reproduce

```sh
CI=1 bun run test apps/app/test/conversation/markdownRules.test.ts apps/app/test/conversation/runCommandButton.test.ts apps/app/test/terminal/terminalScope.test.ts
bunx biome check apps/app/src/conversation/agentReply.tsx apps/app/src/conversation/conversationEntries.tsx apps/app/src/conversation/conversationFeed.tsx apps/app/src/conversation/markdown.tsx apps/app/src/conversation/markdownRules.ts apps/app/src/conversation/messageBubble.tsx apps/app/src/conversation/threadPane.tsx apps/app/src/conversation/useThreadConversation.ts apps/app/src/terminal/terminalPanel.web.tsx apps/app/src/terminal/terminalPanelTypes.ts apps/app/src/terminal/terminalScope.ts apps/app/src/terminal/useTerminal.tsx apps/app/src/ui/runButton.tsx apps/app/test/conversation/markdownRules.test.ts apps/app/test/conversation/runCommandButton.test.ts apps/app/test/terminal/terminalScope.test.ts
bun run typecheck
CI=1 bun run test apps/app
```

## New files

- `apps/app/test/conversation/runCommandButton.test.ts`
- `documentation/verification/2026-11-27-run-command-from-message.md`
