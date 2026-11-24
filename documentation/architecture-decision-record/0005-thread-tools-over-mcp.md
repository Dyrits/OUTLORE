# Thread tools are served over MCP

The local service gives threads their tools (`open_thread`, `find_missions`, `suggest_mission`, `send_thread_message`, `interrupt_thread`, `request_approval`, journal and intel tools, `report_result`) through one local MCP server, because Claude Code, Codex, and ACP harnesses all support MCP.
The service enforces each thread's authority over itself and its descendants.
`find_missions` can read other missions' titles, journal summaries, and states; Continue in routes a message to the mission the user selects.
CHG-0009 added messaging to threads and missions referenced with `@`, and let Control open, message, and act on any mission at the user's request.

CHG-0132 extends Control's authority to the [Guildmaster role](../capabilities/mission-coordination/specifications.md#what-guildmaster-does-itself).
The service must distinguish Guildmaster's app-wide authority from ordinary thread authority and enforce each operation's rules, approvals, and budgets.
The additional tools still need design and implementation.

## 2026-11-24: Stdio-to-HTTP MCP bridge fallback for ACP harnesses

ACP mandates stdio MCP support while `mcpCapabilities.http` is optional, so an ACP agent that omits `mcpCapabilities.http` (such as Google Antigravity CLI `agy 1.5.16`) still reaches the thread's local HTTP MCP server through `packages/service/src/harness/acpMcpBridge.mjs` (shipped as an unpacked desktop resource because the packaged Electron binary disables `RunAsNode`).
A live smoke check against `agy 1.5.16` on 2026-11-24 confirmed that `agy` spawns the stdio bridge on `session/new`, negotiates `initialize` and `tools/list`, invokes `tools/call` over SSE, and completes the turn (`end_turn`).

## Note, 2026-11-24: which ACP harnesses get the tool server

Hermes, Cursor, Copilot, Cline, Devin, and Gemini (Antigravity) start their sessions through the generic ACP adapter (`acpProviders.ts`).
That adapter passes the thread's tool server (`outlore`, over HTTP) in `session/new` and `session/load` only when the agent's `initialize` answer advertises `agentCapabilities.mcpCapabilities.http: true`, and passes none otherwise.
A session given none is told so after the starting context (`noToolServerInstructions`): `request_approval`, `report_result`, and the other thread tools are unavailable, consequential actions go through the harness's own permission requests, and the result is the final reply.
Checked on this computer: Antigravity 1.5.16 advertises no `mcpCapabilities`, so it gets no tool server and its errands cannot call `report_result`; Hermes, Cursor, Copilot, Cline, and Devin were not installed and are unchecked.
