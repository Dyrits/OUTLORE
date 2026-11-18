# Verification: Context window per model and the soft limit

- **Work:** CHG-0509, based on `185d518`, branch `mission/choose-the-next-batch-2e9256cc`.
- **Environment:** macOS, the service's test suite with the stand-in Claude Code and Codex processes and the fake harness. No live harness, no window.
- **Verdict:** Automated checks passed. Live harness reports and the look at the gauge and the line remain open.

| Claim | Observation |
| --- | --- |
| The soft limit is one constant, 272,000 | `contextSoftLimit` test; every reader imports it. |
| A small model keeps its own window, a 1,000,000 one is held to 272,000 and marked a soft limit, no report counts 200,000 | `contextWindow.test.ts` (gauge, lore gauge, starting context); Claude Code and Codex stand-in tests through the real adapters. |
| Each turn stores the window its harness reported | `contextWindow.test.ts` reads `usage.context_window`; stand-ins send `modelUsage[model].contextWindow` and `modelContextWindow`. |
| An existing store migrates | `store.test.ts`: old usage rows keep a null window and read 200,000. |
| The handover allowance and the starting-context warning read the limit | `contextWindow.test.ts`. |
| A turn that crosses the limit adds one line, once | `contextWindow.test.ts`: line at 272,000, none below, none on the next turn past it, a smaller model's own window warned without "soft limit". |
| Claude Code's compaction shows as a line | `claudeWorktrees.test.ts` with the stand-in's `compact_boundary` event. |

A first full run failed three tests: a wrong expectation in the label test (`25.0%`) and the harness pool dropping `contextWindow` when it rebuilt the turn outcome (`harnessProcesses.ts`), both fixed. Final run: `bun run check` clean, `bun run typecheck` clean, `CI=1 bun run test` 2,123 passed, 55 skipped.

Not confirmed against a live harness: Claude Code's `modelUsage[model].contextWindow` and `compact_boundary` fields (read from its 2.1.323 schema), and Codex's `tokenUsage.modelContextWindow` (Codex 0.169.0 app-server schema). To check: run one turn of each, then read `usage.context_window` in the store and the thread panel's gauge.
