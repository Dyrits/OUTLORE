# Handoff: Mistral Vibe harness, first live probe and the MCP server fix (CHG-0522)

Supersedes: `2026-11-18-2209-mistral-vibe-provider.md`
Workspace: OUTLORE, branch `main`, committed and pushed to `origin/main` with this handoff

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Outlore runs threads on Mistral Vibe through `vibe-acp`. Done means the owner has run a real thread in the app on a real `vibe-acp` (first turn, a tool call that asks, an interrupt, a second turn, sign in) and looked at the Providers card and pickers in a window and on a phone.

## State

- Fixed (CHG-0522): the owner's turn failed with "Invalid params". Cause: `session/new` and `session/load` got Outlore's tool server as `{name, url}`; ACP's `HttpMcpServer` also requires `type: "http"` and `headers`. `mcpServersOf` in `packages/service/src/harness/vibe.ts` now sends `{type, name, url, headers: []}`, and `stand-in-vibe.mjs` rejects a malformed `mcpServers` with -32602 as Vibe does.
- Verified now (command output, this session): against the real `vibe-acp` 3.1.3 (installed at `~/.local/bin/vibe-acp`, signed in), the old shape gives -32602 naming `mcpServers.0.HttpMcpServer.headers`; the new shape opens a session, `session/set_config_option` accepts `mode`, `model` and `thinking`, a prompt answers, and `session/load` succeeds. `bun run test packages/service/test/harness/vibe.test.ts` passes 10 of 10 (7 failed with the old shape and the stricter stand-in), Biome is clean on the two changed code files, `bun run typecheck` passes on all workspaces.
- Not verified: the full test suite after this change; a thread in the app; Outlore's tool server answering Vibe's MCP client (the probe used an unreachable URL); `session/request_permission` and `session/cancel` on the real server; the window and phone looks.
- Seen on the real server: the `thinking` config option lists `low|medium|high` and the `model` option lists `mistral-large-4-0`, `mistral-medium-latest`, `zai-glm-5-3`, `zai-glm-5-3-flash`. The previous handoff assumed thinking levels needed a newer Vibe than 3.1.3; `vibeAccount.ts` reads per-model levels from `_meta["mistral.ai/thinking"]`, which this probe did not show, so the effort picker may still offer only the default. Unchecked.
- Sandbox: a thread's sandbox blocks `vibe-acp` from writing `~/.vibe/logs`, so a live probe runs outside it. Bash calls with the sandbox disabled were intermittently refused with "This thread is not at work, so nothing runs"; the cause is undiagnosed.

## Decisions

- The stand-in is the regression seam: it validates what Vibe validates, so a wire-shape error shows in `vibe.test.ts`. Recorded in CHG-0522.
- The decisions of the superseded handoff stand (Unprotected containment, `vibe-acp --setup` opens a Terminal, install through uv, `VIBE_HOME`, `OUTLORE_VIBE_PATH`).

## Next

1. Run a short thread on Vibe in the app and check the first turn, a tool call that asks, an interrupt, a second turn in the same session, and Sign in from the Providers card. Compare any failure with the real server's answer first (drive `vibe-acp` directly over stdio with the same requests the adapter sends), then fix the adapter and extend the stand-in so the test goes red first.
2. Check that Vibe's MCP client reaches Outlore's tool server (the thread's `mcpUrl`) and calls a tool.
3. Check whether the effort picker lists `low|medium|high` for Vibe models; if not, read the `thinking` config option instead of only `_meta`.
4. Run the opt-in live check in `packages/service/test/harness/liveHarnesses.test.ts` with `OUTLORE_VIBE_PATH` set, then the full suite.
5. Ask the owner to look at the Providers card, pickers, usage colours and Mistral mark in a window and on a phone.

## Open questions

- `session/set_config_option` with `model` persists the model to the account's `config.toml` (mistralai/mistral-vibe#1556). Acceptable? Only the owner answers.
- Should Vibe get a host sandbox wrap like OpenCode's? Only the owner answers.
- Why were sandbox-disabled Bash calls refused with "This thread is not at work"? Not answered.

## Sources

- The fix: `packages/service/src/harness/vibe.ts`, `packages/service/test/fixtures/stand-in-vibe.mjs`.
- The record: `documentation/changelog/0.1.11-Prototype.md` (CHG-0522), `documentation/work-in-progress.md`.
- The tests: `packages/service/test/harness/vibe.test.ts`.
- The research note: `documentation/research/mistral-vibe-acp-2026-11-18.md`.
- The earlier work: `documentation/changelog/0.1.10-Prototype.md` (CHG-0520).
