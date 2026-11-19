# The Streamable-HTTP MCP backend and Composio's tools (CHG-0533, 2026-11-19)

To resume the connectors quest's HTTP half. Written by the errand that built it (branch
`mission/connectors-composio-and-apple-apps-2f728664`, commits `a477c8e` and the docs commit). The branch carries the
merge of the gateway branch (CHG-0530, the fake backend, the seams) plus this errand's work. Read AGENTS.md's pointers
first: the [changelog entry](../../documentation/changelog/0.1.12-Prototype.md), the
[verification note](../../documentation/2026-11-19-http-mcp-composio.md) and the
[research note on Composio's primary sources](../../documentation/research/composio-mcp-2026-11-19.md) are the proof.

## What this errand built (blueprint Order step 4, first half)

- `packages/service/src/connectors/backends/httpMcp.ts` — a Streamable-HTTP MCP client: stateless, one JSON-RPC `POST`
  per `tools/list`/`tools/call` (no `initialize` handshake; `MCP-Protocol-Version` header sent), answers read as JSON
  or as the SSE spelling Outlore's own tool server sends; the key goes in the one header the catalog entry names and
  nowhere else; the key's spellings are redacted from a result inside the adapter, behind the gateway's redaction;
  interrupting the calling fiber aborts the real HTTP request; failures carry only the adapter's fixed words, with the
  class mapping 401/403 → **Disconnected**, 429/5xx/network → **Unreachable** (the class the gateway retries once for
  a catalog `Read`), JSON-RPC `-32602` → **InvalidArguments**, everything else → **Failed**.
- `connectorBackendsLayer` in the same file — the service's default backends (`service.ts`), replacing
  `unbuiltBackendsLayer` (deleted). An `Http` entry opens the adapter; a `Stdio` entry stays unreachable until the
  stdio errand (Apple apps) builds its half of step 4 — wire `stdioMcp` into that layer's `Stdio` case when it lands.
- The Composio catalog entry names the seven meta-tools its Connect endpoint publishes (verified against
  ComposioHQ/composio `next` at `454b04f` and Composio's docs, 2026-11-19): the two pure discovery tools
  (`COMPOSIO_SEARCH_TOOLS`, `COMPOSIO_GET_TOOL_SCHEMAS`) are `Read`; the five that execute, connect or run code are
  `Write`. A tool Composio adds later stays unnamed, so it is unclassified and asks.
- Tests: `packages/service/test/connectors/backends/httpMcp.test.ts` (9 tests): 6 of the adapter against a real local
  fake Connect server, 3 + 1 through the whole gateway over it (see the verification note: turn-start listing, the
  Vault's key in every header, read retried exactly once over real HTTP, write never retried, `SetConnectorSwitch`
  stopping a real HTTP request with the server seeing the client give up).
- `connectorWorld` (the test fixture) learned options `backends` and `entries` so a test can run the real wiring.

## Departures and decisions a merger should confirm

1. **No `initialize`**: stateless per the blueprint's "one request per call". Whether `connect.composio.dev/mcp`
   answers `tools/list` without a prior `initialize` is **not verified** (no key, nothing sent to the real service).
   Fallback if the owner's first real run refuses: one `initialize` request when the backend opens (the comment in
   `httpMcp.ts` says the same).
2. **429 and 5xx are `Unreachable`** (retryable once for a read), not `Failed`.
3. **A search's answer names which apps the owner connected** on their Composio account — the reach a tool listing
   already has, so discovery is where the `Read` classification ends; everything that acts asks.
4. **No server-side narrowing** on the shared Connect URL; read-only sessions are a Composio SDK feature the owner
   would have to adopt as a design decision (research note, "What no session-less narrowing means").
5. The Composio entry's install notice is unchanged from CHG-0530's own words (Composio's service stores the sign-ins
   and sees what tools return; the owner's own account and key; apps connect on Composio's page).

## Verified here

Biome clean; `bun run typecheck` green on all workspaces; connectors suite 144 passed; full suite 2,334 passed,
19 skipped, 1 failed — the DMG staging test (`hdiutil`, needs the owner's terminal; see the verification note for the
exact commands). Nothing was sent to the real Composio, and no real key was ever held: the changes were proved on a
real local fake of Composio's Connect endpoint.

## Open (for whoever takes the next step)

- **The real Composio server**, once the Vault errand ships and the owner puts their key in: the checklist is in the
  verification note ("What the owner must run"), and the one assumption to check is the stateless listing above.
- **Renumber at merge**: this branch numbers its entry CHG-0533 because CHG-0532 was already taken on
  `mission/connectors-composio-and-apple-apps-02a36299` (the merge/Vault-requests errand) when this was written; the
  stdio errand may pick the same number.
- **Concurrent edits expected at merge**: the specification's status paragraph, the blueprint's status line and
  `catalogEntries.ts`'s Apple entry are all being touched by the stdio (Apple apps) errand in parallel.
- **CHG-0530 leftovers that this half does not close**: the read of a realm's or quest's current choice (for the
  panels), `PutSecret`/`ReplaceSecret`/`RemoveSecret`, the Charter screens, the Steps line for a read on a live
  harness, Windows and Linux.
