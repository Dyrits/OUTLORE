# ACP v2 Preview: primary-source evaluation for Outlore

Researched 2026-11-27 against primary ACP specifications, RFDs, release tags, upstream harness repositories, and local read-only probes.
Compares ACP v2 Preview against Outlore's current ACP v1 implementation in `packages/service/src/harness/` across all eight ACP harnesses Outlore drives.

## Sources and method

- **ACP v2 Preview announcement** (published 2026-11-20 by Ben Brandt, Zed Industries / ACP Lead Maintainer): `https://agentclientprotocol.com/announcements/acp-v2-preview.md`.
- **ACP v2 Draft announcement** (published 2026-11-20 predecessor, 2026-07-20): `https://agentclientprotocol.com/announcements/acp-v2-draft.md`.
- **ACP v2 protocol specification and migration guide**: `https://agentclientprotocol.com/protocol/v2/overview.md`, `https://agentclientprotocol.com/protocol/v2/migration.md`, `https://agentclientprotocol.com/protocol/v2/prompt-lifecycle.md`, `https://agentclientprotocol.com/protocol/v2/initialization.md`, `https://agentclientprotocol.com/protocol/v2/session-setup.md`, and `https://agentclientprotocol.com/protocol/v2/tool-calls.md`.
- **ACP v2 tracking RFD and related RFDs**: `https://agentclientprotocol.com/rfds/v2/overview.md` (updated 2026-11-20), `https://agentclientprotocol.com/rfds/client-system-prompt.md`, and `https://agentclientprotocol.com/rfds/end-turn-token-usage.md`.
- **GitHub releases checked 2026-11-27**: `agentclientprotocol/agent-client-protocol` (`schema-v2.0.0-beta.4`, published 2026-11-23; `schema-v1.35.0`, published 2026-11-23; Rust crate `v1.22.0`) and `agentclientprotocol/typescript-sdk` (`v2.12.0`, published 2026-11-24).
- **Upstream harness primary sources checked 2026-11-27**: `anomalyco/opencode` (issue `#44877`), `mistralai/mistral-vibe` (`pyproject.toml`, issues `#989`, `#1447`, `#1633`), `cline/cline`, `NousResearch/hermes-agent` (`pyproject.toml`, PR `#156312`), `https://cursor.com/docs/cli/acp.md`, and `https://agentclientprotocol.com/get-started/agents.md`.
- **Local read-only probes on 2026-11-27**: `--version` and a single unauthenticated v2-shaped `initialize` (`protocolVersion: 2`, `info`, `capabilities: {}`) sent over stdio to `opencode acp` (`v2.2.0`), `vibe-acp` (`3.1.4`), and `agy acp --stdio` (`1.5.18`, with `AGY_CLI_DISABLE_AUTO_UPDATE=true`), closing stdin immediately without opening a session or touching credentials.
- **Outlore codebase read**: `packages/service/src/harness/acpSession.ts`, `acpStart.ts`, `acpTurn.ts`, `acpPrompt.ts`, `acpPermissions.ts`, `acpDialect.ts`, `acpHarness.ts`, `acpProviders.ts`, `acpProviderRoster.ts`, `fileEditEvents.ts`, `opencode.ts`, `vibe.ts`, `antigravityProvider.ts`, `clineProvider.ts`, `copilotProvider.ts`, `cursorProvider.ts`, `devinProvider.ts`, and `hermesProvider.ts`.

---

## 1. What ACP v2 is: status, timeline, and version negotiation

- **Status (Preview, not frozen)**: ACP v2 moved from Draft (published 2026-07-20, `announcements/acp-v2-draft.md`) to **Preview** on 2026-11-20 after 17 alpha schema releases (`announcements/acp-v2-preview.md`).
  The latest published v2 schema tag is `schema-v2.0.0-beta.4` (2026-11-23, `agentclientprotocol/agent-client-protocol`), alongside v1 `schema-v1.35.0`.
  Maintainers describe Preview as settled enough to build on while still open to changes if implementations uncover problems (`announcements/acp-v2-preview.md`, `protocol/v2/migration.md`).
  They explicitly recommend that Clients keep requesting v2 **opt-in** while Preview feedback comes in, and that neither side drop v1 (`announcements/acp-v2-preview.md`).
- **Scope and explicit deferrals**: v2 Preview is scoped strictly to the fifteen breaking-change RFDs plus baseline Subagent Sessions (`rfds/v2/overview.md`).
  Two major items are intentionally **not** in v2 Preview because they can land additively without another breaking change: remote transports (`rfds/streamable-http-websocket-transport.md`) and explicit prompt steering/queueing semantics (`announcements/acp-v2-preview.md`, `rfds/v2/overview.md`).
- **Version negotiation with v1 peers**: A Client sends its highest supported integer `protocolVersion` (`2`) in `initialize` (`protocol/v2/migration.md#version-negotiation`).
  A v2-capable Agent selects the highest version it supports at or below the requested version, or rejects with JSON-RPC error `-32022` (`Unsupported protocol version`, carrying `{ requested, supported }` data) if none exists.
  A legacy v1-only Agent can answer `"protocolVersion": 1` with v1 `agentCapabilities` and `agentInfo` fields to a Client that sent v2 `info` and `capabilities`.
  Because a v1 Agent ignores the v2 `capabilities`/`info` fields, a Client that needs v1-only `clientCapabilities` (such as `fs`, `terminal`, or `auth.terminal`) must reconnect with a v1 `initialize` (`protocol/v2/migration.md#version-negotiation`).
  The spec and Rust schema explicitly reject blanket v1↔v2 struct conversion and recommend two thin version-specific protocol adapters behind shared application logic (`protocol/v2/migration.md#supporting-v1-and-v2-side-by-side`, `rfds/v2/overview.md`).

---

## 2. Concrete protocol changes in ACP v2 compared to v1

### Initialization, capabilities, and wire rules

- **Role-agnostic `info` and `capabilities`**: `clientInfo`/`agentInfo` become required `info`, and `clientCapabilities`/`agentCapabilities` become `capabilities` in both directions (`protocol/v2/migration.md#initialization`).
- **Object support markers**: Boolean capability flags (`image: true`, `http: true`) become object markers (`{}` = supported, omitted or `null` = unsupported), and session-scoped groups nest under `capabilities.session` (`session.prompt`, `session.mcp`, `session.delete`, `session.additionalDirectories`, `session.systemPrompt`) (`protocol/v2/migration.md#capability-reorganization`).
- **Stricter JSON-RPC envelope and errors**: JSON-RPC batches are forbidden (`-32600`), request IDs must be strings or integers (never `null`), and five error codes become mandatory (`-32601` unimplemented/unadvertised method, `-32002` unknown/inactive session with `data.sessionId`, `-32600` pre-initialize or repeated `initialize`, `-32602` invalid `systemPrompt`/cursor/unadvertised prompt content type, and `-32022` version mismatch) (`protocol/v2/migration.md#errors`, `rfds/v2/overview.md`).
- **Open enums and unions**: Most enums and tagged unions accept unknown variants (`_`-prefixed for vendor extensions, non-underscore reserved for future ACP versions) (`protocol/v2/migration.md#extensibility-and-forward-compatibility`).
- **Domain-specific IDs**: Generic `id` fields are renamed to `methodId` (auth methods) and `configId`/`groupId` (config options) (`protocol/v2/migration.md#consistent-id-naming`).

### Session lifecycle, resume, and baseline methods

- **Required session baseline**: Advertising `capabilities.session` commits the Agent to seven baseline methods (`session/new`, `session/list`, `session/resume`, `session/close`, `session/prompt`, `session/cancel`, `session/update`) without per-method capability markers (`protocol/v2/migration.md#baseline-methods`).
- **`session/load` removed; `session/resume` unified**: `session/resume` handles both no-replay reattach (omit `replayFrom`) and full history replay (`replayFrom: { type: "start" }`) (`protocol/v2/migration.md#session-setup-and-lifecycle`).
  Every successful `session/resume` emits a current `state_update` before responding; a replay ends with a new `replay_complete` update before live updates resume (`protocol/v2/migration.md#session-setup-and-lifecycle`).
- **Optional `mcpServers` and initial commands**: `mcpServers` is now optional on `session/new` and `session/resume`, and both responses carry `availableCommands` (each command tagged `type: "command"`, input `type: "text"`) alongside non-null `configOptions` (`protocol/v2/migration.md#consistent-lifecycle-requests`, `#slash-commands`).
- **Consistent close and delete**: `session/close` cancels foreground work (emitting final updates and idle `cancelled` state before responding), stops background work, and fails uninserted prompts with `-32800`; `session/delete` cancels active work the same way (`protocol/v2/migration.md#method-changes`).

### Prompt lifecycle, mid-turn submissions, background work, and cancellation

- **`session/prompt` acknowledges insertion, not turn end**: `session/prompt` returns `{ messageId }` as soon as the user message is inserted, accepts an optional `idempotencyKey` for safe retries, and reports the message via `user_message` or `user_message_chunk` (`protocol/v2/migration.md#the-new-prompt-lifecycle`).
- **Foreground state via `state_update`**: Foreground progress moves to `state_update` notifications with `state: "running" | "idle" | "requires_action" | "unknown"` (`protocol/v2/migration.md#session-states`).
  Stop reasons (`end_turn`, `max_tokens`, `max_turn_requests`, `refusal`, `cancelled`, plus new `error` carrying a JSON-RPC `error` object) move to the idle `state_update`.
  A JSON-RPC error response to `session/prompt` now always means the message was never inserted.
- **Prompts during active work**: Agents **MUST NOT** reject `session/prompt` solely because foreground work is active; they must insert it immediately or hold it in order (keeping its RPC response pending until inserted) (`protocol/v2/migration.md#v2-the-response-acknowledges-insertion`).
  Whether an inserted prompt steers active work or starts a next round remains agent-defined until a follow-up steering/queueing RFD lands (`announcements/acp-v2-preview.md`).
- **Background work and per-item cancel**: `state_update` may include a `background` list of terminals, tool calls, and child sessions outliving foreground work (`protocol/v2/migration.md#background-work-and-cancel-controls`).
  `session/cancel` stops foreground work only and leaves listed background items running; tool calls gain `paused` and `cancelled` statuses, and items advertising `capabilities.cancel` can be stopped individually with `tool_call/cancel` or `terminal/cancel`.
  On `session/cancel`, the Agent cancels obsolete pending permission/elicitation requests individually with `$/cancel_request` rather than the Client answering all of them (`protocol/v2/migration.md#cancellation`).

### Streaming, tool calls, diffs, plans, and subagents

- **Upsert updates and required `messageId`**: Every message chunk requires `messageId`, and whole-message upserts (`user_message`, `agent_message`, `agent_thought`) join chunks with three-state patch semantics (omitted = unchanged, `null` = cleared, value = replaced) and key-level top-level `_meta` patches (`protocol/v2/migration.md#messages-and-message-ids`, `rfds/v2/meta-patches.md`).
- **Single tool-call notification and streaming content**: `tool_call` is removed; the first `tool_call_update` for a `toolCallId` creates the tool call, and `tool_call_content_chunk` appends individual content items (`protocol/v2/migration.md#tool-calls`).
- **Structured diffs replace `oldText`/`newText`**: `diff` content now carries a required `changes` array (`operation: "add" | "delete" | "modify" | "move" | "copy"`, absolute `path`/`oldPath`, optional `fileType`/`mimeType`) plus an optional `patch: { format: "git_patch", text }` with absolute paths and no `a/`/`b/` prefixes (`protocol/v2/migration.md#diff-content`).
  Snippets without line numbers have no v2 diff representation.
- **Display-only Agent terminals**: Client `fs/*` and `terminal/*` execution methods are removed; `terminal` content references Agent-owned display terminals updated via `terminal_update` and base64 `terminal_output_chunk` (`protocol/v2/migration.md#agent-owned-terminal-display`, `#client-file-system-and-terminal-execution-removed`).
- **Baseline plans, notices, compaction, and subagents**: `plan` is replaced by `plan_update` (`planId`, `type: "items" | "markdown"`) and `plan_removed`; notices, compaction updates, plan operations, boolean config options, and **subagent child sessions** (`subagent_update`, `session_message`, `session_message_chunk`) require no Client capability in v2 (`protocol/v2/migration.md#client-capability-fields`, `#subagents`).
  Every v2 Client **MUST** register announced child sessions and route their updates and requests instead of dropping them (`protocol/v2/migration.md#subagents`).

### Permissions, elicitation, modes/config options, MCP, auth, and usage

- **Permissions restructured**: `session/request_permission` requires a human-readable `title` (plus optional `description`) separate from an optional tagged `subject` (`type: "tool_call"` or `type: "command"` with `command`, absolute `cwd`, and optional `toolCallId`/`terminalId`) (`protocol/v2/migration.md#permission-requests`).
  Selecting `reject_once`/`reject_always` or returning `cancelled` denies only that operation and does not imply cancelling foreground work.
- **Elicitation**: `elicitation/create` and `elicitation/complete` (stabilized in both v1 and v2) drop `pattern` from string properties to match MCP, treat unknown response actions as `cancel`, and answer `-32601` when the Client has no `elicitation` capability (`protocol/v2/migration.md#elicitation`).
- **Modes removed in favor of config options**: `modes`, `session/set_mode`, and `current_mode_update` are removed (`protocol/v2/migration.md#session-modes-become-config-options`).
  Mode, model, `model_config`, `speed`, and `thought_level` (ordered lowest to highest) are all `configOptions` with `configId`/`groupId`, updated via `session/set_config_option` carrying a required `type: "id" | "boolean"` discriminator.
- **MCP server transport**: `type: "sse"` is removed, every `mcpServers` entry requires `type` (including `type: "stdio"` with an absolute `command`), server `name`s must be unique, empty `args`/`env`/`headers` are optional, and stdio support becomes an explicit `capabilities.session.mcp.stdio` marker alongside `session.mcp.http` (`protocol/v2/migration.md#mcp-server-configuration`).
- **Auth**: `authenticate` and `logout` become `auth/login` and `auth/logout` (both required whenever `authMethods` is non-empty); `authMethods` entries use `methodId`, required `type: "agent" | "terminal"`, and `{ name, value }[]` `env` for terminal auth (`protocol/v2/migration.md#authentication`).
- **Usage and cost**: Session-level `usage_update` (context `used`/`size` and patchable `cost`) is stable in both v1 and v2 (`protocol/v2/migration.md#session-update-variant-changes`).
  End-turn token usage (`rfds/end-turn-token-usage.md`) remains **Draft/unstable** in both versions (moving from v1 `PromptResponse.usage` to v2 idle `state_update.usage` in the unstable schema, `protocol/v2/migration.md#v2-the-response-acknowledges-insertion`).

---

## 3. ACP v2 support across Outlore's eight ACP harnesses

As of 2026-11-27, **none of Outlore's eight ACP harnesses have shipped or announced ACP v2 support**.
The only agents listed as serving v2 in the Preview announcement and tracking RFD are `claude-agent-acp` and `codex-acp` (`announcements/acp-v2-preview.md`, `rfds/v2/overview.md`), neither of which Outlore uses because Outlore drives Claude Code and Codex directly (`documentation/backlog.md:98`).

| Harness | Primary-source status (2026-11-27) | Evidence |
| - | - | - |
| **OpenCode** | v1 only; open feature request for v2 | Local `opencode v2.2.0` answered `protocolVersion: 1` to a v2 `initialize` probe; `anomalyco/opencode#44877` ("[FEATURE]: ACP v2 draft spec support", opened 2026-08-25) remains open. |
| **Mistral Vibe** | v1 only | Local `vibe-acp 3.1.4` answered `protocolVersion: 1` to a v2 `initialize` probe; `mistralai/mistral-vibe` `pyproject.toml` pins `agent-client-protocol==0.11.0`. |
| **Antigravity** | v1 only | Local `agy 1.5.18` answered `protocolVersion: 1` (with v1 `agentCapabilities` and `_meta.antigravity.systemPrompt.append`) to a v2 `initialize` probe; no v2 announcement found. |
| **Cline** | v1 only | No ACP v2 issue, PR, or release found in `cline/cline`. |
| **GitHub Copilot** | v1 only | Official Copilot CLI ACP support is v1 public preview (`2026-01-28`); no v2 announcement found. |
| **Cursor** | v1 only | Official docs (`https://cursor.com/docs/cli/acp.md`) document `protocolVersion: 1`, `clientInfo`, and `session/load`; no v2 announcement found. |
| **Devin** | v1 only | No primary-source announcement of ACP v2 support found. |
| **Hermes** | v1 only | `NousResearch/hermes-agent` `pyproject.toml` pins `agent-client-protocol==0.9.0`, and open PR `#156312` targets v1 `agent-client-protocol 1.0` `configOptions`. |

---

## 4. Relevance and impact for Outlore

### Real v1 workarounds in Outlore that ACP v2 solves or simplifies

1. **Session reopen split and replay-drain race (`acpSession.ts:27-63`, `acpDialect.ts:46`)**: Outlore currently branches between `session/resume` (Antigravity only) and `session/load` + `Queue.clear(rpc.incoming)` to discard replayed tool calls.
   In v2, `session/resume` without `replayFrom` is mandatory baseline, and `replay_complete` removes guesswork whenever replay is requested.
2. **Mid-turn prompt flight and background work (`acpPrompt.ts:17-144`, `acpTurn.ts:114-147`, `antigravityProvider.ts:93-96`)**: Outlore's `AcpPromptFlight` exists solely to juggle overlapping `session/prompt` RPCs for Antigravity's `steersWithPromptFrom: "1.5.0"`, while `inlineFailurePattern` scrapes Antigravity's quota failures out of `agent_message_chunk` text.
   v2 decouples `session/prompt` from turn completion, requires agents to accept or hold prompts during active work, reports post-insertion errors cleanly via idle `state_update` (`stopReason: "error"` + `error`), and surfaces detached background work (`background` list, `tool_call/cancel`, `terminal/cancel`) that Outlore's Antigravity backlog (`documentation/backlog.md:12`) still lists as open.
3. **File edit diff workarounds (`fileEditEvents.ts:39-84`)**: Outlore maintains custom OpenCode and Vibe branches plus `isOpenCodeWrite` because v1 `oldText`/`newText` cannot distinguish deletes from empty overwrites or represent renames/patches.
   v2's `changes` + `git_patch` aligns directly with Outlore's existing `patch` representation (`fileEditEvents.ts:31,49`).
4. **Permission metadata merging and refusal reprompting (`acpPermissions.ts:88-98`, `acpTurn.ts:154-159`, `opencode.ts:196`)**: Outlore merges cached `toolCalls` into permission requests and runs `shouldRepromptRefusals` because OpenCode cancels the whole prompt on a denial.
   v2's `subject: "command"` carries `command` and absolute `cwd` directly (matching Outlore's folder/sandbox checks), `subject: "tool_call"` carries full `ToolCallUpdate` state, and denials/cancellations no longer terminate foreground work.
5. **Explicit MCP stdio capability (`acpSession.ts:121-130`, `vibe.ts:22,38`)**: Outlore hardcodes `toolServer: "http"` for Vibe because `vibe-acp` rejects stdio MCP with `-32602` despite v1 treating stdio as mandatory.
   v2 makes `session.mcp.stdio` an explicit capability marker alongside `session.mcp.http`.
6. **Modes and config option drift (`acpStart.ts:111-130`, `acpSession.ts:109-114`)**: Outlore currently inspects v1 `modes.availableModes` for `"ask"` and falls back between `"thinking"` and `category === "thought_level"`.
   v2 unifies modes into `configOptions` (`category: "mode"`) and standardizes `thought_level` ordering.
7. **Zero cost from removed Client `fs`/`terminal` APIs (`acpSession.ts:9-13`)**: Outlore already sends `{ fs: { readTextFile: false, writeTextFile: false }, terminal: false }`, so removing them in v2 breaks nothing in Outlore.

### Gaps that ACP v2 does NOT solve (or that already landed in v1)

- **System prompts and elicitation already landed in stable v1**: Client-provided `systemPrompt` (`rfds/client-system-prompt.md`) and structured `elicitation` (`rfds/elicitation.md`) are stable in **both** v1 and v2 (`announcements/acp-v2-preview.md`).
  Outlore does not need v2 to replace Antigravity's `_meta.antigravity.systemPrompt.append` (`acpStart.ts:61-68`) or `interaction_*` question workaround (`acpPermissions.ts:92`, `antigravityProvider.ts:95`) once upstream agents adopt those v1 RFDs (e.g., `anomalyco/opencode#62716`).
- **End-turn token usage is still Draft**: `rfds/end-turn-token-usage.md` is not stabilized in v2 Preview, so Outlore's `cumulative` vs `perPrompt` split (`acpDialect.ts:58`, `vibe.ts:39`, `mistralai/mistral-vibe#1447`) will not disappear with v2 alone.
- **Steering vs queueing is still unspecified**: v2 guarantees that a mid-turn `session/prompt` is not rejected for being busy, but leaves steering vs queueing semantics to a future RFD (`announcements/acp-v2-preview.md`).

### Risks, migration costs, and timing

- **Dual-stack maintenance cost**: Outlore speaks raw JSON-RPC 2.0 over `RpcProcess` (no `@agentclientprotocol/sdk` dependency), which keeps a future v2 adapter self-contained behind `HarnessProtocol` / `AcpDialect`, but v1 and v2 cannot share wire handlers (`protocol/v2/migration.md#supporting-v1-and-v2-side-by-side`).
  Adding v2 requires a second turn loop driven by `state_update` instead of `session/prompt` completion, upsert state merging with three-state patch semantics, `git_patch` diff parsing, and mandatory child-session (`subagent_update`) routing instead of dropping non-matching `sessionId` notifications (`acpTurn.ts:83`).
- **Preview churn risk with zero immediate beneficiaries**: Because `schema-v2.0.0-beta.4` is not frozen and **0 of Outlore's 8 ACP harnesses** serve v2 today, building a v2 client now would only test against fakes (or unused `claude-agent-acp`/`codex-acp`) and risk rework before v2 reaches stable.
- **When to adopt**: Track ACP v2 Preview and wait until (a) the v2 schema freezes/stabilizes, or (b) at least one of Outlore's primary ACP harnesses (OpenCode, Mistral Vibe, or Antigravity) ships v2 support.
  Meanwhile, any near-term ACP v1 improvements in Outlore (such as `sessionCapabilities.systemPrompt` or `elicitation/create`) can be adopted directly on v1 as agents ship them, and will carry over cleanly to v2.
