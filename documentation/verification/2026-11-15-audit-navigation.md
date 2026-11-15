# Architecture audit: navigation and shell

Worktree: `worktree/audit-app`, starting at `dbb3ae6`. Owner authorization: implement all audit candidates. No window was seen; visual acceptance remains open.

CHG-0312: `CI=1 bun run test apps/app/test/shell/location.test.ts apps/app/test/shell/navigation.test.ts apps/app/test/shell/viewing.test.ts`: 3 files, 17 tests passed. Covers expanded and narrow Chronicler quest opening, Journal/Lore/Budget closing on same-quest thread choice without remount, close clearing thread, layer exclusivity, host reset, archive parent and derived panel scope. `bun run typecheck`: seven workspaces pass.

Tests were added after extraction, so no initial red run is claimed. Mutation checks and final suite results follow below.

CHG-0313: `CI=1 bun run test apps/app/test/shell/railOutline.test.ts apps/app/test/shell/questTree.test.ts`: 2 files, 25 passed. Checks location reveal through collapsed ancestors, preservation of stored folds and an open quest past the placement limit. Rail files now range from 134 to about 310 lines.

CHG-0315: `CI=1 bun run test apps/app/test/shell/companionRegistry.test.ts apps/app/test/shell/companionScope.test.ts`: 2 files, 8 passed. Checks rank/registration ordering, page identity, Chronicler remount, offered scope, live handler routing from an old snapshot, and late publication after unmount. Tests added after extraction; no initial red claimed.

CHG-0314: `CI=1 bun run test apps/app/test/foundation/hostStatus.test.ts apps/app/test/foundation/client.test.ts`: 2 files, 10 passed. First-attempt fake-socket test was red against the original client (rejected with “Could not reach the local service”), then green with retry. Covers retrying a failed reconnection and cancelling an in-flight attempt as well as seven pure status/lifecycle cases. The hook publishes complete snapshots, including a final close whose failure text does not change.

Mutation checks (all mutations reverted before final checks): replacing the reducer's `uncovered(location)` with the unchanged location causes four location tests to fail (including both reported defects); retaining collapsed ancestors causes the selected-thread reveal test to fail; routing a drawn registry picker's effort action to its captured handler causes the live-handler test to fail. The rail test fixture was subsequently replaced with a schema-decoded real summary and its reveal mutation was rerun: one expected failure, then two tests pass after restoration.

First full run: `CI=1 bun run test --maxWorkers=4` completed with 165 files passed, 1 file skipped; 1,643 tests passed, 50 skipped (117.40 seconds). This predates two extra lifecycle tests and final snapshot-notification hardening; targeted checks for those pass. A final full run follows.

Navigation limitation: individual screens still own Back visibility, and ArchiveNavigation still carries parent navigation. The location reducer owns the state and the reset defects are covered, but the audit's proposed replacement of every screen callback with dispatch is not complete. No changes to `settings.tsx` or `runners.tsx`.

Final checks: `CI=1 bun run test --maxWorkers=4`: 165 files passed, 1 skipped; **1,645 tests passed, 50 skipped**, 95.43 seconds. Log: `/tmp/audit-app-final-tests.log` (temporary, not committed). `bun run typecheck`: seven workspaces pass. `bun run check`: 688 files checked, no fixes or errors. The final local commit hook also ran typecheck and affected tests: 4 files, 17 tests passed.

Commits: `5e782d2` (navigation), `ea73b10` (rail, host link, Companion registry). No push. Parent quest integrates and owns work-in-progress/handoff updates.
