# Architecture audit: navigation and shell

Worktree: `worktree/audit-app`, starting at `dbb3ae6`. Owner authorization: implement all audit candidates. No window was seen; visual acceptance remains open.

CHG-0312: `CI=1 bun run test apps/app/test/shell/location.test.ts apps/app/test/shell/navigation.test.ts apps/app/test/shell/viewing.test.ts`: 3 files, 17 tests passed. Covers expanded and narrow Chronicler quest opening, Journal/Lore/Budget closing on same-quest thread choice without remount, close clearing thread, layer exclusivity, host reset, archive parent and derived panel scope. `bun run typecheck`: seven workspaces pass.

Tests were added after extraction, so no initial red run is claimed. Mutation checks and final suite results follow below.
