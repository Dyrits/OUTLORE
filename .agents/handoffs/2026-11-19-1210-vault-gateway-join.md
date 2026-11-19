# Handoff: the Vault joined to the gateway, its owner requests, and the Claude Code denial stamp (CHG-0539)

Supersedes: `2026-11-19-1100-connector-gateway.md` (the step-3 handoff; its Next item 1 is done here)
Workspace: repository `OUTLORE` (`/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`), worktree `.worktrees/connectors-composio-and-apple-apps-02a36299`, branch `mission/connectors-composio-and-apple-apps-02a36299` (merge `a061aa0` plus this change; not pushed)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Never edit this file: a later state goes into a new handoff.

## Goal

Start the connectors with Composio and Apple apps (blueprint in `documentation/capabilities/connectors/blueprint.md`, ADR 0022). This errand was the integration: merge the Vault branch and the gateway branch (done in `a061aa0`), adapt the real Vault to the gateway's `VaultPort`, add the Vault's owner requests, and decide how Claude Code's verified read-denial is kept. Steps 4 (HTTP backend + Composio, stdio backend + Apple apps) and 5 (the app screens) are the other errands' work, running in parallel on their own branches from this one.

## State

- **Done and committed (verified now):** Biome clean; `bun run typecheck` passes on all workspaces; `TMPDIR=<repo>/.tmp-test CI=1 bun run test` gives 2,423 passed, 21 skipped, 1 failed — the failure is `apps/desktop/test/updates/swap.test.ts` (`hdiutil attach` refused by the sandbox; untouched by this change, environmental). 25 new tests (see the verification note). Changelog CHG-0539 in `documentation/changelog/0.1.12-Prototype.md`; verification note `documentation/verification/2026-11-19-vault-gateway-join.md`; blueprint, specification and work-in-progress updated; the gateway handoff is now linked from `AGENTS.md`'s latest-handoffs list (three newest kept). This handoff is deliberately not linked there.
- **The port** (`packages/service/src/work/vaultWiring.ts`): `vaultPortOf` adapts the real `Vault` to `VaultPort` — `holds` (Missing → false, other failures → `VaultUnavailable` with the Vault's state as reason), `withSecret` lending a plain string only inside the callback, `removeAllOf`. `service.ts` supplies `vaultPortLayer` over the one `vaultLayer` instance as the default `connectorVault` (was `emptyVaultLayer`); a `connectorVault` option still replaces only the port, and `Vault`/`VaultFolder` stay in the foundation for the handlers.
- **Owner requests** (`packages/contracts/src/vaultRequests.ts`, handlers in `packages/service/src/work/vaultHandlers.ts`, wired in `service.ts`): `ReadVault`, `PutSecret`, `ReplaceSecret`, `RemoveSecret`, `VerifyClaudeVaultDenial`. All shared with paired devices (`requestSources.ts`); no thread tool reaches them (tested). Secret field is `Schema.RedactedFromValue(Schema.String)`. `ReplaceSecret` calls `Connectors.clearNeeds`. `apps/app/src/foundation/client.ts` now encodes frames with `Schema.encodeSync(ClientFrameJson)` instead of `JSON.stringify`, so a `Redacted` secret round-trips (plain stringify would send `"<redacted>"` as the value).
- **The denial stamp** (`packages/service/src/harness/claudeDenialStamp.ts`): `claude-denial-stamp.json` in the Vault's folder, `{ version, settingsHash, verifiedAt }`; key = version (first token of `claude --version`) + SHA-256 of `JSON.stringify(sandboxSettingsOf([], folder))` (worktree list deliberately out of the key). `readClaudeVaultDenial` (now stamp-aware, takes the folder) answers Verified/stale-Unverified/no-stamp-Unverified/NotInstalled. `runClaudeVaultDenialLive` runs the two live turns (denied must not read the marker but read the control; open must read both) and writes the stamp on a clean denial. `HarnessAdapter.runVaultDenialLive` is the new seam (routed in `routeHarnesses`; only the Claude adapter implements it). `Vault.refreshDenials` (Ref-memoized probe report in `vaultLayer`) makes a verified probe take effect without a restart; `makeVault`'s `denials` option stays un-memoized so existing tests that swap the report still re-read it.
- **Tests:** `packages/contracts/test/vaultRequests.test.ts` (4), `packages/service/test/vault/denialStamp.test.ts` (8), `packages/service/test/work/vaultPort.test.ts` (4), `packages/service/test/work/vaultHandlers.test.ts` (9, through the whole service on fakes: a stand-in `claude` in `test/fixtures/fakeClaudeLive.ts`, a fake custody, a fake harness).

## Decisions

- The stamp lives inside the Vault's folder (denied to every sandbox; the Vault's inspection ignores unknown files), keyed to version + settings hash, so a version upgrade or a settings change makes it stale and the Vault refuses until the probe is re-run. The owner triggers the probe with the `VerifyClaudeVaultDenial` owner request (spends a fraction of a cent of their own Claude account); no screen yet.
- The stricter rule stands as recommended: a secret is stored only while every installed harness's read-denial is verified (NotInstalled and AsksFirst do not block). With Claude Code installed and no stamp, `put` is refused AccessRefused.
- `PutSecret` does not clear a server's refusal; only `ReplaceSecret` does (the owner gave a new key).
- The app's frame encoding moved to the schema codec — required for `Redacted` to round-trip; wire text for other requests is unchanged.

## Open / not checked

- A real live Claude Code turn: the opt-in `OUTLORE_LIVE_CLAUDE_PROBE=1 TMPDIR=<no-space folder> bun run test packages/service/test/vault/readDenialLive` runs on the owner's machine; the service-side probe is proved only on the stand-in. The owner should run it once, then `VerifyClaudeVaultDenial` works from the app too.
- A real Keychain/DPAPI/Secret Service holder (tests use the in-memory fake); a real Composio or Apple server; the backends (step 4, other errands); the screens (step 5); a phone.
- The one full-suite failure (`hdiutil attach` in `apps/desktop/test/updates/swap.test.ts`) is the sandbox's disk-image refusal, not this change.
- The parallel errands numbered their own entries differently; the merge of the four connectors branches renumbered every connectors entry (this one is CHG-0539).

## Sources

- `packages/service/src/work/vaultWiring.ts`, `work/vaultHandlers.ts`, `service.ts`; `packages/contracts/src/vaultRequests.ts`; `packages/service/src/harness/claudeDenialStamp.ts`, `vaultDenials.ts`, `core/execution.ts`, `vault/vault.ts`.
- Tests: `packages/contracts/test/vaultRequests.test.ts`, `packages/service/test/vault/denialStamp.test.ts`, `packages/service/test/work/vaultPort.test.ts`, `packages/service/test/work/vaultHandlers.test.ts`, `packages/service/test/fixtures/fakeClaudeLive.ts`.
- `documentation/changelog/0.1.12-Prototype.md` CHG-0539; `documentation/verification/2026-11-19-vault-gateway-join.md`; `documentation/capabilities/connectors/blueprint.md` (Implementation status), `specifications.md`, `documentation/work-in-progress.md`; `AGENTS.md` (latest handoffs).
