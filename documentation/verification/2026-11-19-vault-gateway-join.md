# Verification: the Vault joined to the gateway, its owner requests, and the Claude Code denial stamp

- **Work:** CHG-0534, on the branch `mission/connectors-composio-and-apple-apps-02a36299` (the merge of the Vault branch and the gateway branch, commit `a061aa0`, plus this change).
- **Environment:** macOS, inside a thread's sandbox, with `TMPDIR=<repo>/.tmp-test` (no space) and `CI=1`. A real SQLite database in a temporary folder per test; the scripted fake harness; a fake key holder (`test/fixtures/vault.ts`); a stand-in `claude` for the live probe (`test/fixtures/fakeClaudeLive.ts`) that answers `--version`, reads with `/bin/cat`, and answers each `-p` turn with what its `--settings` would let the sandbox read.
- **Verdict:** the Vault serves the gateway's `VaultPort` from the same instance the owner's requests use, the five Vault requests behave as specified on fakes, the stricter protected-or-no-secrets rule holds end to end including the stamp, and a stored secret appears in no file of the service and no plain rendering. No live model turn, real Keychain, real server or screen was run.

## Recorded results

| Claim | Where it is checked | Result |
| --- | --- | --- |
| A `PutSecret` frame round-trips through `ClientFrameJson` wrapped in `Redacted`; plain `JSON.stringify` of the request never shows the value; `VaultView` has no field for a value | `packages/contracts/test/vaultRequests.test.ts` | Passed (4 tests) |
| The five Vault requests are in the request union and result table, and are shared with paired devices (none is host-only) | `packages/contracts/test/vaultRequests.test.ts`, `hostOnlyRequests.test.ts` | Passed |
| The stamp's key is the version plus a SHA-256 of the adapter's sandbox settings; a different folder or version changes it; the stamp round-trips through its file; a broken one reads as none; a matching stamp is Verified, a stale one Unverified naming what changed | `test/vault/denialStamp.test.ts` | Passed |
| `readClaudeVaultDenial`: no stamp → Unverified (live turn needed), matching stamp → Verified, version change → stale Unverified, no answer → NotInstalled | `test/vault/denialStamp.test.ts` | Passed |
| `runClaudeVaultDenialLive` on the stand-in: a clean denial is Verified and writes the stamp (and the marker is removed); the denied turn reading the marker fails closed with no stamp; the open turn not reading the marker proves nothing; no answer → NotInstalled; a garbled turn → Unverified | `test/vault/denialStamp.test.ts` | Passed (8 tests total in the file) |
| The `VaultPort` adapter over a real `makeVault` with a fake holder: `holds` true/false, `withSecret` lends a plain string, `removeAllOf` idempotent and per connector, locked Vault → `VaultUnavailable` with reason Locked, absent secret → `SecretMissing` | `test/work/vaultPort.test.ts` | Passed (4 tests) |
| `ReadVault` on a fresh service: Absent, no entries, no holder; after a put: Ready, the entry's connector, kind, date and holder, and only those four fields | `test/work/vaultHandlers.test.ts` | Passed |
| Put twice the same kind → InvalidInput; replace a missing one → NotFound; replace an existing one; remove, and remove again is not a failure; invalid connector, kind or value → InvalidInput | `test/work/vaultHandlers.test.ts` | Passed |
| A stored (then rotated) secret appears in no file under the service's directory (SQLite, the Vault's folder, all mode 0600), nor in the `ReadVault` result, nor in any plain stringification of the request | `test/work/vaultHandlers.test.ts` | Passed |
| With every harness's denial Unverified, `PutSecret` is refused AccessRefused ("Not protected from …") and the view names Claude Code among the unverified; the Vault stores nothing | `test/work/vaultHandlers.test.ts` | Passed |
| With the stamp harness: no stamp → refused; `VerifyClaudeVaultDenial` → Verified, the stamp appears in the Vault's folder, the protection read allows again without a restart, and a put then stores; a live probe that fails closed stays Unverified and the Vault keeps refusing | `test/work/vaultHandlers.test.ts` | Passed |
| `ReplaceSecret` clears a connector's Needs connecting (a server that refused its sign-in), while a second `PutSecret` of the same kind does not; the card then reads Ready with no needs | `test/work/vaultHandlers.test.ts` | Passed |
| A thread calling the five request names as tools finds no such tool, asks no question, and the Vault is unchanged | `test/work/vaultHandlers.test.ts` | Passed |
| Whole suite | `TMPDIR=<repo>/.tmp-test CI=1 bun run test` | 2,423 passed, 21 skipped, 1 failed |
| Biome, workspace typecheck | `bunx biome check packages apps`, `bun run typecheck` | Clean; passes on all workspaces |

## The one failure, and why it is not this change

`apps/desktop/test/updates/swap.test.ts > staging the app from a disk image` fails with `hdiutil: attach failed - Permission denied`. The suite's probe (`apps/desktop/test/support/environment.ts`) only tests `hdiutil create`, which the sandbox allows; `attach` (mounting) is refused by Seatbelt here. The file and its imports are untouched by CHG-0534 (the change is in `packages/contracts`, `packages/service`, `apps/app/foundation/client.ts`), so this is the sandbox-only disk-image case the workspace's notes already record, not a regression. On the owner's machine or in CI, where a disk image can be mounted, it runs.

## Not checked

- A real Claude Code live turn: the opt-in `OUTLORE_LIVE_CLAUDE_PROBE=1 TMPDIR=<a folder with no space> bun run test packages/service/test/vault/readDenialLive` (test/vault/readDenialLive.test.ts) stays for the owner's terminal; it spends a few cents of the owner's own Claude account. The service-side probe (`runClaudeVaultDenialLive`) is the same two turns and is proved here only on the stand-in.
- A real Keychain, DPAPI or Secret Service holder: tests use the in-memory fake holder; the service's default path builds the real holders but no test stores through them.
- A real Composio or Apple server, the HTTP and stdio backends (blueprint step 4), the macOS permission's request, every screen (step 5), a phone.
- That the app's new frame encoding is byte-identical to the old `JSON.stringify` for requests without a `Redacted` field: it is the same schema the service decodes with, so it round-trips; no app screen sends a Vault request yet.
- The stamp's behavior when the Vault's folder moves: the settings hash covers the folder, so a moved folder makes the stamp stale and refuses storage until the probe runs again — reasoned from the key, not run end to end.
- Windows and Linux hosts: the platform is injected in tests; the live probe refuses on `win32` with "No live probe exists for Windows yet."
