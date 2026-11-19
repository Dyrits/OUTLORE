# Apple app permission readiness

Two review findings at `a73520b4` were addressed in CHG-0541. The host tracks each chosen app's most recent check and publishes it in the connector card. An unchecked or denied app offers no tools. A paired device can install and read the status without probing, and a restarted host requires a new check. A normal Automation refusal from the vendored server's error format is classified as Disconnected. The gateway reports the app that needs permission, removes it from turn snapshots, and keeps other checked apps available.

Run `bun run test packages/service/test/connectors`. The readiness tests exercise paired installation and restart on the same database. Over the real stdio transport, a stand-in formats the same MCP error content as the pinned vendor, then changes from permission granted to denied and back. The test checks the gateway warning and confirms the upstream text stays private. It verifies that another app still works as an offered tool and that a fresh turn can reach Calendar after a later grant.

The three focused files `appleReadiness.test.ts`, `applePermission.test.ts` and `stdioMcp.test.ts` passed 25 tests, including a generic file permission error that stays classified as Failed. Biome and typecheck passed. The full suite with `TMPDIR="$PWD/.tmp-test" CI=1 bun run test` passed 2,440 tests with 62 skipped.

The vendor code formats AppleScript errors as text in MCP error content. The classifier recognizes Automation refusal markers and the vendored Messages helper's Full Disk Access error. Live macOS prompts, localized error variants, packaged app attribution and paired screen appearance remain unverified. Access changes in System Settings are observed by the next host check or a tool invocation reporting a refusal. The service does not watch System Settings.

The [restart investigation](../research/apple-automation-restart-2026-11-19.md) traces the packaged sender and explains the limits of the prompt-free macOS API. The existing host-only recheck remains in effect.
