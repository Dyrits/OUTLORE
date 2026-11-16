# Verification: architecture audit 2026-11-15, integration

Branch `worktree/audit-integration` (five side-quest branches merged on top of `dbb3ae6`, then `main` at `12fedf9`). Each side-quest keeps its own record: [approvals](2026-11-15-audit-approvals.md), [lifecycle](2026-11-15-audit-lifecycle.md), [host](2026-11-15-audit-host.md), [navigation](2026-11-15-audit-navigation.md), [conversation](2026-11-15-audit-conversation.md).

## Merge resolutions

- `recentStoreMigrations.ts`: both kept, `0052_question_kind` (approvals) then `0053_command_outcome_wakes` (lifecycle).
- `service.ts`: lifecycle's router taken whole; approvals' `Harness` is now part of `RequestServices` (`work/requestContext.ts`), provided once, instead of three `provideService(Harness, …)` calls.
- `hostRuntime.ts`, `hostSession.ts`: the `answer` seam carries the authenticated `deviceId` (lifecycle, candidate 11) and `isAccepting` (host, candidate 12); `deviceConnected` is gone with `RemoteState`.
- `conversation.tsx`: the shared conversation's imports, with the navigation page context (`usePageNavigation`) kept for Journal, Lore and Budget.
- Changelog `0.1.6-Prototype.md`: every entry kept, CHG-0301 to CHG-0319.
- `packages/service/node_modules/@outlore/controller` symlink added by hand (no install in a sandbox); a fresh `bun install` creates it.

## Results run on the integrated tree (inside Claude Code's sandbox)

- `bun run typecheck`: seven workspaces pass.
- `bun run check`: 727 files, no fixes.
- `CI=1 bun run test --maxWorkers=4`: 174 files passed, 1 skipped; 1,679 tests passed, 54 skipped.
- Pre-commit hooks ran on each merge commit (typecheck plus related tests).

## Not checked

- No window, phone or browser was opened: Chronicler opening a quest, Journal, Lore and Budget resetting on a side-quest switch, Retry and Steer in Chronicler, the realm creation dialog, the rail, host status and Retry on a failed first connection, the answer label from a phone.
- No live Claude Code or Codex run (choice questions, system prompt with kinds only, prompt-cache reuse).
- The relay Worker is not redeployed: the new close code 4004 (room full) needs the next deployment; older relays still read a full room as host offline.
- The command-runner and host-presence changes were not exercised against a real paired device.
