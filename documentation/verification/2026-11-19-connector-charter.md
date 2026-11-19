# Connector Charter verification · 2026-11-19

Starting point: `ed32a73`, the merged connector service. The choice read and initial helpers are in `fe740ae4`.

- `bun run test apps/app/test/connectors/connectorChoices.test.ts packages/service/test/connectors/connectorChoices.test.ts packages/contracts/test/vaultRequests.test.ts`: 13 passed after the final changes. The service cases cover the installed list, independent choices, inheritance after a quest moves, the global switch and invalid placements. The app cases cover inheritance, global override, app filtering and the Vault's refusal; the contract cases cover secret encoding.
- `bun run check` and `bun run typecheck` passed.
- `TMPDIR="$PWD/.tmp-test" CI=1 bun run test`: 2,428 passed, 62 skipped, 0 failed (304 files passed, 6 skipped). This run preceded the final explicit rereads after installation and Claude verification; those follow the existing query pattern. The earlier merge's 28 sandbox-only failures did not recur here.
- The earlier commit hook ran affected tests outside the sandbox: 1,664 passed, 14 skipped, 210 files.

Not checked: the running screen in a desktop window or phone, screen-reader interaction, real Composio, the macOS Automation prompt, the live Claude verification, or a real Keychain. The existing Outlore window was not this worktree's build. The Charter tool list shows how Always allow is granted through a question and points to Permissions, but does not list individual standing grants.

## Thread panel tools · CHG-0539

`packages/service/test/connectors/threadPanelTools.test.ts` passes three cases: a usable connector's tools and off marker, unchosen and unnamed Apple apps excluded, and an errand following its realm and a quest move. `bun run typecheck` and `bun run check` pass. `TMPDIR="$PWD/.tmp-test" CI=1 bun run test` passes 2,431 tests, with 62 skipped (305 files passed, 6 skipped). The panel uses the in-memory server listing and current choices without starting a server; a restart or failed listing clears that listing. A running turn may have a narrower snapshot until the next turn. The visual and live checks above remain open.
