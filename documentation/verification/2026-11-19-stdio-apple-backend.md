# Verification: the stdio MCP backend and Apple apps (CHG-0532)

- **Work:** CHG-0532, on the branch `mission/connectors-composio-and-apple-apps-74a0ea1f` (on top of the merged gateway branch `mission/connectors-composio-and-apple-apps-5906083b`, `ad82c7e`).
- **Environment:** macOS, inside a thread's sandbox, with `TMPDIR=<repo>/.tmp-test` (no space) and `CI=1`. The real vendored server `packages/service/vendor/mcp-icloud.cjs` run by a system Node; a real stand-in MCP server process (`test/fixtures/stand-in-mcp-server.mjs`); the scripted fake backend for the gateway-level tests.
- **Verdict:** The stdio backend passes against a real stand-in server process and against the real vendored `mcp-icloud` (its listing, which needs no Apple access); the Apple catalog matches that listing exactly; the permission request passes on a fake backend. Apple Events are blocked in this sandbox, so the real macOS prompt is **not** verified here — the owner runs it on their Mac with the command at the end.

## Recorded results

| Claim | Where it is checked | Result |
| --- | --- | --- |
| The line transport moved to `core/` works as before: all harness tests over `startRpcProcess` / `startStreamJsonProcess` | `test/harness/`, `test/core/processTree.test.ts` | Passed (390 passed in those folders) |
| The stdio backend lists a server's tools after the MCP opening exchange (`initialize` at protocol revision `2025-11-25`, then `notifications/initialized`) | `test/connectors/stdioMcp.test.ts` over the stand-in | Passed |
| A call returns the tool's text and passes the arguments; the secret given to `call` is not passed on | same | Passed |
| The child gets a reduced environment: no `OUTLORE_*` variable reaches it | same, via an `echoEnv` tool with `OUTLORE_TOKEN` set | Passed |
| A tool error answer (`isError`) maps to `Failed`; JSON-RPC `-32602` and `-32601` map to `InvalidArguments`; a missing binary and a dead child map to `Unreachable` | same | Passed |
| A child that dies mid-call is restarted and the next call succeeds; an idle child (120 ms) is closed and the next call starts a new one; `close` ends the child; a slow call times out, ends the child, and the next call runs on a fresh one | same, by pid file | Passed |
| The real vendored server `mcp-icloud@2.1.4` runs under a system Node through the same backend and lists 41 tools | smoke run 2026-11-19 (`node <vendor>/mcp-icloud.cjs` over stdio via `stdioMcpBackend`), and the opt-in live test | Passed: 41 tools, `serverInfo` `icloud-mcp 2.1.4`, negotiated revision `2025-11-25`, local mode |
| The opt-in live test re-runs the vendored server and compares its listing and version with the record | `OUTLORE_LIVE_APPLE_SERVER=1 bun run test packages/service/test/connectors/appleCatalog.test.ts` | Passed (6 tests, 1 live) |
| The catalog names every tool the pinned version lists, and only those; each tool has an app of the entry or none, and a Read/Write class; the mild-named writes are Write | `test/connectors/appleCatalog.test.ts`, `catalog.test.ts` | Passed (41 tools; auth tools `about`, `check-auth-status`, `set-mode` have no app and are never offered) |
| The permission probe asks one harmless read tool per chosen app, one app at a time, on the connector's backend, and reports Allowed / NotAllowed / NotAskedYet from the outcome | `test/connectors/applePermission.test.ts` over the fake backend | Passed |
| `RequestApplePermission` answers the report through the service, asks the default apps when none were chosen, refuses a paired device before any handler (`AccessRefused`), and refuses a connector that is not installed (`InvalidInput`) | same, on a real service over a fake backend | Passed |
| `RequestApplePermission` is in `hostOnlyRequestTags`, so the frames layer refuses it to a paired device without asking the service | `packages/contracts/test/hostOnlyRequests.test.ts`, `test/remote/frames.test.ts` | Passed |
| The service's default `connectorBackends` opens a stdio child for Stdio entries; HTTP entries stay unreachable | `backends/defaultBackends.ts`, `service.ts` | Typechecked; exercised in dev wiring, not against a live HTTP server (the other half of step 4) |
| Whole suite | `TMPDIR=<repo>/.tmp-test CI=1 bun run test` | 2,350 passed, 20 skipped, 1 failed: `apps/desktop/test/updates/swap.test.ts` needs `hdiutil attach`, Seatbelt-blocked in a sandbox (the 28 `git init` failures of CHG-0530 pass in this sandbox) |
| Biome, workspace typecheck | `bunx biome check`, `bun run typecheck` | Clean, passes on all workspaces |

## Choices recorded

- **Pin:** `mcp-icloud@2.1.4` (MIT, `MrGo2/icloud-mcp`), still the choice of CHG-0322; the newest release, 2.2.2, is also MIT, and 2.1.5 exists between them. 2.1.4 is kept because it is the version the research recorded (OpenBot pins it too) and its 41-tool listing is now recorded as a fixture; the pinning test makes any bump deliberate.
- **Bundling:** the pinned package is vendored as one self-contained CJS file, `packages/service/vendor/mcp-icloud.cjs` (built with `bun build index.js --target=node --format=cjs` over the npm tarball's installed dependencies, licence kept beside it), run by a system Node (`/usr/bin/node`, else `/usr/local/bin/node`, `/opt/homebrew/bin/node`, else `node` on the PATH). A packaged Outlore cannot run its own binary as Node (RunAsNode fuse off) and a stock Mac has no `npx`, so `npx -y mcp-icloud@2.1.4` would not run there. The desktop app ships `packages/service/vendor` as an `extraResources` entry and passes it to the service as `OUTLORE_VENDOR_DIR`; in dev and tests the service resolves the repo's copy. Sandboxed tests get the file because it is committed and the worktree setup copies tracked files.
- **Local mode:** the child's environment forces `USE_LOCAL_MODE=true` (the catalog entry's `env`), so a `.env` beside the vendored file cannot flip the server to cloud mode.
- **Permission mapping:** a probe call that answers is `Allowed`; a `Disconnected` failure, or a `Failed` failure whose upstream matches macOS's refusal words (`not authorized`, `errAE`, `-1743`, `permission`, `denied`), is `NotAllowed`; anything else (child did not start, timeout while the prompt waits) is `NotAskedYet`. The words are matched only to sort the outcome and never leave the service.

## Not checked

- **The real macOS Automation prompt.** Apple Events are blocked in a thread's sandbox, so no probe ever reached a real app. The owner runs, on their Mac, from the repo root:

  ```sh
  OUTLORE_LIVE_APPLE_SERVER=1 TMPDIR="$PWD/.tmp-test" CI=1 bun run test packages/service/test/connectors/appleCatalog.test.ts
  ```

  for the listing, and to see the real prompt, asks through the packaged app's own child (or, directly):

  ```sh
  /usr/bin/node packages/service/vendor/mcp-icloud.cjs   # then send initialize + tools/call list-calendars over stdio
  ```

  — macOS should name the program in its prompt; which program it names when the host runs from a login service rather than the desktop app is not known (blueprint).
- The packaged app's launch with the vendored server (the DMG and the packaged-app gate run in the owner's terminal; `electron-builder.yml` and `main.ts` are changed but not packaged here).
- A real call of an Apple tool (AppleScript behind it), a real Vault, a live harness, the Charter and panel screens, a phone.
- The HTTP backend and Composio (the other half of step 4, another errand): HTTP entries answer `Unreachable` from `defaultBackendsLayer`.
- Windows and Linux hosts: the platform is injected in tests; the stdio child's Node lookup is macOS-oriented and falls back to `node` on the PATH.
