# Audit host verification

Base: `dbb3ae6`. Branch: `worktree/audit-host`. Authorized: architecture audit candidates 5, 12 and 17.

## CHG-0309

- `CI=1 bun run test packages/relay/test/roomCore.test.ts`: red, 2 failed and 44 passed when the tests expected 4004 but the code still sent 1013.
- `CI=1 bun run test packages/service/test/remote/devicePairing.test.ts --maxWorkers=4`: red, 1 failed and 16 passed after replacing `onText: opened.listen` with direct channel listening. The delayed listener lost the announcement on all retries. Restored buffering.
- `CI=1 bun run test packages/service/test/remote/devicePairing.test.ts packages/controller/test packages/relay/test --maxWorkers=4`: 126 passed. Real local sockets and SQLite ran in this harness sandbox. Additional cancellation check added afterward, covered by final run below.
- `bun run --cwd packages/relay bundle`: regenerated and retained `workerBundle.generated.ts`; no deploy. Shared and own relays need updating to use the distinct room-full code; an older relay still conflates it with offline.
- `bun run typecheck`: seven workspaces pass before the final cancellation check.

Browser kind is additive in both schemas: desktop/phone data remains valid. An older host that cannot parse browser pairing is explicitly reported as possibly needing an update. Desktop exact release matching follows ADR 0019. No running app visual check.
