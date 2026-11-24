# ACP clients and Google Antigravity in T3 Code and Paseo: primary-source notes

Researched 2026-11-24 to inform Outlore's H2 unified ACP module with dialects and H3 tool-server wiring.
Ideas and protocol observations only; no upstream code was copied.

## Sources and method

- **`pingdotgg/t3code`** (MIT, `LICENSE`), shallow clone at commit `93a7cfe745ac784e559c727e4eccd90929dfd169` (committed 2026-11-24 07:58:11 -0800).
- **`getpaseo/paseo`** (Apache 2.0, `LICENSE`), shallow clone at commit `cf1a5a9e73a6dd3020fb62a6d10281a2193ff2f2` (committed 2026-11-24 15:51:30 +0000).
- **`tiezbro/paseo-agy-acp`** (Apache 2.0, `LICENSE`), shallow clone at commit `0a47967ccfd2d7f098788475988f121cdba1faf1` (committed 2026-11-23 00:32:42 -0800, release 2.10.0 pinning official Antigravity ACP kernel 1.5.2).
- **Local `agy` CLI 1.5.16** (`/Users/dgerrits/.local/bin/agy`): read-only `--version`, `agy acp --help`, and a single unauthenticated `initialize` JSON-RPC request over stdio with `AGY_CLI_DISABLE_AUTO_UPDATE=true` (no session opened, no network or keychain touched).
- Nothing in the cloned repositories was installed, built, or executed.
- All file paths and line numbers below are relative to the pinned commits above.

---

## 1. T3 Code (`pingdotgg/t3code` at `93a7cfe7`)

### Layered ACP architecture and flavors

T3 Code splits ACP into three layers so every ACP provider shares one protocol loop while expressing differences declaratively:

- `packages/effect-acp/`: low-level Effect JSON-RPC client and schema layer.
- `packages/provider-acp/src/server/AcpSessionRuntime.ts`: owns process spawn, process-group/cgroup teardown, `initialize`, `authenticate`, `session/new`, `session/load`/`session/resume`, MCP server selection, config/mode updates, and replay-idle readiness.
- `packages/provider-acp/src/server/adapter.ts`: `makeAcpAdapterV2` runs the turn loop, tool-call tracking, permissions, usage, and MCP bridging, parameterized by an `AcpAdapterV2Flavor` record (`adapter.ts:424-560`).
- Flavors using `makeAcpAdapterV2`: Antigravity (`apps/server/src/orchestration-v2/Adapters/AntigravityAdapterV2.ts`), Grok (`packages/provider-grok/src/server/adapter.ts`), Kiro (`packages/provider-kiro/src/server/adapter.ts`), fx (`packages/provider-fx/src/server/adapter.ts`), and the generic ACP registry (`packages/provider-acp-registry/src/server/adapter.ts`, with small per-agent helpers for Claude, Copilot, Devin, Droid, Kimi, OMP, and OpenCode).

### Initialization, `clientInfo.name`, and capability quirks on Antigravity

- **Model catalog and `clientInfo.name`**: `antigravityClientInfo(version)` (`apps/server/src/provider/acp/AntigravityAcpSupport.ts:74-75, 106-112`) notes that `agy acp` releases before `1.5.1` (`OPEN_MODEL_ACCESS_RELEASE = [1, 5, 1]`) offer non-Gemini models only to allowlisted editor clients such as Zed.
  For versions `< 1.5.1` (or unknown versions), T3 sends `{ name: "zed", version: "0.0.0" }`; for `>= 1.5.1`, it sends `{ name: "t3-code", title: "T3 Code", version }`.
- **Client filesystem capabilities**: `makeAntigravityAcpRuntime` (`AntigravityAcpSupport.ts:131-139`) sets `fs: { readTextFile: input.clientFileReads === true, writeTextFile: false }` and `terminal: false`.
  It explicitly keeps `writeTextFile: false` because advertising client writes makes Antigravity replace its diff edits with whole-file `client_edit_file` calls (`AntigravityAcpSupport.ts:133`).
  Because T3 enables `readTextFile: true`, it also runs `makeAntigravityReadRepair` (`apps/server/src/provider/acp/AntigravityProtocol.ts:319-381`, wired in `AntigravityAdapterV2.ts:167-203`) to work around a bug where Antigravity never completes a subagent's `client_view_file` call and later fails every open call on the next unrelated error.
- **System prompt append**: `antigravityAppendsSystemPrompt` (`AntigravityAcpSupport.ts:86-104`) checks `initializeResult.agentCapabilities?._meta?.antigravity?.systemPrompt?.append === true` and passes `_meta: { antigravity: { systemPrompt: { append } } }` on `session/new`.
- **Mid-turn steering**: `antigravitySteersWithPrompt` (`AntigravityAcpSupport.ts:76-84`, `AntigravityAdapterV2.ts:260-261`) enables sending a new `session/prompt` to steer a running turn on `agy >= 1.5.0` (`PROMPT_STEERING_RELEASE`), because `session/cancel` killed running subagents.
- **Version check at handshake**: `AntigravityDriver.ts:337-357` reads `agentInfo.version` from `initialize` (needed for custom or `PATH` binaries) and refuses broken runtimes before opening a session; T3 requires `>= 1.5` and recommends `>= 1.5.12` (`docs/user/providers-antigravity.md:65`).

### Auth, sign-in, and multi-account profile isolation

- **Isolated `GEMINI_HOME` per instance**: `resolveAntigravityInstanceDirectories` (`apps/server/src/provider/antigravityAuthSupport.ts:186-196`) hashes each `instanceId` into its own profile directory and launches `agy` with `["acp", "--gemini-dir", profile.geminiHome, "--app-data-dir", "antigravity-acp"]` (`antigravityAuthSupport.ts:554-563`), noting that `agy` joins `--app-data-dir` beneath `--gemini-dir` even when absolute (`:561`).
- **Keyring vs file storage on CLI 1.5 (critical finding)**: `antigravityEnvironment` (`antigravityAuthSupport.ts:230-237`) sets `GEMINI_HOME`, `AGY_ACP_FORCE_FILE_STORAGE=1`, `AGY_CLI_DISABLE_AUTO_UPDATE=1`, and for `oauth-personal` also sets `SSH_CONNECTION="127.0.0.1 0 127.0.0.1 0"`.
  The comment explains why: the 1.5 CLI ignores `AGY_ACP_FORCE_FILE_STORAGE` and stores Google sign-ins in one shared OS keyring entry across every profile unless it believes it is running over SSH (`:230-234`).
- **Four auth methods and clean env**: T3 supports `oauth-personal`, `oauth-business`, `gemini-api-key`, and `agent-platform`, writes `antigravity-acp/settings.json` with `{ auth: { type }, gcp? }` (no secrets), scrubs ambient `GEMINI_API_KEY`, `GOOGLE_*`, `GEMINI_HOME`, `ELECTRON_RUN_AS_NODE`, and `CHROME_CRASHPAD_PIPE_NAME` (`antigravityAuthSupport.ts:62-82, 146-155, 202-245`), sets `authenticateEagerly: true` (`AntigravityAcpSupport.ts:125`), and intercepts OAuth URLs via a `BROWSER` helper script plus stdout/stderr transforms (`antigravityAuthSupport.ts:27-59, 646-748`).
- **Per-process temp dir**: each spawn gets its own `TMPDIR`/`TEMP` under a T3-owned temp folder because each launch unpacks roughly 1 GB and force-killed processes leave temp files behind (`AntigravityDriver.ts:201-210, 277-300`, `antigravityAuthSupport.ts:220-243`).
- **User skills/rules**: `linkAntigravityUserConfig` (`antigravityAuthSupport.ts:256-391`) symlinks (or copies on Windows) `~/.gemini`'s skills directories, `AGENTS.md`, `GEMINI.md`, and `config/skills.json` into the isolated profile.

### Session management and Antigravity-specific protocol quirks

- **Resume over load**: `makeAntigravityAcpRuntime` sets `resumeMethod: "resume"` (`AntigravityAcpSupport.ts:126`) because `session/load` replays tool calls while `session/resume` avoids replay (`AntigravityAdapterV2.ts:242`).
- **Cancellation**: `cancelBehavior: "wait-for-prompt"` (`AntigravityAcpSupport.ts:127`) and `preserveRuntimeOnSettledInterrupt: true` (`AntigravityAdapterV2.ts:257-259`), since `session/cancel` kills the agent's running background commands.
- **Background work outliving `session/prompt`**: `antigravityToolOutlivesPrompt` (`AntigravityProtocol.ts:53-70`) and `AntigravityAdapterV2.ts:244-256` handle `schedule` and non-daemon `execute` calls that keep running after `session/prompt` resolves and later wake the agent with detached updates/permission requests (bounded by a 30-minute hold).
- **Plans from `update_steps`**: `makeAntigravityUpdateStepsPlans` (`AntigravityProtocol.ts:463-515`) converts Antigravity's `Run update_steps` tool calls into ACP `plan` updates because `agy` never emits native `plan` updates.
- **Model and thinking selection**: `applyAntigravityAcpModelSelection` (`AntigravityAcpSupport.ts:244-333`) reads `configOptions` with `id === "model"` and `category === "thought_level"`, supports legacy 1.3 model IDs encoding thinking suffixes via `allowUnlistedValue: true`, and rejects unavailable models cleanly.

### Permissions and modes

- **Keeping Antigravity in `"default"` mode**: `antigravitySessionMode` (`AntigravityAcpSupport.ts:169-184`) maps `yolo` and `auto_edit` back to `"default"` (and `auto` to `"default"` unless the session advertises `"auto"`), because **`agy` CLI rejects `yolo` and `auto_edit`**.
  In `"default"`, `agy` sends `session/request_permission` before acting and T3 answers from its live runtime policy (`packages/provider-acp/src/server/clientPolicy.ts:145-202`, `AntigravityAcpSupport.ts:210-226`) without restarting the process when permissions change.
- **Auto-allowing host MCP tools**: `antigravityPermissionDisposition` (`AntigravityAcpSupport.ts:188-226`) matches `Run mcp_t3-code_<tool>` and proxied `MCP Tool <tool>` (`rawInput.ServerName === "t3-code"`) and returns `"allow"` under `auto` and `auto-accept-edits`.
- **User-input questions over `session/request_permission`**: `isAntigravityUserInputRequest` (`AntigravityProtocol.ts:72-77, 142-189`) treats `toolCallId.startsWith("interaction_")` as a fixed-choice question rather than an approval, so even Full Access asks the user (`docs/user/providers-antigravity.md:85-86`).
- **Security warnings**: `antigravitySecurityWarning` (`AntigravityProtocol.ts:80-126`) surfaces `option._meta["agy.security.warning"]` on `allow_always` choices.

### File edits

- `apps/server/src/provider/acp/AntigravityEditLocation.ts:28-226` and `AntigravityProtocol.ts:544-631` handle Antigravity's edit payloads: `replace_file_content` and `multi_replace_file_content` send bare `TargetContent`/`ReplacementContent` snippets (in PascalCase or snake_case) where `StartLine` is only a search range start, and full-access edits report only a path.
- T3 reads the pre-edit file while `toolCall.status === "pending"` (up to 1 MiB) to locate unique whole-line matches and build unified diff hunks, marks unplaced hunks as `snippet, line unknown`, and omits patches over size/edit-distance budgets or truncated text.

### Context window and token usage

- **Context window**: `packages/provider-acp/src/server/runtimeModel.ts:1651-1657` parses `usage_update` notifications (`used` -> `usedTokens`, `size > 0` -> `maxTokens`).
- **Gemini/Antigravity per-turn input tokens**: `acpPerTurnPromptUsage` (`packages/provider-acp/src/server/adapter.ts:380-415`) takes a `geminiUsage` flag (`AntigravityAdapterV2.ts:306`, `geminiPromptUsage: true`) that computes `inputTokens = usage.inputTokens + (usage.cachedReadTokens ?? 0)`, because Gemini/Antigravity reports non-cached input tokens separately from `cachedReadTokens`.

### MCP and tool servers

- **Three-tier transport selection**: `sessionMcpServers` (`packages/provider-acp/src/server/AcpSessionRuntime.ts:2374-2388`) and `acpMcpContext` (`packages/provider-acp/src/server/adapter.ts:1096-1160`) pick the transport in order:
  1. **MCP-over-ACP** (`mcpCapabilities?.acp === true`): passes `{ type: "acp", name: "t3-code", serverId: "t3-code" }` and handles `mcp/*` requests in-process via `packages/provider-acp/src/server/mcpOverAcpBridge.ts`, forwarding JSON-RPC over HTTP to T3's MCP endpoint.
  2. **HTTP MCP** (`mcpCapabilities?.http === true` AND `flavor.mcpOverHttp === true`): passes `{ type: "http", name: "t3-code", url, headers }`.
     HTTP is opt-in per flavor because `codex-acp 1.2.0` and `pi-acp` drop injected HTTP servers (`adapter.ts:1106`).
  3. **Stdio MCP bridge fallback**: passes `{ name: "t3-code", command: self.command, args: [..., "acp-mcp-bridge"], env: [ELECTRON_RUN_AS_NODE=1, T3_ACP_MCP_ENDPOINT, T3_ACP_MCP_AUTHORIZATION] }`.
     `apps/server/src/mcp/AcpMcpStdioBridge.ts:12` states the reason directly: "ACP mandates stdio MCP support; HTTP/SSE support varies."
     The bridge (`AcpMcpStdioBridge.ts:206-444`) is a thin NDJSON-over-stdio to HTTP POST/SSE JSON-RPC forwarder to T3's existing HTTP MCP endpoint.
- **Antigravity wiring**: `AntigravityAdapterV2.ts:227-228` sets `mcpOverHttp: true`, so Antigravity uses HTTP when advertised and automatically falls back to the stdio bridge when `mcpCapabilities.http` is absent (as on `agy 1.5.16`).
- **MCP payload cleanup**: `withoutT3McpToolSummary` (`AntigravityProtocol.ts:383-429`) strips the `toolSummary` field that `agy` injects into MCP tool arguments before matching tool-call records.

---

## 2. Paseo (`getpaseo/paseo` at `cf1a5a9e`) and `tiezbro/paseo-agy-acp` (`0a47967c`)

### Paseo's shared ACP client and dialect subclasses

Paseo uses `@agentclientprotocol/sdk` (`ClientSideConnection`) in one shared base module (`packages/server/src/server/agent/providers/acp-agent.ts`, 4,484 lines) split into `ACPAgentClient` (process lifecycle, probing, diagnostics, catalog, session open/resume) and `ACPAgentSession` (prompt loop, permissions, `usage_update`, `diff` extraction, slash commands, MCP normalization).

- `generic-acp-agent.ts` (211 lines) extends `ACPAgentClient` for arbitrary command-based ACP agents.
- Per-provider dialects are thin subclasses (28–282 lines) that pass small hook functions and metadata into the base constructor rather than duplicating the protocol loop:
  - `cursor-acp-agent.ts` (104 lines): passes `clientCapabilityMeta: { parameterizedModelPicker: true }`, a `fast` config feature option, and `catalogModelResolver` calling `cursor/list_available_models` via `extMethod` (because switching models in a probe persists CLI preferences, `:45-46`).
  - `copilot-acp-agent.ts` (282 lines): passes `sessionResponseTransformer`, `configOptionsTransformer`, `modeIdTransformer`, `providerModeWriter`, and `beforeModeWriter` to synthesize an `allow-all` mode backed by `setSessionMode("agent")` + `setSessionConfigOption("allow_all", "on")`.
  - `kimi-acp-agent.ts` (93 lines): passes `catalogModelResolver` that switches through each model in a probe session to read per-model `thought_level` options.
  - `kiro-acp-agent.ts` (99 lines): passes `extensionCommandsParser` for `_kiro.dev/commands/available`.
  - `trae-acp-agent.ts` (28 lines): sets `waitForInitialCommands: true` with a 10 s wait.
- **Session load/resume invariant**: `acp-agent.ts:1995-2035` warns never to omit `cwd` or `mcpServers` (even `[]`) on `session/load` or `unstable_resumeSession`, because agents reject missing fields with `-32602`.
- **Context window**: `handleUsageUpdate` (`acp-agent.ts:3578-3601`) forwards ACP `usage_update` (`used`, `size`) as Paseo's `usage_updated` snapshot, preserving turn usage from `PromptResponse.usage` (`:3603-3605`).
- **File edits**: `extractDiffContent` (`acp-agent.ts:4268-4275`) extracts standard ACP `type: "diff"` blocks (`oldText`, `newText`).
- **Permissions**: `requestPermission` (`acp-agent.ts:2857-2901`) auto-accepts when auto-accept is enabled and the request is not a chooser, otherwise emits `permission_requested` with the merged tool snapshot.
- **MCP**: `acpMcpServers` / `normalizeMcpServers` (`acp-agent.ts:3201-3203, 3910-3950`) converts Paseo's `stdio`, `http`, and `sse` MCP configs into ACP `McpServer` entries (converting header objects to `{ name, value }[]`), without gating HTTP on `mcpCapabilities.http`.

### `tiezbro/paseo-agy-acp` (community NDJSON proxy for Antigravity)

`paseo-agy-acp` wraps the standalone official `agy-acp-server` binary (pinned to 1.5.2, `ACP Connector/official-kernel/spawn.ts:6-24`, passing `--uid=` only on Linux `.par`) behind an NDJSON stdio proxy (`ACP Connector/official-kernel/proxy.ts`) so Paseo's `GenericACPAgentClient` can drive Antigravity:

- **Mode mapping**: `ACP Connector/official-kernel/mode-map.ts:4-74` translates legacy aliases (`accept-edits` -> `auto_edit`, `dangerously-skip-permissions` -> `yolo`), annotates `yolo` with `_meta["paseo.dev/unattended"]: true`, and deletes flat `models` so Paseo reads grouped `configOptions` (`:43-44`).
- **MCP header rewrite and protocol-version bridge**: `mcp-rewrite.ts:8-41` normalizes `headers` into `{ name, value }[]`, and `mcp-protocol-bridge.ts:8-33, 35-178` proxies HTTP/SSE MCP URLs through a local loopback server that downgrades Antigravity's `mcp-protocol-version: 2026-07-28` (both HTTP header and JSON-RPC `initialize` body) to `2025-11-25` so Paseo's MCP server accepts it.
- **Skills via local HTTP MCP**: `skill-mcp.ts:40-67` exposes workspace skills as a per-session read-only HTTP MCP server (`paseo_skills`) injected into `session/new` `mcpServers`.
- **Model catalog investigation (`docs/research/google-antigravity-acp-model-catalog-investigation.md`)**: inspected the earlier `agy_acp_server_20260818_01_RC01` Python PAR binary and found `model_selection.py:165-168` explicitly filtered `if not ccpa_id.startswith("gemini"): continue` regardless of `clientInfo`; later 1.x releases lifted that filter (by allowlist, then open to all clients in `1.5.1` per T3 Code above).
- **Verified MCP capability ledger (`docs/research/2026-11-19-official-capability-ledger.md:59-61`)**:
  - **C36 (stdio MCP)**: baseline ACP capability requiring no `mcpCapabilities` flag; verified working on Antigravity including across cold session resume.
  - **C37/C38 (HTTP/SSE MCP)**: relies on `mcpCapabilities.http`/`sse` (advertised by standalone `agy-acp-server` 1.5.2, bridged for protocol-version downgrade).

---

## 3. Outlore H3/H2 question: does `agy` accept stdio MCP servers?

**Direct live observation on `agy 1.5.16`** (2026-11-24, `AGY_CLI_DISABLE_AUTO_UPDATE=true agy acp --stdio` `initialize`):

- `agy 1.5.16` replies with `agentInfo: { name: "Antigravity ACP Server", version: "1.5.16" }` and **omits `mcpCapabilities` completely** (unlike the older standalone `agy_acp_server_1.1.1` / `1.5.2` binaries, which advertised `mcpCapabilities: { http: true, sse: true }`, seen in T3 Code's `packages/effect-acp/test/fixtures/antigravity-initialize.json:10-13` and `paseo-agy-acp`'s capability ledger `:24`).
- `agy 1.5.16` does advertise `loadSession: true`, `promptCapabilities: { image: true, audio: false, embeddedContext: true }`, `sessionCapabilities: { resume, close, load, list, additionalDirectories }`, `auth: { logout }`, and `_meta.antigravity: { tier: true, systemPrompt: { append: true } }`.

**How T3 Code and Paseo expose tools to Antigravity (and why Outlore's H3 HTTP-only check misses `agy 1.5.16`):**

- In ACP, **stdio MCP is the mandatory baseline transport** and carries no `mcpCapabilities` flag; `mcpCapabilities.http` and `mcpCapabilities.sse` only advertise optional transports.
- Both T3 Code (`AcpMcpStdioBridge.ts:12`, `AntigravityAdapterV2.ts:227-228`) and `paseo-agy-acp` (`docs/research/2026-11-19-official-capability-ledger.md:59`, C36 verified on cold resume) rely on **stdio MCP** working on Antigravity.
- T3 Code handles the split across all ACP harnesses with one mechanism: prefer `mcpCapabilities.acp` (in-process bridge) -> opt-in `mcpCapabilities.http` -> **stdio-to-HTTP MCP bridge** (`AcpMcpStdioBridge.ts`) forwarding NDJSON stdio to the host's existing HTTP MCP endpoint.
- For Outlore, adding a small stdio-to-HTTP MCP bridge targeting Outlore's existing `request.access.mcpUrl` as the fallback when `mcpCapabilities.http !== true` will give **Antigravity (`agy 1.5.16`) and every other stdio-only ACP harness** access to Outlore's thread tools (`open_thread`, `report_result`, `request_approval`, etc.) without waiting for upstream `agy` to advertise `mcpCapabilities.http`.
- Before enabling HTTP or stdio MCP on Antigravity in production, run a single live smoke test against `agy 1.5.16` to confirm (a) `agy 1.5.16` spawns the stdio bridge and calls an Outlore tool, and (b) if `agy` ever sends `mcp-protocol-version: 2026-07-28`, Outlore's HTTP MCP endpoint accepts or negotiates it cleanly.

---

## 4. Concrete design recommendations for Outlore's H2 unified ACP module

1. **One deep ACP protocol module with small dialect hooks (not subclasses or copies).**
   Follow T3 Code's `AcpAdapterV2Flavor` and Paseo's constructor-hook pattern: merge `packages/service/src/harness/vibe.ts` and `packages/service/src/harness/acpProviders.ts` (and later `opencode.ts`) into one Effect protocol module owning `initialize`, `session/new`, `session/load` or `session/resume`, lost-session fallback, `readAcpPrompt`, `session/request_permission`, `usage_update` (both context window `used`/`size` and turn usage), file edits, and MCP server wiring.
   Keep per-provider differences to a data profile plus a handful of optional hooks (e.g., `onSessionOpen`, `readTurnUsage`, `readFileEdits`, `sessionModeFor`, `clientInfoFor`, `mcpTransport`).

2. **Fix the H2 drift once for all ACP harnesses.**
   - **File edits**: generalize `acpFileEditsOf` in `fileEditEvents.ts` from `"opencode" | "vibe"` to all ACP harnesses using standard ACP `type: "diff"` blocks as the default, with dialect overrides for OpenCode metadata, Vibe `rawOutput`, and (if desired later) Antigravity's `TargetContent`/`ReplacementContent` snippet format (`AntigravityEditLocation.ts`).
   - **Context window**: parse `usage_update` `used` (and `size > 0`) in the single shared read loop, so every ACP harness reports context occupancy instead of only Vibe.
   - **Turn usage**: support both cumulative-delta (`PromptResponse.usage`, Vibe) and per-turn `usage_update` / `PromptResponse.usage` (with an optional `addsCachedReadToInput` dialect flag for Gemini/Antigravity, matching T3 Code's `geminiPromptUsage` in `adapter.ts:389-391`).
   - **Model-offered check**: keep `acpProviders.ts`'s check against offered `configOptions` in the shared module so Vibe gains it too.

3. **Add a stdio-to-HTTP MCP bridge fallback for H3/H2.**
   Keep H3's `mcpCapabilities.http === true` check (and consider making HTTP opt-in per profile if any ACP agent advertises `http: true` yet drops injected HTTP servers, as T3 Code found with `codex-acp 1.2.0` and `pi-acp`).
   When HTTP MCP is not used, fall back to a small stdio-to-HTTP MCP bridge entry pointing at `request.access.mcpUrl` so `agy 1.5.16` and other stdio-only ACP agents reach Outlore's thread tools instead of falling back to `noToolServerInstructions`.
   Verify stdio MCP live on `agy 1.5.16` during H2 implementation.

4. **Adopt the verified Antigravity protocol quirks in the Antigravity dialect/profile.**
   - **Keep `writeTextFile: false`** in `clientCapabilities.fs` (already Outlore's default in `vibeAccount.ts:25`), preserving native diff edits.
   - **Keep `"default"` session mode** (never send `yolo` or `auto_edit` to `agy`, which rejects them; Outlore already leaves sessions without `"ask"` in `"default"` and mediates every `session/request_permission`).
   - **Handle `interaction_*` permission requests** as owner questions rather than silent auto-approvals once Auto/FullAccess mediation applies to Antigravity.
   - **Prefer `session/resume` over `session/load`** when `agentCapabilities.sessionCapabilities.resume` is advertised, avoiding replayed tool calls on resume (falling back to `session/load`, then `session/new` + handover notes).
   - **Use `_meta.antigravity.systemPrompt.append`** when advertised in `initialize`, or keep prepending starting context on the first prompt if a uniform path is preferred.
   - **Multi-account Antigravity later**: T3 Code's `antigravityAuthSupport.ts:230-234` explains why Outlore's `antigravityProvider.ts` saw keychain vs file-storage drift on CLI 1.5: `agy 1.5` ignores `AGY_ACP_FORCE_FILE_STORAGE=1` unless `SSH_CONNECTION` is set (just as `WSL_DISTRO_NAME` previously forced file storage).
     Any future added-account support for Antigravity must set the exact same storage-selection env on both sign-in (`agy acp --login`) and launch, plus pass the account's folder to both `GEMINI_HOME` and `--gemini-dir`.
   - **`clientInfo.name` is not needed for `agy >= 1.5.1`**: `agy 1.5.1+` exposes the full account model catalog to any client name (`AntigravityAcpSupport.ts:74-75, 106-112`), so Outlore can keep `clientInfo: { name: "outlore", ... }` on `>= 1.5.1`.

5. **Replace the six copied test fakes with one configurable ACP fake.**
   Parameterize a single fake ACP server script by capabilities (`mcpCapabilities`, `promptCapabilities`, `sessionCapabilities.resume`), offered `modes`/`configOptions`, `usage_update` shape, `diff` blocks, and auth error code (`-32000`), mirroring how one protocol module replaces the duplicated loops.
