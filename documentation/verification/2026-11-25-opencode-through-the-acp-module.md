# Proof: OpenCode through the one ACP module, and Antigravity's system prompt (CHG-0721)

- **Verdict:** partly proven: the move keeps every earlier OpenCode check green and the new behavior is pinned by tests; no live OpenCode or Antigravity turn was run
- **Work:** branch `mission/pull-main-and-choose-next-af907065`, starting at `a8416f70` (Release 0.2.6-Pre-Alpha)
- **Agreement:** audit candidate H2 in the [backlog](../backlog.md) and [the audit](../architecture-audit/architecture-audit-2026-11-24-0731.html); behavior of OpenCode as in [action-approval](../capabilities/action-approval/specifications.md) and ADR 0008
- **Environment:** macOS, Bun 1.4.4, Vitest 5.1.1 through `bun run test`; the Seatbelt checks ran outside the thread's sandbox, as the owner's standing permission allows
- **Date:** 2026-11-25

## Claims

| # | Claim | Verdict |
| --- | --- | --- |
| C1 | OpenCode behaves as before when run through `acpHarness.ts`: the tool server in its configuration, the refusal re-prompt, the lost-session fallback only when sandboxed, the folder-escape question, the unconfirmed-executor ask, usage across prompts | proven by the existing suite |
| C2 | Every ACP harness counts `cachedWriteTokens` as cache creation | proven |
| C3 | A permission request with no matching option is answered "cancelled" for every ACP harness | proven |
| C4 | Antigravity gets the starting context as `_meta.antigravity.systemPrompt.append` when the agent advertises it, with the no-tool-server note when the session has none; the first prompt is then the message alone | proven against the stand-in |
| C5 | An agent that does not advertise it, and every other provider, still gets the context in the first prompt | proven |
| C6 | A real `opencode acp` and a real `agy` run a whole turn through the module | not checked |

## Evidence

- **C1:** `bun run test packages/service/test/harness/openCode` run twice: inside the sandbox 71 passed and 23 skipped (the Seatbelt checks), and outside it 59 passed with none skipped, including "starts a new session, and says so in the thread, when a sandboxed OpenCode cannot load the earlier one", "still fails the turn when an unsandboxed OpenCode cannot load its session", "asks, as for an escape, when no executor descends from the wrapped OpenCode", the folder-link questions, and "carries on in the same turn after the owner's refusal cancels OpenCode's prompt". These assertions were not changed. The two new characterization tests in `openCodeDialect.test.ts` (cache writes and context from the usage, no `ToolCall` event of its own) also pass on the old code.
- **C2 to C5:** four new tests in `acpProtocol.test.ts` and four more for C4/C5 failed on the starting code (restored with `git checkout HEAD -- packages/service/src`, run, then re-applied) and pass on the new one: 4 failed of 32 before, 0 failed after (`acpProtocol` 30 tests and `openCodeDialect` 2).
- **Whole harness folder:** `bun run test packages/service/test/harness` outside the sandbox: 405 passed, 12 skipped, 2 failed with a 20-second timeout in `openCodeLinks.test.ts` while the typecheck ran at the same time; the same file passed alone (7 of 7) and again with `openCodeSeatbelt`, `openCodeDialect` and `acpProtocol` (49 passed).
- **Typecheck:** `bun run typecheck` in the seven workspaces passes except for one error that is not from this change: `src/remote/directPeers.ts` cannot find the package `werift`, which is not installed in the checkout this worktree was copied from. After my two fixes (an environment type, a test type) the service typecheck shows only that error. Biome passes on the changed files.
- **Not run:** the full service suite and the app suite; no turn on a real OpenCode (a probe of `opencode acp` in the sandbox timed out and was not pursued) or a real Antigravity CLI. Whether a real OpenCode offers an `ask` mode, which the module would now select, is unchecked: OpenCode 2.2.0 lists agent names as modes as far as the earlier probes recorded.
