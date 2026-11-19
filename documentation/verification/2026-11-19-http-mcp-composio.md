# Verification: the Streamable-HTTP MCP backend and Composio's tools (CHG-0533, 2026-11-19)

What was proved, how, and what was not run. Built on the connector gateway over stored choices (CHG-0530) in the worktree
`mission/connectors-composio-and-apple-apps-2f728664`.

## Recorded results (this run, 2026-11-19)

Commands, from the worktree's root:

- `bunx biome check packages/service` — clean.
- `bun run typecheck` — passes on all workspaces.
- `TMPDIR=<repo>/.tmp-test CI=1 bun run test -- project packages/service/test/connectors` — **12 files, 144 tests passed**,
  none skipped: the connectors suite after CHG-0530's 135 plus this change's 9 new tests.
- `TMPDIR=<repo>/.tmp-test CI=1 bun run test -- project packages/service/test/connectors/backends/httpMcp.test.ts`
  (before the suite run) — **9 passed**. Recorded below test by test.
- The commit's pre-commit hook (Biome + workspace typecheck + the test files related to the staged change) ran
  **136 test files: 1,124 passed, 10 skipped, 0 failed**.
- `TMPDIR=<repo>/.tmp-test CI=1 bun run test` (full suite) — **2,334 passed, 19 skipped, 1 failed**: the DMG staging test
  `apps/desktop/test/updates/swap.test.ts > staging the app from a disk image`, which runs `hdiutil attach` and needs the
  owner's terminal; it failed identically on all three retries with `Permission denied`. The 28 `git init` failures that
  CHG-0530's full-suite record carries for a thread's shell sandbox do not occur in this run: the run stood outside a
  thread sandbox.

This run stood in the errand's own worktree, not inside a thread's shell sandbox. The AGENTS.md note about the few tests
that need what a sandbox withholds applies to CHG-0530's run; only the DMG staging test failed here.

## What the nine new tests prove (test/connectors/backends/httpMcp.test.ts)

Every test spins up a **real local HTTP server** that fakes Composio's Connect endpoint (JSON-RPC over one `POST` per
request, loopback, no request leaves the machine, no real key). Of the adapter (`httpMcpBackend`):

1. **Listing**: `listTools` answers the server's tools in **one** request, the key in the entry's `x-consumer-api-key`
   header alone, and the one request is the `tools/list` — no `initialize`, no session handshake.
2. **Calls**: a call sends the tool's name and the given arguments in the JSON-RPC `params`, and the answer's `text`
   blocks join as the tool's text. The same call answered as a **text event stream** (with a keep-alive comment, the way
   Outlore's own tool server answers) reads correctly.
3. **Redaction**: a result echoing the key — raw and base64 — returns to the caller with both spellings replaced by
   `[redacted]`.
4. **Failure classes**: 401 → `Disconnected`, JSON-RPC `-32602` → `InvalidArguments`, 500 → `Unreachable`, a 2xx body with
   no JSON-RPC message → `Failed`, and the four failures carry the adapter's fixed words, not the server's; no spelling of
   the key appears in any of them.
5. **Keyless listing**: `listTools(null)` still asks the server, with no header it does not know, and a 401 answer maps
   to `Disconnected`.
6. **Interruption**: a call to a server that holds its answer stays up; interrupting the fiber aborts the real request,
   and the server records the client giving up on it.

Through the whole gateway (`connectorBackendsLayer` wired into the service, a fake Vault holding the key, a thread on the
fake harness named Claude Code):

7. **The Vault's key, not the test's**: every request the turn drives (listing at turn start, then the call) carries the
   key in the entry's header; the call goes out once and its text reaches the thread.
8. **A read is retried once**: the server takes the first `tools/call` with a 500 and answers the second — the catalog's
   `Read` tool succeeds, and the server saw exactly two `tools/call` requests for it, both with the key.
9. **A write is never retried**: with the server failing every `tools/call` with a 500, the asked-for and allowed write
   fails once with the fixed `Unreachable` sentence, and the server saw exactly one request. And in the stopping test,
   with the server holding the answer, `SetConnectorSwitch` (global Off) stops the read underway: the thread is told the
   connector is off for it, and **the server sees the client give up on the real HTTP request** — the assumption
   CHG-0530 left open, checked over real HTTP for the Streamable transport.

The composition follows the gateway's existing retry rule (retry an `Unreachable` once for a catalog `Read`): the adapter
maps a failed transport to `Unreachable`, and no retry logic lives in the adapter.

## Not checked (plainly)

- **The real Composio server** — no key was held, and nothing was sent to `connect.composio.dev`. In particular, whether
  it serves `tools/list` and `tools/call` without a prior `initialize` is **assumed from the blueprint's "one request
  per call" and from Composio's publish-it-and-list-tools recipes**, not verified. The fallback if the first real
  connection refuses: one `initialize` request when the backend opens (noted in `httpMcp.ts`).
- **The real Vault** — the tests lend the key from the world's fake Vault through the real `VaultPort` seam; the Vault
  itself is another errand's. Until it exists, an installed Composio connector has no key to lend and stays not
  connected.
- **A live Claude Code, Codex or OpenCode** — the gateway tests' harness is the one fake harness under three names; a
  live harness's re-listing behavior is unchanged from CHG-0530's record.
- **Windows and Linux** — the tests ran on macOS; the transport code itself is platform-free.
- **The first real 401** — whether Composio answers a wrong key with 401 (mapped to `Disconnected`, Needs connecting)
  or with another code (then `Failed`) is not verified.

## What the owner must run to try Composio with their key

The Vault is not wired in yet (another errand). Once it is released and the Vault's `PutSecret` screen exists:

1. Install the Composio connector in the Charter (its notice names what its service sees and stores).
2. Put the key from Composio's **"AI Clients"** setup page (the dashboard's consumer API key) into the Vault for
   Composio, kind "API key".
3. Start a thread and ask it to list or search what the connector can reach: a listing is asked at the turn's start, so
   a wrong key shows up right away as Needs connecting (`Disconnected`) with the warning line, and unanswered listings
   warn once per turn.

If the very first listing comes back refused in a way that implies a missing handshake (not a bad key), that is the
`initialize` fallback above, and it is a one-line follow-up.
