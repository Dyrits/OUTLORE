# Code Mode, code-first backends, autonomy, and connectors: primary-source notes

Researched 2026-11-16 for the owner. Research only: no Outlore code was changed, nothing was installed, built or run, no account was created, nothing was paid. Part 1 answers "three ways to combine model-written code with tools, and what it means for running agents with few prompts". Part 2 follows the owner's decision that Code Mode becomes a toggle and that connectors (Composio, Apple apps) come next.

## Method

- **Outlore**: the working tree at `0a7b8c5fc9b7cb640d421ef8eb88e404b835e985` (`main`).
- **External repositories**: shallow clones read in a scratch folder outside the repository, never run. Commits: Prime Agent `ad1613303dff0c642b9a95706678559356086107` (2026-11-13, workspace version 0.10.3, tag v0.9.8); Unharnessed `fe2cf2815f78463464b91c598fc0c31c0af98f4c` (2026-11-15, crates 0.9.8, VS Code extension 0.0.4); `cloudflare/agents` `9b73399c7cee9550c19146b7f76a735a10700ada` (2026-11-13, `@cloudflare/codemode` 0.5.6); `ComposioHQ/composio` `f19794cb8f5b844fa310d1167558fd31c62b4116` (2026-11-16); `nightly-labs/openbot` `dfb9d8147cb6587718cc8ef2da4ff42a829c40d4` (2026-11-15); Apple MCP servers, see 2.3.
- **Vendor pages** fetched 2026-11-16 through a summarizing fetch tool: quoted phrases are as that tool returned them; "not stated" means "not in the part returned".
- **Verified** = read in the source named. **Inferred** = my conclusion from verified facts. **Not checked** is listed at the end of each part.

## Part 1. Code-first agents and the autonomy priority

### 1.1 What Outlore already does (verified)

- **Sandbox-first autonomy exists.** Claude Code runs in its own sandbox with `autoAllowBashIfSandboxed` and `failIfUnavailable` (`packages/service/src/harness/claudeArgs.ts`). Codex runs `approvalPolicy: "on-request"` with `sandbox: "workspace-write"` (`codex.ts:62-63`). OpenCode runs inside Outlore's own Seatbelt or bubblewrap wrapper (`openCodeSandbox.ts`). An action inside an active sandbox runs unasked (`policy/containment.ts`, `needsOf`).
- **An unrestricted opt-in exists for commands.** "Let threads run commands outside the sandbox without asking" (CHG-0295; `capabilities/action-approval/specifications.md`), off by default, owner-only. It still asks for file edits outside the folder, widening the sandbox, a harness with no sandbox, and what a thread judges consequential. The spec records why: about 120 escapes asked in three days, 6 answered by a saved permission.
- **The sandbox contains files and processes, not data**: its network is open in practice (Claude Code's allowlist is broad and Outlore answers its "new host" ask).
- **Seams**: `HarnessAdapter` has `runTurn`, `interrupt`, `steer`, `readPlanLimits` and optional `containmentOf` (`core/execution.ts:215`); events are `Reply`, `Draft`, `ToolCall`, `Delivered`, `Notice`; budgets are checked at turn boundaries (`holdIfReached`, `work/budgets.ts:131`). Each thread has `/mcp/<token>` on loopback serving 24 thread tools (`work/mcp.ts`, `work/threadTools.ts`).
- **Claude Code sees only Outlore's MCP server** (`--strict-mcp-config`, `claudeArgs.ts`). Codex declines any other server's elicitation (`codex.ts:216`). Outlore-managed external MCP servers are "not built" (`tool-and-skill-loading` specification).

### 1.2 Removing prompts is not removing isolation

| Option | Interactive prompts | What generated code can reach |
| --- | --- | --- |
| Outlore today, default | almost none inside the sandbox | files and processes contained; network open; readable credentials readable |
| Outlore, "outside the sandbox" setting | none for commands | everything the owner can reach |
| Codex `--dangerously-bypass-approvals-and-sandbox` (flag read in local `codex --help`) | none | everything |
| Prime or Unharnessed as shipped | none, by design | everything |
| Either, inside a Seatbelt or bubblewrap wrapper | none | what the profile allows |
| Container or VM | none | only what is mounted and passed; needs Docker or a VM, which `requirements.md` "Nothing else to install" rules out as a requirement |
| Scoped, short-lived credentials | none | the only control that holds when the network is open; Outlore issues none yet |
| Code Mode isolate (Cloudflare design) | per connector, opt-in | no files, no environment, fetch off by default; only the connectors it is given |

### 1.3 Prime Agent (`PrimeIntellect-ai/prime-agent`)

- MIT, 5,321 commits, history back to Mario Zechner's pi-mono (2025-08-09). Rust workspace plus a Python kernel (`prime-agent-runtime`). The README does not document RPC or ACP; the source does.
- **JSONL RPC** (`crates/pa-daemon/src/rpc/commands.rs`): `prompt`, `steer`, `follow_up`, `abort`, `abort_bash`, `new_session`, `get_state`, `set_model`, `cycle_model`, `set_thinking_level`, `compact`, `get_session_stats` (tokens input, output, cacheRead and cost, `rpc/session_commands.rs:468`). **ACP** in `crates/pa-daemon/src/acp/`.
- **No pre-execution permission callback is exposed** over RPC or ACP: no `session/request_permission` anywhere, tool events are notifications. Correction to the earlier review: a `before_tool_call` hook exists inside the agent loop (`pa-agent/src/agent_loop/tool_call.rs:76`), but the only user is the side-question path that blocks tools; nothing reaches it from the wire.
- README: "executes model-generated Python and project commands with your user permissions"; its worker and kernel "are **not** a security sandbox"; "Run untrusted code or instructions in an external sandbox".
- Stop: `abort` aborts the agent loop; a background `bash()` handle survives cancellation by design (`bash.py`), and orphans are journaled and reaped (`kernel/orphan_journal.rs`, `stop_cleanup.rs`). Parity with Outlore's process-tree kill was **not tested**.

### 1.4 Unharnessed (`unharnessed-agent/Unharnessed`)

- MIT, 4,980 commits; its history contains Prime's and pi-mono's; LICENSE credits Unharnessed, Prime Intellect Ltd and Mario Zechner. It is a derivative of Prime Agent with sub-agents, memory and the daemon removed.
- One tool, `ipython`, a persistent Python kernel; `bash()` is async and returns a handle; MCP servers are reached from Python through an `mcp` object, not as native tools (README: "MCP, inside the kernel"). The README argues against Code Mode ("the model's script can only call the tools the harness already built").
- Surfaces: CLI `--mode json`, ACP over stdio (`--mode acp`; `session/new`, `session/prompt`, `session/cancel`, `session/close`, `_unharnessed/session/steer`). No RPC mode (`uh-cli/src/mode.rs`).
- "Unharnessed never asks before running a command... the kernel is **not** a sandbox. Use it in a container, a VM or a disposable checkout." No permission request or hook in the Rust source (searched).
- Usage: the prompt answer is only a stop reason; usage arrives as `_meta.unharnessed.usage` (context tokens, cumulative dollar cost, cache figures), with no per-turn input/output split (`uh-daemon/src/acp/meta.rs`). Per-turn tokens would need the session JSONL or the `--mode json` stream: **not tested**.
- Account folder override exists (`UNHARNESSED_CODING_AGENT_DIR`; Prime: `PRIME_AGENT_CODING_AGENT_DIR`), which fits Outlore's `configVariable`.
- Self-reported benchmark (`unharnessed.dev/run`): Terminal-Bench 4.0, 47 of 66 (71.2%), $12.19 and 91 turns per task against $14.30 and 98 for Claude Code on the same model. No date, methodology, variance or Claude Code pass rate; treat as a hypothesis.
- **Provider-terms conflict.** Both agents implement subscription sign-ins themselves (Prime `pa-ai/src/oauth/anthropic.rs`, `pa-cli/src/subscription_login.rs`); Unharnessed's `uh-ai/src/client_versions.rs` states the Claude Code version it "claims". Anthropic's [legal and compliance page](https://code.claude.com/docs/en/legal-and-compliance) says OAuth is "intended exclusively for... ordinary use of Claude Code and other native Anthropic applications", developers "should use API key authentication", and a sign-in "must complete through Anthropic's own flow". Against `requirements.md` "Comply with provider terms", a backend of this kind should take API keys or local models only. Other providers' subscription terms were **not checked**.

### 1.5 Code Mode (Cloudflare, Anthropic)

- Sources: [Cloudflare blog](https://blog.cloudflare.com/code-mode-mcp/), [Cloudflare docs](https://developers.cloudflare.com/agents/api-reference/codemode/), [Anthropic engineering post](https://www.anthropic.com/engineering/code-execution-with-mcp), and `packages/codemode` and `docs/codemode/` in `cloudflare/agents`.
- A pattern, not a protocol: the model writes code that calls connectors; data stays in the executor. `@cloudflare/codemode` 0.5.6, MIT, **"Experimental — may have breaking changes"** (README).
- `Executor` is an interface (`executor-types.ts`). Shipped executors: `DynamicWorkerExecutor` (needs a Cloudflare Worker Loader binding, default timeout 60 s, `globalOutbound: null` blocks the network) and an iframe executor. The runtime keeps its durable log, pending approvals and snippets in a Durable Object's SQLite (`docs/codemode/runtime.md`). A Node or local executor would have to be written; nothing in the package provides one.
- `codeMcpServer({ server, executor })` wraps an existing MCP server behind one `code` tool (`src/mcp.ts:125`).
- **Per-connector approval**: `requiresApproval: true` pauses the run, records a pending action, and after `approve()` the script replays from a durable log, so completed calls are not repeated; `revert` enables `rollback()` (`docs/codemode/approvals.md`, `connectors.md`). This is a structural policy (method name and arguments), which a command string never offers.
- Claims, all vendor-reported and not checked: about 1,000 tokens against 1.17 million for Cloudflare's own API; 150,000 down to 2,000 tokens in Anthropic's example. Part of the definitions cost is already handled by harness-side deferred tool loading; Code Mode's distinct gain is keeping intermediate results out of the model's context.
- Anthropic: "Running agent-generated code requires a secure execution environment with appropriate sandboxing... These infrastructure requirements add operational overhead and security considerations that direct tool calls avoid."
- It does not govern a harness's own Bash, file or edit tools.

### 1.6 Verdicts and order (from Part 1)

1. Keep and tune the existing sandbox and the "outside the sandbox" setting. Look at the Permissions history for what still interrupts (file edits outside the folder, `request_approval`, widening).
2. Prototype Unharnessed as an opt-in ACP backend: wrapped like OpenCode, API keys only, flagged experimental. Open: per-turn usage, stop reaching background commands, what to do with wake-up turns, Windows (no wrapper there today).
3. Code Mode: now a toggle of the connector gateway, see Part 2.
4. Drop Prime as a backend for now (larger surface that duplicates Outlore's own).

Gains from the code-first interface (fewer round trips, tokens on bulk data) and gains from the autonomy setting (fewer interruptions) are independent. Both are hypotheses to test except the mechanism of the sandbox and the setting.

### 1.7 Not checked (Part 1)

A live run of any of the three projects; stop behaviour; a Seatbelt profile around Unharnessed; every token, latency and cost claim; provider terms other than Anthropic's; whether a local Code Mode executor is practical.

## Part 2. Connectors: Composio, Apple apps, and how OpenBot does it

### 2.1 Composio

- **What it is** (`ComposioHQ/composio` README at `f19794c`): an SDK monorepo, MIT (`LICENSE`, "Copyright (c) 2025 Sampark Inc."), TypeScript and Python SDKs plus a CLI. Claims "1000+" toolkits (another line says 1,500+) with authentication, tool search and a sandboxed workbench.
- **The SDK is a client of a hosted service.** It needs `COMPOSIO_API_KEY`; `baseURL` defaults to `https://backend.composio.dev` (`ts/packages/core/src/composio.ts:108`). Sessions expose a hosted MCP endpoint (`session.mcp.url`). I found no local execution mode.
- **Credentials**: "Composio stores each connected account's credentials encrypted at rest and refreshes OAuth tokens", and tokens are added to provider requests server-side (docs.composio.dev/docs/authentication). "In the default Composio Cloud deployment, 'Composio holds the encrypted credentials.'" Private VPC, self-hosted and customer-managed-key deployments "change that boundary".
- **Self-hosting**: a Helm chart for an on-prem deployment is referenced in the repository's support knowledge base (`docs/kb/source/platform/self-hosted-helm/public.md`, service `apollo`). Its availability, plan and terms are not stated in anything I read, and the server source is not in the SDK repository as far as I looked. **Not verified.**
- **Pricing** (composio.dev/pricing.md, fetched 2026-11-16): Hobby $0, "100,000 tool calls/mo (up to 20,000 on Composio-managed apps)", 50,000 trigger events, 3 team members; Pro $29/month; Enterprise custom. Secondary sources disagree on these numbers; the vendor page is taken. The page was longer than the part read; the rest was not read.
- **Fit with Outlore's requirements** (inferred): the SDK's licence is fine. The service holds every connected account's tokens and sees every tool result, so it is a third party outside "Local data" unless the owner opts in knowingly; it needs an account at Composio, which Outlore's other connectors do not; free-tier limits decide "Nearly free to run" per user, not for the project. Whether a stored Composio API key counts under "Comply with provider terms" needs a decision: that requirement names *provider* sign-ins and session tokens, not connector keys.

### 2.2 How OpenBot does it (`nightly-labs/openbot`, PolyForm Noncommercial 1.0.0: ideas only, as `requirements.md` already says)

- **A connector is a catalog entry plus an MCP server.** `marketplace/plugin-catalog/plugins/<slug>/plugin.json` gives name, description, `apps[]`, each with `server` (`transport: stdio` with `command` and `args`, or `http` with `url`) and `auth` kinds `link`, `key` or `local` (`docs/architecture/integrations.md`).
- **Composio** is such an entry (`plugins/composio/plugin.json`, v1.2.0): an `http` server at `https://connect.composio.dev/mcp`, signed in with a Composio account (link) or an API key sent in the `x-consumer-api-key` header. No Composio-specific code was found beyond the catalog and a webhook note.
- **Apple apps** is such an entry (`plugins/apple-apps/plugin.json`, v1.1.1): `stdio`, `npx -y mcp-icloud@2.1.4` (version pinned), plus `macAutomation: [calendar, contacts, mail, notes, reminders, messages, safari]` so the app can ask macOS for Automation access up front, one prompt per app. The description says it "needs no account and no key", "controls the apps through AppleScript, on this computer", agents "can send email and iMessages, and change or delete events, contacts and reminders, so review each write before you approve it", and "What the tools read, such as email text, goes to the model provider of the agent."
- **Autonomy model**: "Agents run with `danger-full-access` and `approvalPolicy: never`... without per-action confirmations after the explicit first-launch consent" (README warning; `SECURITY.md`: "local-first but not sandboxed from the host on behalf of the user"). Each agent has an Access setting, default "full" (`DEFAULT_AGENT_ACCESS`, `packages/contracts/src/ipc-agents.ts:40`), with a workspace-only mode that uses Codex's own sandbox and a Claude flag (`src/backend/agent/workspace-sandbox.ts`).
- **MCP tool consent** has "Ask first" and "Full access" with "Always allow" and a restart (`README` test `test:mcp-tool-consent`). Access to an MCP server is per agent and per member level (`none`, `use`, `manage`); the document states "Not covered: Access for each tool" (`integrations.md`, "Who gets each MCP server").
- **OAuth for remote MCP servers** is handled in the host (loopback callback on port 28417, refresh without a browser, revocation on removal); the host keeps every grant.

### 2.3 Apple apps: what exists

No first-party Apple MCP server was found. Reports from September 2025 describe MCP-related code in the macOS and iOS 26.1 betas tied to App Intents; I found no Apple documentation confirming a shipped feature (secondary reports only; **not checked** against Apple's developer documentation).

Community servers, all MIT, all read at the clone dates:

| Server | How it works | Notes |
| --- | --- | --- |
| `MrGo2/icloud-mcp` 2.2.2 (commit 2026-11-15) | AppleScript locally, or IMAP/SMTP, CalDAV and CardDAV in a cloud mode; 41 tools over Mail, Calendar, Contacts, Reminders, Notes, Messages, Safari | Tool annotations declared: read-only tools marked read-only; nine carry `destructiveHint` (four deletions, `send-email`, `send-message`, `react-message`, two in-place updates); reading Messages needs the `imsg` CLI and Full Disk Access. This is what OpenBot ships, pinned at 2.1.4 |
| `krmj22/macos-mcp` 4.1.0 (commit 2026-08-20) | EventKit through a Swift binary for Reminders and Calendar, JXA for Notes and Contacts, SQLite reads for Mail and Messages; 8 tools | README records why each bridge was chosen (EventKit does not reach Notes, Mail, Messages or Contacts; JXA reads of Messages return nothing on Sonoma and later; JXA reads of Mail time out at 60 s on a real inbox) |
| `JonathanRReed/Apple-MCPs` (commit 2026-11-14) | Python, `uvx apple-tools-mcp`; per-app safety profiles such as `safe_readonly`, `safe_manage`, `full_access`; file roots restricted by environment variables | Mail defaults to `full_access` in the Claude Desktop bundles |
| `heznpc/airmcp` 2.16.7 (commit 2026-11-14) | Swift bridge plus AppleScript; 293 tools across 32 modules; previews destructive calls and offers per-call approval and an audit chain | Very large tool surface for a model to carry |
| `supermemoryai/apple-mcp` 1.0.0 | Messages, Mail, Notes, Calendar, Maps, Reminders, Contacts | Last commit 2025-08-10; not checked whether archived |

Common facts: macOS only; stdio; the OS permissions (Automation, Full Disk Access, Calendars, Contacts) attach to the process that launches the server, not to the model.

### 2.4 Where connectors would sit in Outlore (inferred; to settle in a specification before code)

- **The tool-and-skill-loading specification already agrees** that Outlore manages MCP servers at global and workspace scope and gives the same servers to every harness. Nothing is built; the Workshop's MCP page was withdrawn for now (glossary, Workshop).
- **Two ways to deliver a server to a harness.** (a) Pass each server in the harness's own configuration: three formats; the harness's own prompts then decide, and Outlore's Codex adapter currently declines any server but its own (`codex.ts:216`). (b) A connector gateway inside the service: Outlore spawns or connects each server itself and serves its tools through the per-thread endpoint it already has. The recommendation is (b): one policy point, one approval path (`askOwner`), the same behaviour on Claude Code, Codex and OpenCode, and the OS permissions attach to Outlore's host process instead of a harness's sandbox, which blocks Apple Events (this environment's sandbox does: opening apps and scripting applications are denied). That the grant attaches to the host process, and what a host kept running without the desktop app can do about a permission prompt, are **not tested**.
- **The Code Mode toggle fits the gateway.** The gateway can expose connectors as native tools, or as `search` and `execute` over generated code, per thread or per connector. It still needs an executor: the options are a WebAssembly JavaScript interpreter, an isolate in a subprocess with permissions off, or a Worker on the owner's own Cloudflare account (the relay already lives there, ADR 0016). None was evaluated here.
- **Policy by structure**: read-only calls run unasked; destructive, send and delete calls ask or follow a standing permission on the exact tool. MCP annotations (`readOnlyHint`, `destructiveHint`, `openWorldHint`) are self-declared by the server; an unannotated or untrusted server should default to asking.
- **Composio costs nothing extra** once an `http` MCP server with a header key is supported: it is one catalog entry, as in OpenBot. What it needs is a clear notice that its service holds the tokens and sees results, and an opt-in.
- **Apple apps first-party feel**: a pinned version of one community server in the catalog, or Outlore's own small server over EventKit later. The choice between `mcp-icloud` (broad, AppleScript, annotations) and `macos-mcp` (narrower, EventKit and SQLite, more robust per its own notes) was not tested against a real Mac.

### 2.5 Open decisions for the owner

1. Where connector secrets (API keys, tokens) live: the operating system's keychain is the natural place; "Comply with provider terms" and "Local data" would need a sentence saying connector keys are the owner's, stored locally, and never relayed.
2. Whether Composio is in the first slice (cheap once generic `http` MCP with a header key exists) or later.
3. Which Apple server to pin first, and whether Outlore ships its own.
4. Whether read-only connector tools run unasked by default (recommended), with writes asking.
5. How an Apple connector behaves on a host that runs headless or from a paired phone.

### 2.6 Not checked (Part 2)

A real Apple Automation grant for Outlore's host process; any connector running through Outlore; Composio's self-hosting terms, or any of its latency or reliability; every tool count or safety claim of the Apple servers beyond their READMEs; Apple's own MCP support; the rest of Composio's pricing page; OpenBot's runtime behaviour (source and documents only).

## Addendum, 2026-11-16: how OpenBot asks macOS for Apple access, and what it does remotely

Read in `nightly-labs/openbot` at `dfb9d8147cb6587718cc8ef2da4ff42a829c40d4`: `src/main/mac-automation.ts`, `docs/architecture/integrations.md` ("Add an application"), `marketplace/plugin-catalog/README.md`, `src/renderer/src/features/settings/marketplace-controller.ts:1409`.

- A catalog app lists the Apple apps it drives in `macAutomation`. On the Mac that runs the server, the listing page shows a switch (on by default) that asks macOS for each app right after the install, and an "Ask for access" button later. OpenBot runs `osascript` to send one harmless Apple Event (`count windows`) to each app, so macOS shows its Automation prompt then and not during an agent's task; an app the request opened is quit again. A refused app gives error `-1743` and macOS does not ask again; the user fixes it in System Settings (Privacy & Security, Automation) or with `tccutil reset AppleEvents`.
- **Remote and headless**: the request is offered only by the desktop app on the machine that runs the server (`props.macOS && !props.pluginHostName`), "The mobile copy leaves the field out", and for a joined server the listing is not asked from the client. I found no handling of a headless host, so what happens there is **not known** from OpenBot's source.
- The `local` auth kind is described as "steps that the user does on the computer that runs the server".
