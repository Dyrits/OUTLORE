# Handoff: the stdio MCP backend and Apple apps (connectors blueprint, Order step 4, second half)

Supersedes: none (the gateway handoff `2026-11-19-1100-connector-gateway.md` on the gateway branch covers step 3; this branch merged it)
Workspace: repository `OUTLORE` (`/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`), worktree `.worktrees/connectors-composio-and-apple-apps-74a0ea1f`, branch `mission/connectors-composio-and-apple-apps-74a0ea1f` (not pushed, not merged)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoffs only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Blueprint Order step 4, second half, from the errand's opener: the stdio MCP backend (`connectors/backends/stdioMcp.ts`) over the existing line transport, Apple apps (pin `MrGo2/icloud-mcp` MIT to one version, run it in local AppleScript mode in a way a packaged Outlore can run it, real `tools/list` over stdio, classify each tool Read/Write by exact name after reading its handler, record the names with their app as a fixture, pinning test, fill the catalog), `applePermission.ts` plus the host-only `RequestApplePermission` owner request and contract, and wiring stdioMcp into the service's `connectorBackends` default.

## State

- **Done and committed (verified now):** commits `c72725f` (transport down to `core/`), `7b105de` (stdio backend + vendored server), `02d6216` (Apple catalog fill + fixture + pinning/live tests), `033e769` (permission probe + request), and the final wiring commit (default backends layer, desktop packaging, docs). Biome clean; `bun run typecheck` passes on all workspaces; `TMPDIR=<repo>/.tmp-test CI=1 bun run test` gives 2,350 passed, 20 skipped, 1 failed — the failure is `apps/desktop/test/updates/swap.test.ts` (`hdiutil attach` is Seatbelt-blocked in a sandbox; the 28 `git init` failures of CHG-0533 pass in this sandbox). 26 new tests: `test/connectors/stdioMcp.test.ts` (10, over a real stand-in MCP server process), `appleCatalog.test.ts` (6, one opt-in live), `applePermission.test.ts` (10).
- **Changelog:** CHG-0536 in `documentation/changelog/0.1.12-Prototype.md` (numbered CHG-0532 on the branch; renumbered CHG-0536 when the four connectors branches were merged). Verification note `documentation/verification/2026-11-19-stdio-apple-backend.md` separates recorded results from checks not run. Work-in-progress has a new section at the top. This handoff is **not** linked from `AGENTS.md` (same convention as the gateway handoff); whoever merges links it.
- **The pin:** `mcp-icloud@2.1.4` (MIT, `MrGo2/icloud-mcp`; newest 2.2.2 is also MIT). Vendored as one self-contained CJS file `packages/service/vendor/mcp-icloud.cjs` (built from the npm tarball with `bun build index.js --target=node --format=cjs` over its installed deps; MIT licence beside it; provenance in `vendor/README.md`), run by a system Node (`systemNodePathOf`: `/usr/bin/node`, `/usr/local/bin/node`, `/opt/homebrew/bin/node`, else `node` on PATH). Packaged app: `electron-builder.yml` ships `packages/service/vendor` as `extraResources` → `Resources/vendor`, and `main.ts` passes `OUTLORE_VENDOR_DIR` to the service fork (repo path in dev). Sandboxed tests get the file because it is committed. `USE_LOCAL_MODE=true` is forced in the child env (catalog entry's `env`) so a `.env` beside the vendored file cannot flip to cloud mode.
- **The listing:** the real server over stdio (local mode, needs no Apple access) lists 41 tools, recorded in `test/fixtures/appleServerListing.ts` (names in order, `serverInfo` `icloud-mcp 2.1.4`, revision `2025-11-25`). The catalog names all 41 with app + class; the 3 auth tools (`about`, `check-auth-status`, `set-mode`) have `app: null` and are never offered. Writes despite mild names: `mark-as-read`, `set-mode`, `complete-reminder`, `react-message`, `open-safari-url`, `close-safari-tab`. Pinning test fails on any tool the pinned version lists that the catalog does not name; opt-in live test `OUTLORE_LIVE_APPLE_SERVER=1` re-runs the vendored server and was run once: passed.
- **The backend:** `stdioMcp.ts` — child started on first use with the MCP opening exchange, idle-closed after 60 s, restarted after crash/timeout, own process group (tree kill on close), no secret, `reducedEnvironmentOf` (no `OUTLORE_*`), JSON-RPC 2.0 framing, `isError` answers → `Failed`, codes `-32601`/`-32602` → `InvalidArguments`, else `Unreachable`. Catalog `Stdio` variant is now `{ server, version, env? }` (was `command`), resolved by `vendoredServerFileOf`/`stdioCommandOf`.
- **The permission:** `applePermission.ts` probes each chosen app with its first Read tool in the catalog, one app at a time, on the gateway's own backend (`listing.backendOf`); outcome → `Allowed` / `NotAllowed` (Disconnected, or Failed with macOS refusal words matched) / `NotAskedYet`. `RequestApplePermission` contract + `ApplePermissionReport`, host-only in `requestSources.ts` (paired device refused in `admitRequestSource` before any handler), handler in `connectorHandlers.ts` via `Connectors.requestApplePermission` (refuses non-Mac and not-installed).
- **Service default:** `defaultBackendsLayer` (`connectors/backends/defaultBackends.ts`) opens a stdio child for Stdio entries; HTTP entries answer `Unreachable` until the HTTP adapter (other errand) exists. `unbuiltBackendsLayer` was removed.
- **Git works in this sandbox** (contrary to lore `d0b174b1`): `git add`/`commit` succeed here; commits went through the pre-commit hook (Biome + full suite) directly.

## Decisions

- Vendor one bundled `.cjs` file instead of `npx -y mcp-icloud@2.1.4`: the packaged app cannot run its own binary as Node (RunAsNode fuse off) and a stock Mac has no `npx`; the file is outside the asar via `extraResources`.
- Probe through the connector's own backend instance (the same child the calls run on) rather than a fresh child, so macOS is asked by the exact program it will grant.
- `NotAskedYet` covers every non-refusal failure (child did not start, timeout while the prompt waits); the mapping is unverified on a real Mac.

## Open / not checked

- The real macOS Automation prompt — Apple Events are blocked in this sandbox. The owner runs on their Mac, from the repo root: `OUTLORE_LIVE_APPLE_SERVER=1 TMPDIR="$PWD/.tmp-test" CI=1 bun run test packages/service/test/connectors/appleCatalog.test.ts` (listing), and to see the prompt itself, `/usr/bin/node packages/service/vendor/mcp-icloud.cjs` over stdio with a `tools/call` of `list-calendars`. Which program macOS names when the host runs from a login service is not known (blueprint).
- The packaged app with the vendored server (DMG + packaged-app gate run in the owner's terminal; `electron-builder.yml`/`main.ts` changed but not packaged here).
- HTTP backend + Composio (other errand), the Vault and its requests (other errand), all screens, a real Vault, a live harness, a phone, Windows/Linux hosts.
- The `.tmp-test` folder the suite leaves in the repo root: delete before committing (it is untracked; Biome reads it as source — it is excluded? no: remove it).

## Sources

- `packages/service/src/connectors/backends/stdioMcp.ts`, `defaultBackends.ts`, `applePermission.ts`, `catalogEntries.ts`, `vendor/README.md`, `packages/service/test/connectors/{stdioMcp,appleCatalog,applePermission}.test.ts`, `test/fixtures/{stand-in-mcp-server.mjs,appleServerListing.ts}`
- `packages/contracts/src/connectorRequests.ts`, `requestSources.ts`; `packages/contracts/test/hostOnlyRequests.test.ts`
- `apps/desktop/electron-builder.yml`, `apps/desktop/src/main.ts`
- `documentation/changelog/0.1.12-Prototype.md` (CHG-0536), `documentation/verification/2026-11-19-stdio-apple-backend.md`, `documentation/work-in-progress.md`
- npm: `mcp-icloud` versions 2.1.1–2.2.2, `latest` 2.2.2, licence MIT for 2.1.4 and 2.2.2 (2026-11-19); `@modelcontextprotocol/core` of the pinned server supports protocol revisions 2024-10-07 … 2025-11-25, latest 2025-11-25.
