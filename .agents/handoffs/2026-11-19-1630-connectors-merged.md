# Handoff: the four connectors branches merged into one (CHG-0537)

Supersedes: `2026-11-19-1100-connector-gateway.md`, `2026-11-19-1205-http-mcp-composio.md`, `2026-11-19-1210-vault-gateway-join.md`, `2026-11-19-1441-stdio-apple-backend.md` (each covers one part; this file covers the merged state, and they stay in the folder)
Workspace: repository `OUTLORE` (`/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`), worktree `.worktrees/connectors-composio-and-apple-apps-cd1b5543`, branch `mission/connectors-composio-and-apple-apps-cd1b5543` (made from `main` at `8d4b767`; not pushed, not merged into `main`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoffs only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Build the connectors capability (Composio and Apple apps, `documentation/capabilities/connectors/`), authorised by the owner on 2026-11-19. Four errands built the parts on four branches; this errand merged them into one, with one backends wiring, and proved the whole through the service's real default wiring.

## State

- **Done and committed (verified now):** three merge commits, `git merge` so each branch's commits stay: `2f99671` (the Vault + gateway + join branch `mission/connectors-composio-and-apple-apps-02a36299`), `e6a287c` (the HTTP backend branch `-2f728664`), `2c42485` (the stdio backend branch `-74a0ea1f`); then one commit with the renumbering, the one backends layer, the new test and the documents. The Vault-probes branch (`-e209fd61`) and the gateway branch (`-5906083b`) came in through the first and the others.
- **One backends layer (verified now):** `connectorBackendsLayer` in `packages/service/src/connectors/backends/defaultBackends.ts` opens `httpMcpBackend` for an Http entry and `stdioMcpBackend` (a child of the host over the vendored server) for a Stdio entry; exported from `connectors/index.ts`; the service uses it unless a test hands `connectorBackends` in. The real Vault is supplied by `vaultFoundation` in `service.ts` unless `connectorVault` is given. `emptyVaultLayer` stays exported as a stand-in a test may use.
- **Other conflicts resolved:** the Vault errand's `harness/vaultDenial.ts` and `vaultDenials.ts` called `runHarnessCommand`; the stdio errand renamed it `runShortCommand` and moved it to `core/` (same signature), and both files now import it. `requestSourceRules` has both `ReplaceSecret: shared` and `RequestApplePermission: hostOnly`. The documents' status paragraphs (specification, blueprint, architecture) were written once for the merged state.
- **Changelog numbers (unique; `documentation/changelog/0.1.12-Prototype.md`):** CHG-0530 the corner marks (already on `main`), CHG-0531 probes, CHG-0532 Vault, CHG-0533 gateway, CHG-0534 Vault join, CHG-0535 HTTP backend, CHG-0536 stdio backend, CHG-0537 this merge. Every reference in the documents, verification notes, handoffs and the two code comments was renumbered; the older handoffs' "renumber at merge" notes were rewritten to say it was done.
- **The new test (verified now):** `packages/service/test/connectors/defaultWiring.test.ts`: the service with no backends and no Vault handed in, only an in-memory key holder (so the owner's Keychain is never touched); `PutSecret` of a disposable key, both connectors installed, a turn calling one tool of each; proves the thread is offered both tools, each call reached its server (a real local fake Connect endpoint over HTTP; the stand-in MCP server process over stdio, reached through a temporary `OUTLORE_VENDOR_DIR` holding a `.cjs` wrapper), the key was in the HTTP header on every request and never reached the stdio child, and no file of the service holds the secret.
- **Checks (verified now):** Biome clean; `bun run typecheck` passes on all workspaces; `TMPDIR=<repo>/.tmp-test CI=1 bun run test` gives 2,387 passed, 66 skipped, 28 failed (308 files). The 28 are the known sandbox-only `git init` failures (`fatal: cannot copy ... templates/hooks/commit-msg.sample ... Operation not permitted`; a plain `git init` fails the same way in this sandbox) in six files the merge does not touch; the `hdiutil` test passed here. Details: `documentation/verification/2026-11-19-connectors-merge.md`.

## Decisions

- Numbering order follows build order (probes, Vault, gateway, join, HTTP, stdio), after the corner-marks entry that `main` already held as CHG-0530.
- The merged stdio file layout keeps the stdio errand's `defaultBackends.ts` (renamed export) rather than keeping the HTTP errand's layer in `httpMcp.ts`; `httpMcp.ts` now holds only the adapter.
- The new test hands in an in-memory key holder, not the real Keychain or a key file: the Vault, its sealing and its folder are real, the key's holder is the only fake.
- Nothing about behaviour was changed beyond what the merge needed (the one layer, the rename).

## Open / not checked

- Pending the owner: confirm the stricter Vault rule (kept; a secret is stored only while every installed harness's denial is verified); run the live Claude probe (`OUTLORE_LIVE_CLAUDE_PROBE=1 bun run test packages/service/test/vault/readDenialLive`); try a real Composio key and the Apple permission on their Mac (command in `documentation/verification/2026-11-19-stdio-apple-backend.md`).
- Not built: the Charter screens (blueprint Order step 5), including a read of a realm's or quest's current choice; the phone's part.
- Not checked: the real Composio server (and whether it answers a stateless `tools/list` without `initialize`; the fallback is one `initialize` per open), the real macOS Automation prompt, a live Claude Code denial probe, a real Keychain, the packaged app's launch with the vendored server (DMG and the gate run in the owner's terminal), Windows and Linux hosts, a phone, a live harness listing connector tools at process start.
- After the Charter screens, merge into `main` with the owner's approval; nothing is pushed.

## Sources

- `packages/service/src/connectors/backends/defaultBackends.ts`, `httpMcp.ts`, `stdioMcp.ts`; `src/service.ts`; `src/work/vaultWiring.ts`; `packages/service/test/connectors/defaultWiring.test.ts`
- `documentation/changelog/0.1.12-Prototype.md` (CHG-0531 to CHG-0537), `documentation/verification/2026-11-19-connectors-merge.md` and the four earlier verification notes, `documentation/capabilities/connectors/{specifications,blueprint}.md`, `documentation/work-in-progress.md`
- `git log --first-parent 8d4b767..HEAD`
