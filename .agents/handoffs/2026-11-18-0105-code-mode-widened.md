# Handoff: Code Mode widened to every tool of Outlore's tool server

Supersedes: `2026-11-17-2348-charter-code-mode-switch-on-main.md`
Workspace: OUTLORE, branch `worktree/code-mode-widen` in `.worktrees/code-mode-widen` (commit `ee0e092` over `main` at `00d569c`; not merged, not pushed)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner wants Code Mode to be what Cloudflare's article describes: a thread reaches many tools through one code tool, not only connector calls, and it works now, without a connector. Done when the owner has seen it, it is on `main`, and a live harness has run it.

## State

- Verified now: `git log` shows `ee0e092` on `worktree/code-mode-widen`, one commit over `00d569c`. The `return-destination` file in `.git/worktrees/code-mode-widen/` names the main checkout, `main`, the base and the branch.
- Verified by running on this branch before the commit: Biome, the seven typechecks and `CI=1 bun run test` (254 files, 2,061 tests passed, 54 skipped). The pre-commit hook then ran the related tests outside the sandbox: 1,118 passed, 10 skipped.
- Built: one `run_code` tool (was `run_connector_code`) that declares Outlore's own thread tools as `outlore.<tool>` beside the connectors' `connectors.<connector>.<tool>`; covered tools are hidden from the listing and refused when called directly while Code Mode is on; `request_approval`, `answer_prompt`, `report_result` and `suggest_mission` stay direct; at most 5 calls to `open_thread`, `send_thread_message` and `interrupt_thread` a run; the setting held per turn (`Endpoints.holdCodeMode`, set in `work/threads.ts`) and `ThreadAccess.usesCodeMode` in the Claude Code and Codex restart keys; the runner installs nested globals; a `run_code` call shows in the thread's steps as "Run code that calls its tools"; the Charter's switch reads "Code Mode" with new text. Documentation follows: connectors specification (Code Mode), ADR 0023 note, blueprint, backlog, glossary, work in progress, CHG-0446 (the proposal) and CHG-0447 (agreement and delivery) in the `0.1.8-Prototype` changelog, and [verification](../../documentation/verification/2026-11-18-code-mode-widened.md).
- Measured with no connector: the listing a thread is given is 20,077 characters with Code Mode off and 18,619 with it on, 7% less. The context saving from hiding definitions is small; the expected gain is from chained calls, which is unmeasured.
- Not checked: a live Claude Code, Codex or OpenCode writing and running the code; the restart on a changed setting on a live kept process (only the keys and the fake harness); whether Claude Code skips its own prompt for the calls the code makes; the Charter's switch in a window or on a phone; a real connector.
- The main checkout (`/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`) still holds the proposal's uncommitted edits to the connectors specification, ADR 0023 and the `0.1.8-Prototype` changelog (older versions of what this branch commits), and another session's uncommitted `documentation/work-in-progress.md` voice-input entry and untracked voice-input files. This branch also edits `work-in-progress.md`, so a merge can conflict there.

## Decisions

- On the owner's "implement it properly" I took every recommendation of the proposal as agreed, and the cap of 5 is my number; the owner may redirect any. They are listed at the end of the Code Mode section of the [connectors specification](../../documentation/capabilities/connectors/specifications.md#code-mode).
- The specification stays in the connectors specification; a capability of its own, `code-mode`, is a later, separate change.
- The setting keeps its stored name `shouldUseCodeMode`; no stored data changed.
- The Charter card is still titled "Connectors", with the switch in it; not changed.

## Next

1. The owner reads the decisions in the specification and redirects any (the cap of 5, the four direct tools, hiding versus also listing).
2. When the owner approves a merge: in the main checkout, discard the three duplicate proposal edits first (they are older copies of this branch's files), keep the other session's voice-input work, then merge `worktree/code-mode-widen` into `main`, resolving `work-in-progress.md`. Pushing `main` needs the owner's approval.
3. Run it live: turn the switch on, give a thread a task that chains Outlore's tools, and read its tool calls; count calls, model turns and tokens with the switch on and off on the same tasks.
4. The owner looks at the Charter's switch in a window and on a phone.

## Open questions

- Does a model write working code against the declarations on Claude Code, Codex and OpenCode, and does it prefer it? A live run answers it.
- Does Claude Code run the tool's inner calls with no prompt of its own? A live Claude Code run answers it.
- Should the calls the code makes show one by one in the thread's steps, not only the run? The owner decides.
- Should the Charter card be retitled now that Code Mode is not only about connectors? The owner decides.

## Sources

- [Connectors specification, Code Mode](../../documentation/capabilities/connectors/specifications.md#code-mode).
- [Changelog](../../documentation/changelog/0.1.8-Prototype.md) CHG-0446 and CHG-0447.
- [Verification](../../documentation/verification/2026-11-18-code-mode-widened.md).
- [ADR 0023](../../documentation/architecture-decision-record/0023-code-mode-runs-in-quickjs-inside-the-host.md).
- [Cloudflare's article](https://blog.cloudflare.com/code-mode/).
- `packages/service/src/connectors/codeMode.ts`, `packages/service/src/work/mcp.ts`, `packages/service/test/connectors/codeMode.test.ts`.
