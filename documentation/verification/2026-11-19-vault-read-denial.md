# Verification: the Vault's read denial and the Vault (connectors blueprint, Order steps 1 and 2)

- **Work:** CHG-0531 (the denial in the three adapters, and the probes) and CHG-0532 (the Vault), on `mission/connectors-composio-and-apple-apps-e209fd61`, commits `61f75d3` and `4647aae`.
- **Environment:** macOS 26 (Darwin 25.6.0), Apple silicon, Electron 45.3.1 as Node for the suite, Claude Code 2.1.327, codex-cli 0.170.0, `/usr/bin/sandbox-exec`. Probes that apply a Seatbelt profile, and the real Keychain tests, were run **outside** this thread's sandbox (a process cannot apply a profile inside another sandbox: `sandbox_apply: Operation not permitted`), on disposable files and one disposable Keychain item each, removed afterwards. Nothing real was stored; the Keychain holds no leftover item.
- **Verdict:** the folder denial works in OpenCode's Seatbelt profile and in a Codex permission profile, on a real run with an outside control. **The Keychain is not a second layer: it is readable from inside the sandboxes of Claude Code, Codex and OpenCode.** Claude Code's denial of the folder was not tried in a live turn.

## Probe results (documentation/verification/2026-11-19-vault-read-denial/scripts/probe.ts, and the durable tests)

| Check | Outside (control) | OpenCode's Seatbelt profile, folder hidden | Codex profile `outlore` | Claude Code (this thread's own sandbox) |
| --- | --- | --- | --- | --- |
| Read a marker file in the folder | yes | **no** (`Operation not permitted`) | **no** (`Operation not permitted`) | not tried in a live turn (see Not checked) |
| List the folder | yes | no | no | not tried |
| Read the marker with the folder not hidden (control that the probe can fail) | yes | yes (profile without the rule) | yes (`:workspace` alone) | yes (no `denyRead` is set today) |
| Write into the folder | yes | no | not tried | not tried |
| Read a Keychain item with `security find-generic-password -w` | yes | **yes** | **yes** | **yes** |
| Read it through `security -i`, the command on standard input | yes | **yes** | **yes** | **yes** |
| Add an item through `security -i`, the key on standard input | yes | no (profile blocks writing) | no | not tried |
| `denyRead` is enforced for commands | n/a | n/a | n/a | yes: `ls` of a path this sandbox lists under its read denial gives `Operation not permitted` |

- The Keychain item was added outside a sandbox through `security -i` with the key on standard input (it works), read and removed.
- **Codex keeps today's behavior under the profile.** With `codex sandbox -P outlore` (the profile extends `:workspace`, adds the `deny` entry and `network = { enabled = true }`): the working folder, `/tmp` and the temporary folder are writable; the home folder and `/var/tmp` are not; the network answers. `thread/start` accepts `permissions: "outlore"` with the profile in `config`, answers `activePermissionProfile: { id: "outlore", extends: ":workspace" }` and `sandbox.networkAccess: true`; without the `network` entry it answered `false`. `sandbox` and `permissions` cannot be combined, so the adapter sends one or the other.
- Durable tests: `packages/service/test/vault/readDenial.test.ts` runs the real OpenCode wrapper, `codex sandbox` and the Keychain where the host allows them (skipped inside a thread's sandbox), and the probe's judgement as a table with a fake runner.

## What this changes in the design (ADR 0022 amended)

- The ADR's second layer (the key in the Keychain, unreadable from a sandbox) **does not hold** on macOS: the Keychain item is named in the source, and any sandboxed command reads it. With the folder's denial unverified for a harness, ciphertext and key are both reachable from it. The rule in `vault/protection.ts` therefore treats a holder a sandbox can read (`isReadableFromSandbox`, true for all four holders as written) like the key file: a secret is stored only while the denial is verified for every installed harness. The ADR text allowed the secret store with an unverified harness; this is stricter, and awaits the owner's confirmation.
- **Claude Code's denial cannot be verified by a probe at start**: its sandbox is applied only in a live turn, and no subcommand runs a command under it (`claude sandbox status` reports the posture on Windows terms only). Its report is `Unverified`, so on a host with Claude Code installed `put` is refused until the denial is verified, which the opt-in live test does once by hand. The owner has to decide how a verified result is kept (see the report).

## Vault checks

| Claim | Check | Result |
| --- | --- | --- |
| A record opens only with its key, identifier and connector; nonces differ; a changed ciphertext or tag fails | `test/vault/records.test.ts` | passed |
| The Vault makes itself at the first secret, shows kind and date and never a value, files 0600 and folder 0700 | `test/vault/vault.test.ts` | passed |
| The holder is chosen once (first adapter that keeps the key and reads it back) and the header's holder alone is used after a restart in another adapter order | same | passed |
| Locked: nothing is written, no key is made, every write and `withSecret` refuses, and it recovers | same | passed |
| Lost: the key gone, or the records' key identifier differing; nothing is made again; the owner may remove every secret, which returns the Vault to Absent | same | passed |
| Corrupt (a record that does not authenticate, a header that does not decode or has an unknown version, a header that is a link) overwrites nothing | same | passed |
| A key move keeps the old key and every secret when the new holder refuses, reads back another key, or writing the new records or the header fails | same, with a fake holder and a failing file write | passed |
| Concurrent puts, a replace and a removal keep every record | same | passed |
| Protected, or no secrets: refused with the harness named while an installed harness is unverified and the key is readable from a sandbox; nothing is made; allowed when all are verified, ask first or not installed | same | passed |
| The macOS, Windows and Secret Service adapters put the key on standard input, never in arguments; read answers distinguish gone from unreachable | `test/vault/keyCustody.test.ts` with a recording runner | passed |
| The real macOS Keychain adapter keeps, reads and removes a disposable key | same file, outside a sandbox | passed (skipped inside one) |
| A distinctive random secret, raw, URL-encoded, base64 and hex, is in no file of the data folder, no service answer and no Vault error, through a turn, and not after removal; the search finds a planted one | `test/vault/secrecy.test.ts` (6 rounds, whole service over real SQLite) | passed |
| Claude Code's own Read, Grep and Glob of a path in the folder (absolute, through `..`, through a link) are refused whatever the level | `test/vault/promptPolicy.test.ts` | passed |
| The three adapters carry the denial; the folder is in Claude Code's restart key; Codex starts on the profile and never `danger-full-access` | `test/vault/adapterDenial.test.ts` | passed |

## Commands run

- `bun run check`: clean. `bun run typecheck`: clean on all seven workspaces.
- `CI=1 bun run test` inside this thread's sandbox (default `TMPDIR`, no space): 290 files, 2,253 tests passed, 65 skipped, 0 failed (before: 2,160 passed, 55 skipped, 28 failed; the 28 were the sandbox's `git init` failures, which do not occur with this `TMPDIR`). The 10 added skips are the Seatbelt, `codex sandbox` and Keychain tests, and the two live Claude Code probes.
- `CI=1 bun run test packages/service/test/vault` outside the sandbox: 73 passed, 2 skipped (the live Claude Code probes).

## Not checked

- **Claude Code's denial in a live turn**, and Claude Code's own Read, Grep and Glob against `denyRead` (Outlore's prompt policy covers them by path). The test is `OUTLORE_LIVE_CLAUDE_PROBE=1 bun run test packages/service/test/vault/readDenialLive` from the owner's terminal; it spends a few cents of the owner's Claude account and was not run.
- A live Codex turn under the profile (only `codex sandbox` and `thread/start` were run), and a live OpenCode turn with the hidden folder.
- Linux: bubblewrap's `--tmpfs` over the folder (arguments only), Codex's sandbox there, the Secret Service adapter (stand-in runner only). Windows: DPAPI (stand-in runner only), any probe.
- A locked Keychain (the Keychain's own answer to a locked state, and whether `security` prompts), and the Keychain item's list of trusted applications.
- That `security -i` adds an item without it appearing in a process listing while it runs; only that the command line holds no key.
- The app, the owner requests and the Charter's Vault section: not built here.
