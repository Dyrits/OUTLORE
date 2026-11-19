# Handoff: the connector gateway on a fake backend (connectors blueprint, Order step 3)

Supersedes: none
Workspace: repository `OUTLORE` (`/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`), worktree `.worktrees/connectors-composio-and-apple-apps-5906083b`, branch `mission/connectors-composio-and-apple-apps-5906083b` (three commits on top of `7880ab0`; not pushed, not merged)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Start the connectors with Composio and Apple apps. The owner authorized the build and the [blueprint](../../documentation/capabilities/connectors/blueprint.md) was taken as agreed. This branch is Order step 3: the catalog, the stored choices, availability, the gateway, the owner's requests and contracts, on a scripted fake backend. Steps 1 (read-denial probes), 2 (the Vault, built by another errand), 4 (the real backends) and 5 (the app) are not part of it.

## State

- **Done and committed (verified now):** Biome clean; `bun run typecheck` passes on all workspaces; `TMPDIR=<repo>/.tmp-test CI=1 bun run test` gives 2,262 passed, 55 skipped, 28 failed (the same 28 that fail on a clean checkout in a thread's sandbox: `git init` cannot copy its hook samples). 135 new tests in `packages/service/test/connectors/`.
- **Changelog** CHG-0538 in `documentation/changelog/0.1.12-Prototype.md` lists what was built and five departures from the blueprint; the verification note is `documentation/verification/2026-11-19-connector-gateway.md`, with what was not checked.
- **Not linked from `AGENTS.md`:** this handoff is not in its "Latest handoffs" list, so the merge does not conflict with the Vault errand's own edit; whoever merges links it.
- **Production defaults stand in for what is not built:** `emptyVaultLayer` (holds nothing) and `unbuiltBackendsLayer` (every server unreachable). An installed connector therefore offers no tool and warns once per turn start. The service takes `connectorVault`, `connectorBackends`, `connectorCatalog`, `connectorPlatform` and `connectorGateway` as options.
- **Assumed, not run:** that a live Claude Code, Codex and OpenCode list their tools when their process starts (so `access.connectorTools` in the restart keys is enough), that Claude Code runs each name in its allow rule without a question of its own, and that a stopped call interrupts a real HTTP request.
- **The test run leaves a `.tmp-test` folder** in the repository root; delete it, Biome reads it as source.

## Decisions

- Policy revisions are replaced by narrowing each thread's turn snapshot inside a switch's transaction, then stopping the calls whose tool left the snapshot once the command commits (`ConnectorCalls`, `shouldStopConnectorCalls`). Reason: same order, less state; a tool switched off and on again stays off for the turn.
- An Apple tool whose app the catalog does not name is not offered (its app cannot be checked). Composio and Apple name no tool yet, so Composio's every call asks and Apple offers nothing until step 4 fills the exact names from the pinned server.
- A name that reads as `<connector>__<tool>` reaches the gateway even when not offered, so the thread is told the connector is off for it (`codeMode.ts`).
- The warning line is the thread line a lost session leaves (`insertThreadLine`).

## Next

1. Merge with the Vault errand's branch: adapt the real Vault to `VaultPort` (`holds`, `removeAllOf`, `withSecret`), supply it as `connectorVault`, and add `PutSecret`, `ReplaceSecret`, `RemoveSecret` (which call `Connectors.clearNeeds` after a replaced secret).
2. Step 4: the HTTP MCP backend and Composio's exact tool names; the stdio MCP backend, Apple's exact tool names with the app of each, a fixture and a test that fails when the pinned version lists a tool the entry does not name (`unnamedToolsOf` exists), `RequestApplePermission`.
3. Step 5: the Charter and the realm and quest panels. A realm's and a quest's current choice is not readable yet (only the Borderlands' is on the card): add a read for it.

## Open questions

- Does each live harness list its tools again after the restart the key forces, and does Claude Code run an allowed connector tool without a prompt? The first real run settles both.
- Whether a turn's start should wait on every usable connector's `tools/list` (it does now), or list from the cache and refresh behind.

## Sources

- `documentation/capabilities/connectors/specifications.md`, `blueprint.md`; `documentation/architecture-decision-record/0022-*.md`.
- `packages/service/src/connectors/` (`connectors.ts`, `connectorCall.ts`, `calls.ts`, `availability.ts`, `catalog*.ts`), `work/connectorHandlers.ts`, `work/approvals.ts` (`askToolUse`), `work/threads.ts` (`beginTurn`).
- `documentation/changelog/0.1.12-Prototype.md` (CHG-0538).
