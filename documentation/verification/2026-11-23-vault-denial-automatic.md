# Verification: the Vault's read-denial check runs at start with no step of the owner's (CHG-0657)

- **Work:** CHG-0657, on `mission/vault-sandbox-check-without-owner-steps-910f3d35`. ADR 0022 amendment of 2026-11-23, connectors specification and blueprint.
- **Environment:** macOS (Darwin 27.2.0), Apple silicon; codex-cli 0.171.0, Claude Code on the path, OpenCode 2.x on the path; `@anthropic-ai/sandbox-runtime` 0.0.83. Every check that applies a Seatbelt profile was run **outside** the thread's sandbox (a process inside one cannot apply a second; that is the case this change reports) and, for the nested case, **inside** it.
- **Verdict:** with the service outside any sandbox, Claude Code, Codex and OpenCode are all **Verified** at once, with no owner step. The Codex message "The marker could not be read outside the sandbox" came from Outlore's own probes sharing one marker name; it is reproduced before the change and gone after. A service that is itself sandboxed now says so in plain words instead.

## The Codex message: cause

Before the change, two Codex probes run at once on one folder (what `vaultLayer`'s `probeAll` does for every harness, with Codex and OpenCode both writing `probe-marker`), outside any sandbox:

```
[ { harness: "codex", reason: "The marker could not be read outside the sandbox, so nothing was tried.", status: "Unverified" },
  { harness: "codex", reason: "The marker could not be read outside the sandbox, so nothing was tried.", status: "Unverified" } ]
```

A single Codex probe on a folder of its own, outside any sandbox, was `Verified` before the change too: the sandbox was not the cause. Each probe overwrote the others' marker and the first to finish removed it, so the outside read of a slower probe found another's text or nothing. After the change (each marker under `probe-marker-<random>`), the same two-probe script:

```
[ { harness: "codex", reason: "A command inside its sandbox could not read the Vault's folder, and one outside could.", status: "Verified" },
  { harness: "codex", reason: "A command inside its sandbox could not read the Vault's folder, and one outside could.", status: "Verified" } ]
```

## All three adapters at once, the real commands, outside any sandbox

A folder `~/Library/Application Support/Outlore-probe-test/vault` (a space in the path, as the real Vault's), `Effect.all` with unbounded concurrency over `readClaudeVaultDenial`, `readCodexVaultDenial` and `readOpenCodeVaultDenial`, no stamp, no live turn:

```
claude   Verified  "A command inside its sandbox could not read the Vault's folder, and one outside could."
codex    Verified  "A command inside its sandbox could not read the Vault's folder, and one outside could."
opencode Verified  "A command inside its sandbox could not read the Vault's folder, and one outside could."
ms 1267    left in folder: []
```

Claude Code's was run through `@anthropic-ai/sandbox-runtime`: `SandboxManager.initialize` with the adapter's filesystem settings and no network, `wrapWithSandbox("/bin/cat '<path>'")` run by `/bin/sh -c`; the control read, the marker gave `Operation not permitted` (library prototype, outside a sandbox: control `CONTROL`, marker `cat: ...: Operation not permitted`, 334 ms in all).

## The service inside a sandbox (this thread's)

The same script inside the thread's sandbox, a writable folder:

```
claude   Unverified  "This service is itself running inside a sandbox, which stops a second one from starting, so nothing was tried. Run Outlore outside it to check."
codex    Unverified  (same reason)
opencode AsksFirst   "It runs no sandbox here, so every action asks."
```

With the real Vault folder (read-denied and not writable from the thread's sandbox) the probe cannot be set up: the reason is now "This service cannot write and read back a file in the Vault's folder, so nothing was tried (it may run inside a sandbox): EPERM...", not a blame of the folder. Both states store nothing, by ADR 0022's rule.

## Bundle

`bun build packages/service/src/main.ts --target=node --format=esm --external node-pty` (the desktop build's service step): 3.23 MB before, 4.43 MB after (about +1.2 MB, pure JavaScript, imported only when a probe runs). A bundle of `probeClaudeSandbox` alone (1.65 MB) was run by plain Node outside a sandbox against a folder with a space in its path and returned Verified. **Not checked:** the same bundle inside Electron's `utilityProcess` in a packaged app.

## Recorded results

| Claim | Where it is checked | Result |
| --- | --- | --- |
| Judgement table incl. the nested-sandbox reason, a service that cannot write the folder, four probes of one folder at once, each marker removed | `packages/service/test/vault/readDenial.test.ts` | passed |
| Claude Code's library probe Verified on a real folder, no marker left, two at once serialized (macOS, outside a sandbox; skipped inside one) | same file | passed |
| Library probe Verified alone, a matching stamp's reason preferred, a stale stamp falls back, an Unverified probe stays Unverified, NotInstalled | `test/vault/denialStamp.test.ts` | passed |
| The Vault stores with no owner request once the probe verifies; keeps refusing while it cannot; asks afresh at every read; the optional live check fail-closed | `test/work/vaultHandlers.test.ts` | passed |
| The card has no verify button; the refusal's button reads "Open the Vault" | `apps/app/test/connectors/connectorChoices.test.ts` | passed |

## Commands run

- `bun run check`: clean (1,235 files). `bun run typecheck` (background, ~4 minutes): clean on all seven workspaces.
- `npm run test packages/service/test/vault packages/contracts/test/vaultRequests.test.ts packages/service/test/work/vaultHandlers.test.ts apps/app/test/connectors`, outside the sandbox: all passed, the Seatbelt, `codex sandbox` and library tests included. Inside the sandbox those are skipped.
- Full suite: see the changelog entry for CHG-0657.

## Not checked, and what remains

- The probe proves the sandbox **library's** denial with the adapter's settings, not the installed Claude Code binary's own copy of it. The optional live turn (`VerifyClaudeVaultDenial`, no screen offers it now) or `OUTLORE_LIVE_CLAUDE_PROBE=1 ... readDenialLive` still does; neither was run (it spends the owner's Claude account).
- A service started inside a sandbox (a development instance launched from a thread) cannot verify anything and stores nothing; that is the one case left, by design. Starting the instance from the owner's terminal removes it.
- Linux (bubblewrap and `socat` are the library's requirements; a missing one reads Unverified with the library's own message) and Windows were not run.
- The library is pinned at 0.0.83; a newer Claude Code may bundle a different copy.
