# Lifecycle audit verification

Starting revision: dbb3ae6, branch worktree/audit-lifecycle. Implements architecture audit candidates assigned by the parent quest. Commands run inside the worktree and sandbox; no push, installer, live harness, or window drive.

## Candidate 2, CHG-0304

- Red: `CI=1 bun run test packages/service/test/tracking.test.ts packages/service/test/work/guildmaster.test.ts`: 2 failed, 86 passed. Chronicler returned `Marked "New quest" Archived`; the empty auto-archived quest remained readable instead of returning NotFound.
- Green: `CI=1 bun run test packages/service/test/tracking.test.ts packages/service/test/work/guildmaster.test.ts packages/service/test/work/commands.test.ts packages/service/test/work/deleting.test.ts packages/service/test/work/realmLifecycle.test.ts packages/service/test/work/realmArchiveDisposition.test.ts`: 111 passed, six files.
- `bun run typecheck`: seven workspaces pass.
- `bun run check`: 674 files pass.
- `git diff --check`: passes.
- `CI=1 bun run test --maxWorkers=4`: 161 files passed, one skipped; 1,625 tests passed, 50 skipped.

The two new tests reproduce the original defect without artificial mutations. The command-runner tests also check scratch removal after commit and cancellation, and no cleanup after rollback. Existing realm archive/restore tests check the empty-quest exception.

The policy checks emptiness and the working-thread snapshot in the same transaction as record deletion. Cleanup is a follow-up, so a cleanup error cannot roll storage back. A process crash after commit can leave a scratch folder; durable cleanup recovery is not introduced here. Ordinary explicit subtree deletion keeps its existing attachment cleanup and two-stage behavior; this batch changes empty-quest ending.
