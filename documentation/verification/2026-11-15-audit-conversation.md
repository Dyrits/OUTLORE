# Audit: conversation and realm creation

Scope: CHG-0316–0318, audit candidates 4 and 16, from `dbb3ae6`, on `worktree/audit-conversation`. Checked 2026-11-16 in the prepared worktree. No dependency install, export, window drive, push, or merge into main.

## Automated evidence

- `CI=1 bun run test packages/service/test/work/realmCreation.test.ts`: red before implementation, expected Created but received null. After implementation, that test plus `realmLifecycle.test.ts`: 2 files, 5 tests passed. The service fixture uses a temporary database and a fake harness.
- `CI=1 bun run test --maxWorkers=4`: 164 files passed, 1 skipped; 1,631 tests passed, 50 skipped, 90.09 seconds. Skips are the suite's platform/sandbox/live-provider exclusions. No failures. Electron printed its existing task_name_for_pid diagnostic while running as Node.
- Final targeted rerun: `CI=1 bun run test apps/app/test/conversation/threadConversation.test.ts apps/app/test/editors/runnerChoices.test.ts apps/app/test/conversation/entries.test.ts apps/app/test/ui/questionAnswers.test.ts packages/service/test/work/realmCreation.test.ts packages/service/test/work/realmLifecycle.test.ts`: 6 files, 36 tests passed. This followed restoring the mutations below and strengthening the settled-approval assertion.
- `bun run typecheck`: all seven workspaces passed. `bun run check`: 684 files checked, no fixes needed. `git diff --check`: passed. The commit hook repeats staged-file Biome and typecheck.

## What the checks prove

The shared conversation sender prepares the terminal before following and sending, includes comments only for quests, carries Chronicler's realm, and clears content only after acceptance. A fake request client rejects the send to prove comments and terminal content survive. Delivery and footer decisions run in Node. Runner tests cover the first model of a changed harness, retaining supported effort, falling back to default effort, and retaining removed choices.

The realm service test exercises Created, case-insensitive NameTaken, explicit duplicate acknowledgement, and ArchivedMatch taking precedence over a duplicate name without restoring the archived realm. Existing lifecycle tests cover old CreateRealm calls returning null and refusing duplicate names. All checks and the write run under the command runner's transaction; recovery/name outcomes have no change follow-ups.

## Mutations

The conversation and runner tests were written with the extraction, then checked against deliberate regressions. Removing the sender's clearComments/sent calls and forcing changedHarnessOf to choose default instead of the first listed model produced 2 failing tests, 5 passing, across 2 failing files. Both mutations were restored before the final targeted rerun. This establishes that those checks detect the regressions; it is not an initial red run for every extracted rule.

## Choices and limits

Comments stay quest-only: thread-messaging explicitly excludes Chronicler. Retry and Steer/Queue follow the general thread rules in Chronicler (my choice, to redirect). Chronicler still has no thread-selection navigation; its existing callback is unchanged. The handoff reads Chronicler's current thread and checks that runner's image support, blocking images while the runner is unknown. No window was seen, so the failure button, delivery alternative, image refusal and realm modal still need an owner's visual check.

The shared harness cache remains because useServiceQuery cannot replace its shared inflight reads, setData publishing or generation guard without changing behavior. Earlier apps omit shouldAnswerOutcome and retain null/error responses; earlier hosts ignore the field and the new app accepts null. Recovery via CreateRealm requires the new host. realmRecoveryFlow's recovery decisions and tests remain.

The settings comment naming the Charter was outside these files and is left to the navigation side-quest. No AGENTS, work-in-progress, or handoff files were edited; the parent owns integration records.
