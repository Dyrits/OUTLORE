# Vendored connector servers

One self-contained file per pinned stdio MCP server the catalog names (`CatalogBackend` `Stdio`), so a packaged
Outlore runs it without a network and without `npx`: the packaged app cannot run its own binary as Node (the
RunAsNode fuse is off), and a stock Mac has no `npx`, so the file is run by a system Node.

- `mcp-icloud.cjs` — `mcp-icloud@2.1.4` (`io.github.MrGo2/icloud-mcp`, MIT, licence in `mcp-icloud.LICENSE`), the Apple
  apps server pinned by CHG-0322 and the connectors catalog. Built from the npm tarball of that exact version with
  `bun build index.js --target=node --format=cjs` over its installed dependencies, on 2026-11-19; the same build is
  re-run by `apps/desktop`'s build to place the file the packaged app ships. Its `tools/list` as run over stdio on
  2026-11-19 is recorded in `packages/service/test/fixtures/appleServerListing.ts`; the pinning test there fails when
  the pinned version lists a tool the catalog does not name, and the opt-in live test re-runs the real server.

A `.env` beside this file could flip the server to cloud mode at start, so the service starts it with
`USE_LOCAL_MODE=true` in the child's environment (the catalog entry's `env`).

## Bundled library notices

- `sandbox-runtime.LICENSE` — `@anthropic-ai/sandbox-runtime@0.0.83` (Apache-2.0), the library Claude Code's sandbox is
  built on. It is a dependency of `packages/service`, bundled into the service by `apps/desktop`'s build (not a file run
  from here), and used only by the Vault's start-up probe (`harness/claudeSandboxProbe.ts`, ADR 0022). Its licence is
  placed here so the packaged app carries it beside the others. Upgrading it means re-running the probe's tests outside a
  sandbox (`test/vault/readDenial.test.ts`).
