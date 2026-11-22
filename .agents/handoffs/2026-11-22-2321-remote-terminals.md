# Handoff: Remote terminals (paired devices)

Supersedes: none
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS, branch `worktree/remote-terminals` (worktree at `.worktrees/remote-terminals`), based on `origin/main` at `3fb51bad`.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Make the conversation terminal available to paired devices, per ADR 0020: the shells (node-pty) run in the host service, the host window opens the owner's full login shell, and a paired device opens one only while the host's off-by-default "Allow terminals from paired devices" switch is on, fenced in the OS sandbox. The batch (CHG-0644) is implemented, verified, and landed; what remains is the by-hand live checks and any follow-up the owner asks for.

## State

- The batch is committed as CHG-0644 ("Move conversation terminals into the host service (CHG-0644)", 51 files) on `worktree/remote-terminals`, rebased onto `origin/main` at `3fb51bad` and pushed to `main` at the tip of that branch (verified: `git merge-base --is-ancestor origin/main worktree/remote-terminals` before the push; the push itself is recorded by the final `git ls-remote` readback).
- Contracts: `packages/contracts/src/terminalRequests.ts` adds `OpenTerminal`/`WriteTerminalInput`/`ResizeTerminal`/`CloseTerminal` with a `TerminalSession` answer; `frames.ts` adds `TerminalData`/`TerminalExit` broadcast frames; `records.ts` adds `Settings.shouldAllowRemoteTerminals` (default off, one JSON row, no migration).
- Service: `packages/service/src/work/terminals.ts` — `ConversationTerminals` in its own `Terminals` service layer (`terminalsLayer`, finalizer inside it) with host and remote scopes; `core/wrappedSandbox.ts` is the Seatbelt/bwrap command wrapper shared out of the OpenCode sandbox; `Sessions.broadcast` carries shell frames; the remote shell writes only in its conversation's folder and a terminal temp folder, with the Vault hidden and no loopback token; only the host window can change the switch (`saveSettingsFromSource` refuses paired-device changes to it).
- App: `!` opens the shell from any screen through `ServiceClient` (`apps/app/src/terminal/terminalScope.ts` gates availability); the Workshop's Remote access card carries the switch; the desktop's Electron terminal IPC is gone (`apps/desktop/src/terminals.ts` deleted), the packaged launch gate (`apps/desktop/scripts/check-package.ts`) opens its shell through the packaged service.
- Checks, all verified in the worktree and after the rebase: `bun run check` clean, `bun run typecheck` green across workspaces, the full suite twice on the branch's own state (2,764 passed, 24 skipped of 2,788) and once on the rebased tip (2,774 passed, 24 skipped of 2,798); the gatewayCalls connector tests watched closely through this (46/46 after the fix described in the verify skill evidence).
- A first cut had put the shells' `Effect.acquireRelease` inside the service's own `make` build effect, which made three `gatewayCalls.test.ts` mid-turn switch tests fail deterministically: a finalizer there flips the sub-millisecond race between a turn's `takeSnapshot` and the owner's `SetConnectorTool` commits. Fix: own `Terminals` layer, like `harnessProcesses` and `hostRuntime`. Recorded in the verification record and in the worktree-lore.

## Decisions

- The fenced shell's READ side follows the harness sandbox: everything readable except the Vault, network open; writes confined to the conversation folder and the terminal temp (which also holds TMPDIR). ADR 0020's literal read fence would strip the owner's login shell of its start-up files and installed tools; the owner kept the harness-style reading on committing (2026-11-22). Recorded in the CHG-0644 changelog entry (Open line).
- Any stateful service part goes in its own `Context.Service` layer with its finalizer there — never a finalizer inside the Service layer's own build — because of the gatewayCalls race above.
- Batch number CHG-0641 was already taken on `origin/main` (Chronicle source labels); this batch is CHG-0644.
- The native phone app keeps no terminal surface (a stub), deferred to the mobile-parity backlog; phones reach a terminal through the browser web app.

## Next

1. By-hand live checks the owner asked to keep visible: a paired browser against a running host (relay path, switch, presentation), the real Seatbelt fence on a remote shell (tests drive a stand-in wrapper, `packages/service/test/fixtures/stand-in-sandbox.sh`), and the packaged launch gate in its new service-driven form.
2. Run the desktop app's own terminal path in the running window (`!` in a conversation).
3. Record any findings, then prune the "Terminals from a paired device" section from `documentation/work-in-progress.md` when the checks are done.

## Open questions

- Whether the phone app should get a native terminal surface later (backlog item; the browser path works meanwhile).
- Whether the read fence should ever tighten toward ADR 0020's literal wording; the owner's current word is the harness-style reading.

## Sources

- `documentation/capabilities/conversation-terminal/specifications.md` — the rewritten specification, including the fence and per-scope bounds.
- `documentation/architecture-decision-record/0020-terminals-run-in-the-host.md` and ADR 0012 — both marked built (CHG-0644).
- `documentation/changelog/0.2.2-Pre-Alpha.md` — the CHG-0644 entry with evidence and the open line.
- `documentation/verification/2026-11-22-remote-terminals.md` — checks run, what is not checked, and review notes.
- The commit "Move conversation terminals into the host service (CHG-0644)" and the parallel "Hand off remote terminals" commit on `main`.
