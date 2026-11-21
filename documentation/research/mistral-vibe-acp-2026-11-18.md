# Mistral Vibe as a harness: the `vibe-acp` interface (read 2026-11-18)

Primary sources read for driving Mistral Vibe from Outlore (CHG-0515). Vibe is Mistral's open-source CLI agent
(`mistralai/mistral-vibe` on GitHub); the pip package is `mistral-vibe`, latest on PyPI **3.1.3** at read time.

## Sources

- PyPI wheel `mistral_vibe-3.1.3-*.whl` (downloaded 2026-11-18, `https://pypi.org/pypi/mistral-vibe/3.1.3/json`), read at:
  - `vibe/acp/agent.py` — the ACP agent: `initialize`, `authenticate`, `session/new`, `session/load`, `session/prompt`,
    `session/cancel`, `session/set_config_option`, `session/set_mode`, and `ext_method` (wire names `_`-prefixed,
    e.g. `_account/read`, `_identity/read`).
  - `vibe/acp/entrypoint.py` — `vibe-acp` console script; flags only `-v/--version` and `--setup` (onboarding/API key).
  - `vibe/acp/utils.py` — config options (`mode`, `model`, `thinking`), permission options
    (`allow_once`, `allow_always`, `allow_always_permanent`, `reject_once`, plus path-scoped variants), `ToolOption`.
  - `vibe/app_server/models.py` — `AccountView` (`status`, `plan.kind` api|chat|mistral_code, `budget.usagePercentage`/
    `resetAt`), `IdentityView` (`email`, names, workspace, organization).
- PyPI wheel `agent_client_protocol-0.11.0-py3-none-any.whl` (Vibe's pinned dependency, `Requires-Dist:
  agent-client-protocol==0.11.0`): `acp/meta.py` (schema ref `refs/tags/schema-v1.16.0`, `PROTOCOL_VERSION = 1`,
  method map: `session/new`, `session/load`, `session/prompt`, `session/cancel`, `session/set_config_option`,
  client methods `session/request_permission`, `session/update`, `elicitation/create`), `acp/schema.py`
  (camelCase wire aliases: `NewSessionRequest{cwd, mcpServers, additionalDirectories}`, `NewSessionResponse{
  sessionId, modes, configOptions}`, `PromptResponse{stopReason, usage}`, `Usage{totalTokens, inputTokens,
  outputTokens, thoughtTokens, cachedReadTokens}`, `HttpMcpServer{name, url, headers}`, content blocks
  `{type:"text", text}` and `{type:"image", data, mimeType}`, `AllowedOutcome{outcome:"selected", optionId}`,
  `StopReason = "end_turn"|"max_tokens"|"max_turn_requests"|"refusal"|"cancelled"`), `acp/router.py` (extension
  requests arrive with a `_` prefix and are dispatched as `method[1:]`).
- `https://docs.mistral.ai/vibe/code/use-vibe-in-other-ides` — Vibe implements ACP and is in the ACP registry; clients
  point at the installed `vibe-acp` command; Vibe in an ACP client shares `~/.vibe` config, credentials, MCP servers.
- GitHub `mistralai/mistral-vibe` issue #1556 — `session/set_config_option` with `model` persists `active_model` to
  `~/.vibe/config.toml`; newer builds put each model's thinking levels in the model option's
  `_meta["mistral.ai/thinking"] = {levels, default}` (not yet in the 3.1.3 release read here).
- `https://github.com/mistralai/mistral-vibe` README — install via `uv tool install --python 3.14 mistral-vibe`
  (or the curl install script); update via `vibe update` / `vibe --check-upgrade`.
- Simple Icons `mistralai.svg` (CC0, fetched 2026-11-18 from `simple-icons/simple-icons@develop`) — the provider mark.

## What Outlore's adapter uses (packages/service/src/harness/vibe.ts)

- One `vibe-acp` process per thread, JSON-RPC 2.0 newline-delimited on stdio (`startRpcProcess`, `isJsonRpc2: true`).
- `initialize` with `protocolVersion: 1`, no fs/terminal client capabilities; `session/new` with `cwd` and
  `mcpServers: [{name: "outlore", url: <thread tool server>}]` (HTTP MCP), or `session/load` to continue a stored
  session (a failed load is replaced by `session/new` plus the thread's handover text).
- Per session, `session/set_config_option`: `mode = "ask"` (every tool call asks), `model` when chosen, `thinking`
  when an effort is chosen. Caveat: `model` persists to the account's `config.toml` (issue #1556); per-account
  `VIBE_HOME` folders keep added accounts isolated.
- One `session/prompt` per turn; `session/update` notifications give `agent_message_chunk` (drafts), `tool_call` /
  `tool_call_update` (tracked by `toolCallId`, reported as steps), `usage_update` (`used` = context). The prompt's
  answer carries `stopReason` (`cancelled` = interrupted) and session-cumulative `usage`, read as a per-turn delta.
- `session/request_permission` arrives with only `toolCall.toolCallId`; the adapter judges from the tracked tool
  call (`kind`/`rawInput`/`locations`, same fields as OpenCode's) and answers `allow_once` / `reject_once`. A denial
  lets the turn carry on (Vibe feeds the denial back to the model); no refusal re-prompt is needed as for OpenCode.
- `session/cancel` interrupts; ACP takes no mid-turn message, so steering waits for the next turn (as OpenCode).
- Models: the `model` config option of one short session (`configOptions`), each option `value` = alias,
  `name` = label, `_meta["mistral.ai/thinking"].levels` = effort levels when the build provides them.
- Sign-in status and plan limits: extension requests `_identity/read` and `_account/read` on a short session —
  `IdentityView.email` + `AccountView.plan` for who is signed in; `AccountView.budget` (monthly `usagePercentage`,
  `resetAt`) as the plan limit; `plan.kind == "api"` bills as ApiKey, else Subscription. No credential is read.
- Version: `vibe-acp --version`; install: `uv tool install --python 3.14 mistral-vibe`; update: `vibe update`
  (the `vibe` binary, not `vibe-acp`); latest release read from PyPI's JSON API; account folder: `VIBE_HOME`.

## Not verified live

`vibe-acp` is not installed on this machine (Vibe Desktop bundles `vibe-app-server` only), so every behavior above is
checked against the stand-in `packages/service/test/fixtures/stand-in-vibe.mjs`, shaped from these sources — not
against a running Vibe. Open: a live probe with a real `vibe-acp` (turn, permission request, cancel, model/thinking
switch, `_account/read`), and whether `session/set_config_option model` persisting to `config.toml` is acceptable
for the computer's own sign-in.

## 2026-11-21: live probe of 3.1.3, and where its thinking levels are

`vibe-acp` 3.1.3 is now installed at `~/.local/bin/vibe-acp`. A live probe (`initialize`, one `session/new`, no MCP
servers) answers `configOptions` with three options: `mode` (`ask`, `accept-edits`, `smart-approve`, `auto-approve`),
`thinking` (`low`, `high`, `max`, current `high`), and `model` with five options (`mistral-large-4-0`,
`mistral-medium-latest`, `zai-glm-5-3`, `zai-glm-5-3-flash`, `deepseek-v4-1-flash-1017`) — and **no `_meta` on any
model**, so the per-model `mistral.ai/thinking` levels above are still not in the release. The levels 3.1.3 offers
are on the session's own `thinking` option, for every model alike.

Outlore's model list reads that option as a model's effort levels when the model option says none of its own
(`packages/service/src/harness/vibeAccount.ts`, CHG-0618), which restores the reasoning level in the companion
menu until a newer build reports each model's own and those take over per model.
