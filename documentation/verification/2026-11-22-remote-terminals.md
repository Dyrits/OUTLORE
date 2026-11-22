# Remote terminals · 2026-11-22 · CHG-0644

Implemented on `worktree/remote-terminals`, starting revision `7026ce87`. This record separates the checks run here from what remains for the owner.

## What is built

- Contracts: the `OpenTerminal`, `WriteTerminalInput`, `ResizeTerminal` and `CloseTerminal` requests (`packages/contracts/src/terminalRequests.ts`), their `TerminalSession` answer, `Settings.shouldAllowRemoteTerminals` (off by default), and the `TerminalData`/`TerminalExit` broadcast frames (`frames.ts`).
- Service: `ConversationTerminals` (`packages/service/src/work/terminals.ts`), in its own `Terminals` service layer so every shell ends when the layer closes — the host window's full login shell is kept separate from any paired device's fenced shell, one scope each; `Sessions.broadcast` carries the shell's frames to every connected screen; a paired device's shell runs inside the OS sandbox through the profile shared with the OpenCode sandbox (`core/wrappedSandbox.ts`), writing only in its conversation's folder and the terminals' own temporary folder, which also carries its `TMPDIR`; it cannot read the Vault's folder, inherits no loopback token, opens only while the switch is on, and is refused (`Unsupported`) when the host offers no sandbox.
- Nothing a paired device requests can turn the switch on or off: a `ChangeSettings` that changes it is refused, and a full `UpdateSettings` that tries is refused while one that leaves it unchanged passes. Other settings still change from a paired device.
- App: `!` opens the shell from the host's own window and from any paired device's screen, the latter only while the switch is on; `terminalPanel.web.tsx` drives xterm over the same `ServiceClient`; the Workshop's Remote access card carries the switch (host window only).
- Desktop: no terminal IPC remains in the Electron main process; the `dist/service.js` build keeps `--external node-pty`; `apps/desktop` still depends on `node-pty` so the packaged service ships it; the packaged launch gate (`check-package.ts`) opens its shell through the packaged service.

## Checks run on 2026-11-22, in this worktree

- `bunx biome check .` — clean, after its own sorted-keys and format fixes.
- `bun run typecheck` across the workspaces — passes.
- Full suite `CI=1 bun run test` (vitest over Electron), twice against the final state: 338 test files passed, 3 skipped (341); 2,764 tests passed, 24 skipped (2,788); the skips are the environment-gated ones (Seatbelt, live harness probes, pty).
- Focused suites: `packages/service/test/work/terminals.test.ts` (12) and `packages/service/test/work/appGuide.test.ts` (33); `apps/app/test/terminal`, `apps/app/test/foundation/client.test.ts`, `apps/app/test/conversation` (102); `packages/service/test/connectors/gatewayCalls.test.ts` (46), watched because a first cut of this batch put the shells' `Effect.acquireRelease` in the service's own build effect and deterministically flipped the sub-millisecond race between a turn's tool snapshot and the owner's mid-turn switch (the three "keeps a tool off ... during the turn" tests); the shells now live in their own `Terminals` service layer, as the harness processes and host runtime do, and the race is back on main's side.

## Not checked

- A paired browser or second computer against a live host: the relay path, the presentation, and the switch's effect live.
- The real Seatbelt/bwrap fence on a remote shell: the service tests drive a stand-in wrapper (`packages/service/test/fixtures/stand-in-sandbox.sh`) over the shared profile builder; the profile's own enforcement is the one proven by the OpenCode sandbox's tests on a host that can apply it.
- A packaged build's launch gate in its new service-driven form.
- The desktop window's terminal behavior through the new request path in the running app.

## Behavior notes for review

- A paired device joining a conversation whose host-window shell is already open gets its own fenced shell; the two never mix, on either screen.
- A paired device's shell writes no command history in the owner's home (its writes stay in the conversation folder and the terminal temp), so the shell's own history saving fails quietly.
- Reads of the host outside the fence follow the harness sandbox (everything readable except the Vault; the network open) — the workable reading of ADR 0020's stricter read fence, which the owner kept on committing (2026-11-22).
