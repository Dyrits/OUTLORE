# Verification: Code Mode's core (CHG-0441)

Branch `worktree/code-mode`, on `main` at `6bc53e8` (started from `0affd46`, rebased before the changelog entry). Run inside Claude Code's sandbox (`CI=1`) with XDG_DATA_HOME absent and no pty, as for the whole suite.

## Results run on this branch

- `bun run check`: no fixes.
- `bun run typecheck`: seven workspaces pass.
- `CI=1 bun run test`: 250 files passed, 4 skipped; 2,034 tests passed, 54 skipped. The pre-commit hook also ran the service suite outside the sandbox: 1,281 passed, 10 skipped.
- New tests: `packages/service/test/connectors/codeExecutor.test.ts` (12), `codeTypes.test.ts` (4), `codeMode.test.ts` (9, through the real MCP tool server with a fake gateway, `test/fixtures/connectors.ts`).
- `bun build packages/service/src/main.ts --target=node --format=esm`, as `apps/desktop` builds `service.js`: 2.77 MB, with QuickJS inlined. A spike of the same variant ran under Node 26.12.1, Bun 1.4.3 and as a bundle, returning two awaited host calls in order and `undefined` for `fetch`, `require` and `process`.

## Dependency

`quickjs-emscripten-core` 0.32.0 and `@jitl/quickjs-singlefile-mjs-release-sync` 0.32.0 (MIT, Jake Teton-Landis; last published 2026-02-16; one dependency, `@jitl/quickjs-ffi-types`). The single-file build inlines the WebAssembly, so `bun build` bundles it with no file to copy. `bun add` ran in the sandbox and failed only at the `prepare` git-config step, after saving the lockfile.

## Not checked

- No real connector: the gateway is a fake, and the service's production layer offers no connector, so no thread is offered `run_connector_code` yet.
- The fake write waits on a test signal. With the real gateway, check that direct and Code Mode calls show the same approval question, the thread waits in Attention, and the code resumes with the answer. Check how Codex and OpenCode handle approval for `run_connector_code` and for the calls it makes.
- No live harness: whether Claude Code, Codex and OpenCode write working code against the declarations, and whether the setting's change reaches a reused harness process before it restarts (connectors blueprint, Open).
- No token or latency measurement of Code Mode's gain.
- The Charter's switch: not built; the setting is changed through `ChangeSettings` or Chronicler's `change_setting`.
- Runs that outlive a host restart: a run is lost with the host (ADR 0023).
