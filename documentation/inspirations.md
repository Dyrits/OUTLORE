# Inspirations

Products Outlore follows for ideas. For each: what it does well, what Outlore took or may take, and what to check on at the next review. Ideas are written independently and follow [Respect upstream licenses](requirements.md); code is reused only where a decision record allows it.

Review this list when starting a capability, and every few weeks: read each product's changelog, releases, or documentation, and add what is new below with its date. Record a taken idea in the capability's specifications and the changelog; put a candidate in the [backlog](backlog.md).

## Agent workspaces and harnesses

### Keeping a secret out of a sandboxed agent's reach (2026-11-23, from the notes already in this folder; no new primary reading)

- **What the others do**: none of the notes here records a check at start that a harness's own sandbox cannot read the folder holding its secrets; these products avoid the question by where the secret lives. OpenBot (nightly-labs) keeps its vault in the backend process and runs agent-written scripts in a QuickJS WebAssembly sandbox rather than `node:vm` because that process holds the vault ([openbot-browser](research/openbot-browser-2026-11-18.md)), and says plainly that the agents themselves run with full access. intentic injects secrets only into the turns that may use them and never writes them to disk (its site, above). OpenFuse's terminal runs in a container with no host-directory mounts or credentials (above).
- **Taken**: nothing new in design. Outlore's rule (ADR 0022: no secret stored unless the denial is verified, the service the only reader) stays; the check now runs by itself at start, with no owner step (CHG-0657). Per-turn injection and a container with no mounts remain the stronger alternatives if the harnesses' sandboxes are ever judged not enough.
- **Check on**: whether any of them documents how it tells a sandbox that cannot start from one that does not protect.

### OpenBot

- **Good ideas**: an agent panel per agent; installing and updating each harness's command-line tool from its official package, checked against the published hash; how permissions are asked of casual users.
- **Taken**: harness installs and updates ([architecture](architecture.md)); the thread panel idea ([backlog](backlog.md)); built-in safe git (CHG-0032 in the [changelog](changelog/0.1.0-Prototype.md)); (2026-11-07) the window's look: a sidebar on a grey frame beside a raised panel, a neutral palette with one blue accent, tinted state pills, and a composer with its pickers inside (CHG-0056).
- **Attachments** (2026-11-10, from its source `nightly-labs/openbot`): a file added to a message is first written to a managed drafts folder; sending moves it to a transfers folder with a manifest (name, type, size, sha256), and the message carries cards that survive the file's deletion ("file not found"); limits of 10 files, 100 MB each, 250 MB in all; Codex-style `localImage` items turned into base64 `image` blocks for ACP; Claude Code receives only a text list of local files; image or plain file is told by extension, so HEIC and TIFF are never sent as images. Taken: upload first then reference, and cards that outlive the file (CHG-0102).
- **Multiplayer** (2026-11-14, from its source and docs at commit `b51a1aa`, release 0.70.0; nothing copied; full notes with citations in [research/openbot-multiplayer.md](research/openbot-multiplayer.md)): people share a host, not only agents. Accounts use one-time email codes; memberships, invitations and logical sessions live on Cloudflare Workers and D1, and everything else stays on the host. Roles are owner, admin, and member, plus host-side custom roles that give each member a level per agent (none, view, chat, manage). Invitations are single-use or permanent links, revoked when their creating admin loses authority. A client gets a short signed ticket from the account service, connects over WebRTC (directly or through the project's coturn relay) with a handshake that binds the ticket, a client key, a pinned host key and the transport fingerprints; Signal relays only setup messages, and Cloudflare never carries chats, files, or commands. A channel chat is shared by every member who can see it, but its "task owner" is an agent, not a person: any member can send, stop, resume, reassign (to another agent) or cancel, commands to one channel are applied one at a time, and only archive, restore, delete and clearing history need owner or admin. Delegation is agent to agent. Approvals are first answer wins, with a conflict answer for the other client, and dangerous actions are for owner and admin only. A member's turn runs on the host with the host's providers and the agent's own access; a role only decides which agents a member sees and can talk to. Removal ends the member's sessions and makes every connected member reconnect; I found no cancellation of the removed member's queued or running turns. Current Team API protocol is 9 (versions 4 and 8 are only the minimums for OpenCode and Hermes agents); the README's "WebRTC protocol v3" could not be matched to the code. Taken: none yet. Compare with the multiplayer items in the [backlog](backlog.md): its person-authored-request rule for powerful channel tools bears on telling a guest's request from untrusted input, its role-changes-close-sessions rule on downgrading a guest, and its direct-then-relay transport on how guests reach a host.
- **Browser** (2026-11-18, from its source and docs at commit `67d0a82`, release 0.73.0; nothing copied; full notes with citations in [research/openbot-browser-2026-11-18.md](research/openbot-browser-2026-11-18.md)): agents drive the Chromium inside its own Electron app, tab by tab, through the built-in CDP debugger, not Playwright or a separate browser; a VPS runs the whole app under a virtual display (or the whole host in a Docker image), so no browser is downloaded. The agent reads a bounded accessibility-tree snapshot with short element refs, plus separate screenshots, and can run a sandboxed script of many steps in one call; tools reach each provider through its own tool channel, not MCP over a network. The default profile is one persistent profile shared by every agent (own or named profiles and per-profile proxies are optional); there is no per-site prompt and no address filter that I found, only a first-fill approval per card and page. "User control" is one map from tab to holder: while a person holds a tab the agent's calls wait, then get a fixed "the page may have changed" answer; holds end with the session, a disabled or removed member, and are refused while a secret is entered. Phones watch a CDP screencast as JPEG frames on a socket inside the WebRTC link and send input as fractions of the frame. Taken: none yet. Compare with the computer-use entry in the [backlog](backlog.md) and [research/computer-use-alternatives.md](research/computer-use-alternatives.md).
- **Sandbox** (2026-11-23, from its source at `a31e9a3`; notes in [research/sandbox-handling-2026-11-23.md](research/sandbox-handling-2026-11-23.md)): no sandbox by default (Full access); only "Workspace only" uses Codex's `workspace-write` or Claude's sandbox with `failIfUnavailable: true`, and it confines writes, not reads. No probe at start. When the sandbox cannot start it fails closed with a plain message and another level to choose ("Claude cannot use a sandbox on this computer ... Choose Full access or another provider"); a Codex sandbox failure is recognised from a failed command's output, after the fact. On Ubuntu 26.04 its installer adds an AppArmor rule so the sandbox can start. It does not hide the Vault folder from an agent; its Docker doc says plainly that agents of one container can read each other's key files. Taken: none yet; the plain fail-closed wording and the host fix are candidates.
- **Update** (2026-11-27, from `v0.80.0` at `206587a2`; [research/paseo-t3code-openbot-nightly-labs-2026-11-27.md](research/paseo-t3code-openbot-nightly-labs-2026-11-27.md)):
  Team API moved to protocol 10 (frozen v9 baseline plus delta `capabilities` and `absent`, `78ad15d1`), and direct agent-to-agent delegation now confines roles by propagating `requesterIds` across `send_message`, `start_task`, and interrupts (`c57e4cb2`, though `removeMember` still does not cancel running or queued turns and `WebRTC protocol v3` is no longer in `README.md` or `docs/`).
  Added prompt-cache pre-expiry compaction for idle 200K+ Claude/Pi chats (`f8624e13`), an account-pool **Spread** strategy (`f47ec1b6`) with graceful in-use account removal, parallel tasks per agent (`740efbb4`), automatic finish-check continuation (up to 3x), quiet-ending routines (`routine_no_update`), typed workflow **Answer fields** with zero-cost deterministic **Check** conditions and `openbot.workflow` export/import, Mem0 integration with per-agent memory toggle and on-demand search, whole-word Vault redaction with instant un-redaction on delete, a Chrome extension sharing open Chrome tabs plus a detached browser window, Apple Watch direct E2EE over Signal, a latency-measured Signal server picker, and privacy-safe STUN/TURN failure logging.
  Taken: none yet; prompt-cache pre-expiry compaction, account-pool Spread, deterministic workflow checks, whole-word Vault redaction, and privacy-safe ICE logging are candidates.
- **License**: PolyForm Noncommercial 1.0.0. Ideas only, no code ([0001](architecture-decision-record/0001-new-codebase-not-a-fork.md)).
- **Check on**: whether `removeMember` starts cancelling running/queued turns, whether `send_to_channel`/`read_agent` gain `requesterIds` checks, and how its Mem0 and typed workflow features mature.

### MausBot

- **Good ideas**: runtime event and driver contracts, an ACP client and vendor adapters, Claude Code and Codex drivers, a delegation-tree state machine, process and recovery helpers.
- **Taken**: these modules may be cherry-picked under Apache 2.0 with their notices ([0001](architecture-decision-record/0001-new-codebase-not-a-fork.md)).
- **Attachments** (2026-11-10, from `milind-soni/OpenMausBot`): paste, drop, and a picker; Electron's native `clipboard.readImage()` keeps the Paste item enabled for images; uploaded over HTTP, the message carries `<attached-image path>` tags; Claude Code gets a base64 block, Codex an `image` item with a data URL (its box could not see paths), ACP an `image` block only when `promptCapabilities.image` is true, with a clear error otherwise; 10 MB per image, 10 per turn.
- **Sandbox** (2026-11-23, from its source at `3aec210`; [research/sandbox-handling-2026-11-23.md](research/sandbox-handling-2026-11-23.md)): no sandbox for the agent CLIs, only a permission broker (consent, not isolation); a Full access bot "can read like any of their files". `scripts/verify-codex-sandbox.mjs` is a developer check that the sandbox policy sent equals the one Codex resolved, not a start-time kernel test. Its container gets a fixed hardened capability set, checked at start. Secrets are kept from the model, not from the disk: one-use in-memory references, or owner-only files that sync and upload skip. Taken: none; the "reference, not file" secret handling is a candidate.
- **Update** (2026-11-27, from `v0.1.184` at `f07ef142`; [research/paseo-t3code-openbot-nightly-labs-2026-11-27.md](research/paseo-t3code-openbot-nightly-labs-2026-11-27.md)):
  Verified on macOS that Antigravity CLI 1.5.16 ignores `AGY_ACP_FORCE_FILE_STORAGE=1` and `SSH_CONNECTION` when a keychain is open and requires `AGY_CLI_FORCE_FILE_TOKEN_STORAGE=1` alongside `SSH_CONNECTION` (`7dd86877`), and added a ~55 KB Antigravity session tool-list size budgeter (`09a4d73c`, `b2e66200`) plus quota stderr fallback (`a3e4f3c8`).
  Added Codex multi-account device-code auth, **Skill Burger** (recording real single-bot and team runs into editable, replayable workflow skills with symlink-escape blocking), per-conversation memory, a live active hand-off bar with per-handoff Stop and auto-archiving one-off hand-off threads, quiet `👎` (read on next turn) vs `👍`, faded Tab-complete suggested replies, unified `Settings → Devices` with one-switch Tailscale and lock-screen-private push alerts (bot name only), a template publish privacy scrubber, and standalone Local apps from bot pages.
  Taken: none yet; `AGY_CLI_FORCE_FILE_TOKEN_STORAGE=1` directly unblocks Outlore's Antigravity multi-account batch 2, and the 55 KB tool-list budgeter, active-errands Stop strip, Skill Burger, and lock-screen-private push alerts are candidates.
- **License**: Apache 2.0, except its `enterprise/` folder, which is not used. Its brand is not reused.
- **Check on**: new versions of the drivers Outlore takes code from.

### Paseo

- **Good ideas**: a relay Worker with end-to-end encryption; an Electron window that loads the Expo app's web build.
- **Taken**: the relay and its encryption ([0001](architecture-decision-record/0001-new-codebase-not-a-fork.md), [0003](architecture-decision-record/0003-per-user-relay-carrying-all-traffic.md)); the desktop shell approach ([0004](architecture-decision-record/0004-electron-desktop-shell.md)). Its shared, project-run relay was rejected.
- **Attachments** (2026-11-10): paste listener on web and Electron, a native paste module on mobile; the image travels as base64 inside the WebSocket message (the same path serves the phone through the relay); Claude Code gets a base64 block, Codex a temp file (mode 0600) as `localImage`; no capability check for ACP, so an unsupported type reaches Claude as a silent skip.
- **Connection and folders** (2026-11-12, from its source, nothing copied): a client reaches a daemon directly (a chosen listen address, optional password), through an SSH tunnel, or through the relay, which stays off until the owner enables it and pairs with a QR code or link carrying the daemon's public key; each saved host has its own connection and a host menu switches between them. Its "Add project" flow starts with the host and offers only what that host supports (`canBrowse`, `canCreateDirectory`); the folder picker is a type-to-search run by the host, with suggestions from folders the agent sessions of the last 30 days used, and a two-step New folder. Its production relay is now a separate distributed Elixir service and the Cloudflare one in its repository is "legacy code and is not deployed" (reason not stated). Taken for Outlore: the host-aware folder picker and its suggestions ([device-pairing](capabilities/device-pairing/specifications.md), CHG-0202); the relay's history is a risk noted in the [draft](capabilities/device-pairing/draft.md).
- **Daemon** (2026-11-14, from its source at `42c7b7f`, nothing copied): the daemon is plain Node, run by the desktop app on Electron's own Node (`ELECTRON_RUN_AS_NODE`), and also shipped as an npm CLI and a Docker image; the desktop app attaches to a running daemon or starts one detached, and a "keep running after quit" setting, off by default, decides whether quitting stops it; no login service, so it does not come back after a restart; a PID file with a heartbeat keeps one daemon per data folder, and a per-start token file readable only by the owner lets local clients in; terminals run in their own worker that outlives daemon restarts. Details and citations in [research/paseo-daemon.md](research/paseo-daemon.md).
- **Sandbox** (2026-11-23, from its source at `3389138`; [research/sandbox-handling-2026-11-23.md](research/sandbox-handling-2026-11-23.md)): no sandbox of its own; it sends each CLI's own mode (Codex `workspace-write`, `read-only` or `danger-full-access`) and stores the policy Codex resolved. No start check and no failure message found; the documented answer is a container ("The container is the isolation boundary for agents"). No secret-folder protection. Taken: none.
- **ACP clients and Antigravity** (2026-11-24, from its source at `cf1a5a9e` and community proxy `tiezbro/paseo-agy-acp` at `0a47967c`, both Apache 2.0; [research/acp-antigravity-t3code-paseo-2026-11-24.md](research/acp-antigravity-t3code-paseo-2026-11-24.md)): one shared `@agentclientprotocol/sdk` base (`acp-agent.ts` + `generic-acp-agent.ts`) parameterized by thin constructor hooks for Cursor, Copilot, Kimi, Kiro, and Trae (28–282 lines each); `paseo-agy-acp` adds an NDJSON proxy for standalone `agy-acp-server` 1.5.2 that normalizes MCP headers, downgrades Antigravity's `mcp-protocol-version: 2026-07-28` to `2025-11-25`, and confirms stdio MCP works on Antigravity without a capability flag. Taken: none yet; informs Outlore's H2 unified ACP module.
- **Update** (2026-11-27, from `v0.18.0` / `82dcf782`; [research/paseo-t3code-openbot-nightly-labs-2026-11-27.md](research/paseo-t3code-openbot-nightly-labs-2026-11-27.md)):
  Removed `agy -p /usage` background Antigravity usage polling (`39410ae7`, `v0.17.6`), citing Google's Antigravity FAQ and maintainer guidance that third-party harnesses running `agy -p` breach consumer terms — a direct compliance flag for Outlore's CHG-0722.
  Added a remote workspace browser proxy (`6d2db42`, `v0.18.0`) routing remote `localhost` dev servers through the daemon, per-device notification preferences (`3c0553d`), optional system prompts on agent profiles (`539f4af`), a first-class Tailscale toggle (`6c237aa`), Desktop update modes (auto/notify/off) with Settings split into Device vs Host, mobile foreground dual-5s `ping`/`pong` liveness detection discarding OS-suspended timers, and Noise NK / `requireProtectedSecurity` docs.
  Its `docs/architecture.md` still gives no reason why the Cloudflare relay was retired in favor of `getpaseo/paseo-relay`.
  Taken: none yet; mobile dual-5s liveness probes, remote `localhost` browser proxying, and Device vs Host settings are candidates, and CHG-0722 needs a terms-compliance check.
- **License**: Apache 2.0 (checked in its repository, 2026-11-12).
- **Check on**: relay and encryption changes; why its Cloudflare relay was retired.

### T3Code

- **Source review** (2026-11-15): [primary-source notes](research/t3code.md) pin `pingdotgg/t3code` at `0de6ddb8235debee8c7119343e1a4da9cd8b5de8`, whose server and desktop packages say 0.1.9. The current project includes an independent host, OS-managed background services, app-owned delegated threads with independent model choices and messaging, portable conversation handoffs, scheduled tasks, and beta guest and peer-machine features. It is not accurately described as only a Codex chat interface.
- **Potential reuse**: compare its implemented host lifecycle, service updates, host-owned terminals, Git/worktree tools, and delegation with the corresponding Outlore plans before building them independently. Shared TypeScript/Effect choices make it worth inspecting, not automatically interchangeable.
- **Constraints**: managed T3 Connect uses a trusted broker and account authentication; the inspected path is not Outlore's account-free, application-layer end-to-end encrypted relay. Its portable handoff also has a bounded message history, not complete tool/session-state transfer. See the [comparison](research/outlore-t3code-comparison.md) before treating a similar feature name as equivalent behavior.
- **Sandbox** (2026-11-23, from its source at `f4c38ca`; [research/sandbox-handling-2026-11-23.md](research/sandbox-handling-2026-11-23.md)): no sandbox of its own; four runtime modes map onto each provider's own switches (Codex `untrusted`/`readOnly`, `workspaceWrite`, `dangerFullAccess`), and a thread is clamped to a mode the provider supports or a managed ceiling. No start check. One diagnosis by symptom: a loopback connect failing with EPERM tells the agent "a network sandbox is blocking localhost. Run this command again with network access, outside the sandbox." No secret-folder protection found. Taken: none.
- **ACP and Antigravity** (2026-11-24, from its source at `93a7cfe7`, MIT; [research/acp-antigravity-t3code-paseo-2026-11-24.md](research/acp-antigravity-t3code-paseo-2026-11-24.md)): one shared Effect ACP runtime (`AcpSessionRuntime.ts` + `adapter.ts`) parameterized by an `AcpAdapterV2Flavor` record; selects MCP transport across MCP-over-ACP, opt-in HTTP MCP, and a stdio-to-HTTP MCP bridge fallback (`AcpMcpStdioBridge.ts`) so agents without `mcpCapabilities.http` (including `agy 1.5.16`) still reach host tools; documents Antigravity 1.5 quirks (`clientInfo.name` allowlist lifted in 1.5.1, `yolo`/`auto_edit` rejected by `agy`, `interaction_*` questions over `request_permission`, `session/resume` avoiding replay, `SSH_CONNECTION` needed on 1.5 for per-profile file token storage, and `inputTokens + cachedReadTokens` for Gemini usage). Taken: none yet; informs Outlore's H2 unified ACP module and H3 stdio MCP fallback.
- **Update** (2026-11-27, from `v0.1.13` at `83b6c4cd`; [research/paseo-t3code-openbot-nightly-labs-2026-11-27.md](research/paseo-t3code-openbot-nightly-labs-2026-11-27.md)):
  Stopped reading Antigravity usage limits from Google's internal APIs (`96423cb5`, `#43026`) and stopped spoofing `clientInfo.name: "zed"`, refusing `agy 1.5.0` (`5e37e6db`, `#43087`).
  Added **Durable Workflows (beta)** with schedules, webhooks, human approvals, named concurrency pools (`within("builders", { limit: 4 }, body)`, `#42518`), and workflow subjects (`#42517`), multi-repository projects with isolated worktrees (`v0.1.12`), Linked threads (beta) and Connections map (beta) across linked machines, in-thread MCP sign-in from warning banners (`#39921`), Apple Speech local dictation on macOS 26+ (`#34027`), MCP Events polling/webhooks, approval cards revealing invisible/non-printing characters (`#43049`), Auto-accept edits scoped strictly to thread workspace folders (`#43046`), `update_steps` mapped to the task list with Antigravity subagents projected into the normal timeline, and Android beta `2.4.0 (831)`.
  Still no per-project or per-thread memory feature.
  Taken: none yet; named concurrency pools, invisible-character reveal on approval cards, in-thread MCP sign-in, Apple Speech on macOS 26+, and folder-scoped auto-accept edits are candidates.
- **Taken**: no code or architecture change. This is research, not approval to fork, migrate, or add a service.
- **License**: MIT at the inspected commit; preserve its copyright and permission notice if code is later reused. Any reuse still needs the project's architectural decision and dependency/license checks.
- **Also found**: threads without a project (per-thread scratch folder, promotable to a project), comparable to the Borderlands' scratch folder; no per-project or per-thread memory was found, so scoped lore stays a real difference.
- **Check on**: how a local/self-hosted installation can meet Outlore's access and cost requirements, the stability of guest/peer features, and whether its app-owned delegation can carry Outlore's quest, lore, and budget rules without maintaining a second orchestration system.

### Delta and Zed's DeltaDB

- **Good ideas**: a handover that replays the full history to the new harness; version control for agent edits and conversations (DeltaDB).
- **Taken**: full-history handover ([0006](architecture-decision-record/0006-handover-replays-full-history.md)).
- **License**: Delta is closed, so ideas only. DeltaDB remains closed source as of 2026-11-27 (companion repos `zed-industries/delta-claude` under AGPL-3.0 and `zed-industries/delta-nix` unlicensed are public; no AGPL code is reused).
- **Update** (2026-11-27, from `v0.29.0` and `delta.dev`; [research/workspace-products-2026-11-27.md](research/workspace-products-2026-11-27.md)):
  Delta entered public beta (`v0.29.0`, 2026-11-25) with Personal $0 (BYOK plus free Cloud Runners) and Pro $10/mo.
  Added built-in macOS 14+ browser tabs controllable by Delta's agent, split subthread tabs and drag-to-split panes, right-click `View Diff from Here` / `View Diff from Cursor` on any transcript point, and search filters (`from:`, subthreads, archived, tags), with ACP support, sandboxing, repo-level context, and Codex/Pi/Zed CLI plugins on the roadmap.
  Taken: none yet; `View Diff from Here`, split errand tabs, and structured search filters are candidates.
- **Check on**: whether DeltaDB is published as open source; it could replace Outlore's own copies ([backlog](backlog.md)).
- **Sidebar hover actions** (2026-11-11, from the owner's screenshots of Delta's sidebar): a row shows only its icon and name at rest, and its actions ("…", "+") appear at its right while the pointer is over it. Taken for the Outlore sidebar's fold arrows and action buttons, with keyboard focus also showing them (CHG-0163). No Delta code was seen or copied.
- **One theme** (2026-11-14): the owner asked for Zed/Delta One Light and One Dark colors. Taken from Zed's published MIT-licensed theme, with its notice included in desktop builds; no Delta code copied. Exact source, mapping, and contrast adaptations are in [research/zed-one-themes.md](research/zed-one-themes.md).

### intentic ([intentic.dev](https://intentic.dev), [source](https://github.com/intentic/intentic))

- **What it is**: an open-source workspace that runs several coding agents in parallel, each in its own Docker sandbox and git branch, nothing landing until approved. Desktop app, terminal install, self-hosted server, or paid hosted sandbox. Several harnesses (Claude, Codex, Gemini, Cursor, Devin, Grok, Kimi, GLM), each through the user's plan or key.
- **Good ideas** (from its site, 2026-11-07):
  - the UI, which the user likes: a board with Attention, Active, and Finished columns beside a docked chat; whatever needs the user comes first;
  - cards showing model, branch, cost so far, and diff stats;
  - a plan with an Approve button in the chat; a review view with changes grouped by repository, a diff per file, the agent's report beside it, and a Land now button;
  - a left rail of sandboxes and the Claude and Codex plan usage on the home view; a Devices page listing machines, status, resources, and mirrored ports;
  - an integrations catalogue grouped by purpose, with connected services checked;
  - automations started by a git push, Sentry, Stripe, email, Slack, Discord, or cron, with an optional filter command deciding whether to wake an agent;
  - secrets injected only into turns that may use them, never written to disk.
- **Taken**: none yet. Several ideas are already planned for Outlore; compare before adding to the [backlog](backlog.md).
- **Attachments** (2026-11-10): paste, drop, and a paperclip all call one `attach()`; chips with thumbnails and upload progress; files uploaded at once to the workspace and the message carries paths; Claude Code reads them through a path note, Codex takes `localImage`, ACP an `image` block only when `promptCapabilities.image` is true; abandoned uploads leave files on disk. Taken: one step for paste, drop, and picker (CHG-0102).
- **Sandbox** (2026-11-23, from its source at `e9bd596`; [research/sandbox-handling-2026-11-23.md](research/sandbox-handling-2026-11-23.md)): the sandbox is a Docker container per agent, so the agent's own CLI is unrestricted inside it and the host's home is out of reach by construction. The one start check is of the container engine, and its failure is turned into a heading and one action sentence per cause (not installed, would not start, account not allowed, too slow, broken), classified by OS error number first and words second. On Windows it can run on its own engine to avoid Docker Desktop: removing the blocker rather than explaining it. Taken: none yet; the cause-first, one-sentence wording is a candidate for the Vault card.
- **Update** (2026-11-27, from HEAD `5fbfb05` and `v1.428.0`–`v1.431.0`; [research/workspace-products-2026-11-27.md](research/workspace-products-2026-11-27.md)):
  Added two-tier nested delegation (runtime-native subagents sharing the parent worktree plus cross-provider "meta-harness" full child agents in their own worktree with conflict-marked merge-back; `v1.431.0` keeps parent tasks in Active while children or workflows still run).
  Added host-direct execution outside Docker (e.g. Devin) and moving remote-runner chats into a sandbox, off-plan model exclusion and auto-failover to another account, reset-window pace ticks on usage meters, quick-bar replies while chat is tucked, `AGENTS.md` chips with 20k-char usage rings, a "carried forward" state for budget-paused automations, per-device screen/input/terminal toggles, and removed its Claude Code plugin (`v1.431.0`).
  Taken: none yet; keeping parent quests in Active while errands run, reset-window pace ticks on usage meters, "carried forward" budget-deferred Ritual runs, `AGENTS.md` size chips, and account auto-failover are candidates.
- **License**: MIT (sandbox, CLI, workspace, platform). Code may be reused with its notice where a decision record allows it.
- **Check on**: its [changelog](https://intentic.dev/changelog/), [releases](https://github.com/intentic/intentic/releases), and [docs](https://intentic.dev/docs/), especially UI changes and how its two-tier nested delegation matures.

### Rakazo ([rakazo.com](https://rakazo.com), [source](https://github.com/elie222/rakazo))

- **What it is**: an open-source platform of AI agents ("bots") that each hold a job, such as Inbox Manager, Sales Outbound, Coding Agent, Bug Triage, or Chief of Staff. It comes as a web, desktop (macOS, Windows, Linux), and mobile (iOS, Android) app. It can be self-hosted for free with every feature, or hosted with a cloud computer billed in computer hours. Models come from the user's own Claude or ChatGPT subscription, an API key, OpenRouter, or a local server (Ollama, LM Studio). From the team behind Inbox Zero.
- **Good ideas** (from its site, 2026-11-09):
  - a bot learns a task by watching the user do it once, then saves the steps as a reusable skill;
  - memory a bot keeps and shares with the team, such as a preference ("Prefers short replies");
  - work started by a schedule, a webhook, a GitHub event, or a change the bot watches, carrying on while the user's computer is off;
  - bots handing work to each other and working in groups;
  - the user choosing which actions need sign-off; a "held pile" of drafts awaiting approval; a bot that calls the user in the app when it needs them;
  - a different model per bot;
  - reachable from Slack, and when self-hosted from iMessage or SMS, WhatsApp, and Telegram;
  - a summary per run (archived, replied, drafted, flagged) and a mobile inbox showing which rows wait on the user.
- **Taken**: none yet. Its approvals, a model per agent, and delegation are already in Outlore. Learning by demonstration, event triggers, and the held pile of drafts are candidates; compare them before adding to the [backlog](backlog.md).
- **Attachments** (2026-11-10): paste only when `clipboardData.files` is not empty, so text paste is untouched; 10 MB and 4 files per message; jpeg and png shrunk to 1600 px at quality 0.7 on web and mobile; the server refuses an image for a model without vision, and the client offers to send it as a file. Taken: the paste check and the refusal for a model without vision (CHG-0102).
- **Sandbox** (2026-11-23, from its source at `e64d732`; [research/sandbox-handling-2026-11-23.md](research/sandbox-handling-2026-11-23.md)): isolation is a computer per bot, in Docker, a cloud provider or the owner's machine, not an OS sandbox on the owner's session; an optional restricted-egress setting blocks private networks and cloud metadata but not public hosts. Behaviour when Docker is missing not read. Taken: none.
- **Update** (2026-11-27, from HEAD `bbb70b6` and `v0.14.0`–`v0.16.0`; [research/workspace-products-2026-11-27.md](research/workspace-products-2026-11-27.md)):
  Approvals (`docs/approvals.md`) use Ask / Auto / Never ask modes, Allow/Block lists with Preview, a 30-minute expiry on unattended approvals, a hard "never skip with Always allow" list (instruction edits, payments, saved logins, first computer/app use, autonomous bot-management), and taint-aware Auto Review after reading untrusted external content.
  "Teach a task" (`docs/skills.md`) records actions on the bot's computer with unrecorded **Protected input** for passwords and emits an editable **Draft skill** card (GitHub/plugin skills are instructions-only and never run bundled scripts).
  Added chat-initiated OAuth, public MCP directory search with an "unreviewed" warning, stripping stored tokens when an MCP URL changes (`v0.15.0`), phone-native Calendar/Reminders, **Use my computer** for routines (auto-disabled if prompt, owner, bot, or machine changes), non-overlapping recurring routines, and placing recalled memory after chat history (escaped) to preserve prompt caching.
  Taken: none yet; escaping and post-prefix placement for recalled lore, expiring unattended Ritual approvals, preventing overlapping Ritual runs, stripping auth tokens on connector URL changes, and a non-waivable approvals list are candidates.
- **License**: Apache 2.0 (verified in `LICENSE` at `main`, 2026-11-27; includes `NOTICE`, no `enterprise/` folder). Ideas only unless a decision record allows code.
- **Check on**: its [docs](https://rakazo.com/docs/), [releases](https://github.com/elie222/rakazo/releases), and [integrations](https://rakazo.com/integrations/), especially how taint-aware Auto Review and demonstration skills evolve.

### Turnstone ([myturnstone.ai](https://myturnstone.ai))

- **What it is**: a Mac app (Apple silicon and Intel) of AI teammates ("Agents") that run on the subscriptions the user already pays for: OpenAI, Claude, Gemini, Grok, OpenRouter, Cursor, or Ollama. Free on the Mac; Turnstone Cloud, announced as coming soon at $49 a month, keeps Agents running while the Mac is closed and reachable from a phone.
- **Good ideas** (from its site, 2026-11-09):
  - a first Agent, the Chief of Staff, that sets up the other Agents for each part of the work;
  - switching models in the middle of a conversation while the Agent keeps its context;
  - memory of how the user likes the work done, and a writing style learned from sent emails;
  - recurring jobs saved from plain language, such as "every weekday at 9";
  - any Agent handing a task to another, with the result coming back to the user's chat;
  - each Agent working in its own tab of a built-in browser;
  - drafts reviewed before sending: "Nothing goes out until you send it";
  - connected apps (Gmail, Slack, Granola, Google Calendar, WhatsApp) read on a schedule the user chooses, with updates shared across Agents;
  - Agents, chats, and memory kept on the Mac "in a folder you can open".
- **Taken**: none yet. Results coming back to the opener's chat, a model per agent, and local data are already in Outlore. A model switch keeping context is close to the staged thread-handover ([0006](architecture-decision-record/0006-handover-replays-full-history.md)); a setup agent, plain-language schedules, and scheduled context sync are candidates; compare them before adding to the [backlog](backlog.md).
- **Update** (2026-11-27, from `myturnstone.ai`, `/changelog`, `/howto`, `/academy`; [research/workspace-products-2026-11-27.md](research/workspace-products-2026-11-27.md)):
  No new public changelog entries since 2026-11-07 (`v0.8.7`); the homepage now announces YC-led funding.
  The main setup agent is now named **Pebbles** (Chief of Staff is listed as an Agent Library template), fallback AI priority and Turnstone Credits shipped in `0.8.6`–`0.8.7` (context-transfer mechanics on model switch remain undocumented), each Agent's Brain splits into **Right now**, editable **How I work** bullets, and **Keeps** with an optional review gate on identity edits, and Cloud remains in experimental rollout.
  Taken: none yet; expandable Markdown table previews and a compact one-line sidebar row option are candidates.
- **License**: closed, as far as its site shows: no source or license is published. Ideas only.
- **Check on**: its [changelog](https://myturnstone.ai/changelog), [how-to](https://myturnstone.ai/howto) and [academy](https://myturnstone.ai/academy) pages, especially whether Cloud ships and whether context-transfer mechanics are documented.

### Cindy ([cindy.app](https://www.cindy.app), [source](https://github.com/makecindy/cindy))

- **What it is**: an open-source AI agent running on the user's own computers and phone (macOS, Windows, Linux, iOS, Android), bringing existing agents and subscriptions together. Harnesses: Claude Code, Codex, or Pi; "A harness is an execution engine; models are a separate choice." Models from the user's subscriptions or keys (Claude, ChatGPT, SuperGrok, Kimi Code, MiniMax, GitHub Copilot…), Cindy's paid model service, or local models (beta: Ollama, llama.cpp, LM Studio). Free with every capability when bringing one's own key; Plus from $20 a month for its model service; Team and Enterprise coming.
- **Good ideas** (from its site, 2026-11-09):
  - one task carried across screens: the same task, conversation, and files on every device, with file preview and transfer, and remote desktop to operate a connected computer from the phone;
  - harness and model chosen separately, in one place;
  - a task split into planning, parallel workers, and a review step, each on its own harness and model;
  - requests needing confirmation waiting for the user, on the phone too; diffs, Git worktrees, checkpoints, and stopping a task;
  - memory of preferences, project context, and methods; installable skills from a SkillHub; plugins and MCP;
  - named teammates with a role, memory, and skills, scheduled routines, and teammates called from Slack or Feishu;
  - usage controls and cost attribution for teams;
  - an honest local-first statement: "Local-first does not mean no data ever leaves your device", naming what leaves (model requests, sync, remote access, plugins).
- **Taken**: none yet. Separate harness and model choice, a thread per worker on its own runner, approvals answered from the phone, and budgets are already in Outlore. A planning, workers, and review split as a mission template, checkpoints, and its local-first statement are candidates; compare them before adding to the [backlog](backlog.md).
- **Attachments** (2026-11-10): a pasted bitmap is written to disk as `clipboard-<time>.png`; Claude Code gets a base64 block after a magic-byte check and a resize to 1568 px (webp, 85), under 5 MB encoded, else an `@path` mention; Codex a `localImage`; its vision-bridge design records that a model such as GLM drops images silently, so only an up-front check catches it. Taken: the 1568 px reduction and the signature check (CHG-0102).
- **Sandbox** (2026-11-23, from its source at `e6ba8eb`; [research/sandbox-handling-2026-11-23.md](research/sandbox-handling-2026-11-23.md)): no sandbox of its own; it recognises a Codex bubblewrap sandbox that cannot start by the shape of a failed command's output (every line starts with `bwrap: `) and appends a note to the tool result: the command never ran, do not retry, tell the user to switch the task to Full access or use a host that allows sandbox namespaces. Taken: none yet; the note is a candidate wording for Outlore's thread results.
- **Update** (2026-11-27, from HEAD `68edbcc` and `v0.1.144`–`v0.1.148`; [research/workspace-products-2026-11-27.md](research/workspace-products-2026-11-27.md)):
  Merged OpenAI subscriptions and API keys into smart model-group pools (exhaust-first, most-remaining, or weighted; transient errors retry twice, provider errors fail over immediately with a switch note).
  Its Pi harness now auto-derives `anthropic-messages` from Claude Code presets with env-injected credentials and runs durable subagents (`mode:chain`, declarative `mode:workflow` DAGs, opt-in `isolation:require-worktree`, `doctor` probe).
  Cross-device Orca splits "Agent host" (remote model, local files) from "Worker execution device" (entire worker on another computer, approvals routed to Lead), and Agent-Net v2 replaces stacked reliable transports with a single priority-scheduled session layer to avoid relay head-of-line stalls.
  Also added a read-only `/review` sandbox for ACP plugin engines (`633df31`), Antigravity isolated credential path hardening (`8d96d27`), a cross-turn image gallery, and lock-screen approval-timeout explanations.
  Taken: none yet; transient-retry vs immediate-failover with a switch note, distinguishing approval timeouts from explicit Denies, read-only `/review` sandboxes, priority-scheduled relay control frames, and inspecting `8d96d27` for Antigravity credential isolation are candidates.
- **License**: Apache 2.0 (verified in `LICENSE` at `68edbcc`, 2026-11-27; includes `NOTICE`, no `enterprise/` folder). Code may be reused with its notice where a decision record allows it.
- **Check on**: its [docs](https://github.com/makecindy/cindy/tree/main/docs) and [releases](https://github.com/makecindy/cindy/releases), especially Agent-Net v2, cross-device Orca, and its Pi workflow DAGs; as the open-source product closest to Outlore's multi-harness tree.

### Watch list from an agent directory (2026-11-15)

Nine products added on 2026-11-15 from a directory of personal and team agents, to watch how each runs its agents, not only what it offers. Each claim is cited in [research/agent-directory-2026-11-15.md](research/agent-directory-2026-11-15.md). MausBot, OpenBot (nightly-labs) and Rakazo, also in that directory, are already above.

#### Hermes Agent ([source](https://github.com/NousResearch/hermes-agent))

- **What it is**: a self-improving agent from Nous Research, MIT, running on a laptop or cloud VM, reached through one gateway from Telegram, Discord, Slack, WhatsApp, and Signal.
- **Good ideas**: skills written by the agent after complex tasks; memory the agent curates, with user modelling across sessions; subagents for parallel work, each with its own provider, model, and limits.
- **Taken**: none yet.
- **Sandbox** (2026-11-23, from its source at `249dc60`; [research/sandbox-handling-2026-11-23.md](research/sandbox-handling-2026-11-23.md); corrected 2026-11-27 from misattribution under `agentes.chat`): states that the operating system is the only boundary against an adversarial model; the default backend runs commands on the host, containers and cloud sandboxes are the supported isolation, and it scrubs provider keys from child environments while saying that is not containment. Its desktop app falls back to Chromium's `--no-sandbox` only on strong evidence of a failed start, keeps the fallback per app version and re-probes once after an update. Taken: none yet; the per-version re-probe is a candidate for the Vault check.
- **Update** (2026-11-27, from `main` at `1d15aad1df`, `v0.23.4`; [research/agent-directory-watchlist-2026-11-27.md](research/agent-directory-watchlist-2026-11-27.md)):
  Stable releases resumed (`v0.23.3`, `v0.23.4`), adding Desktop sandbox approval cards for folder/site requests, configurable `skills.index_desc_limit`, `hermes gateway migrate --backends`, background idle compaction per route/channel (`170d9637ea`), and prompt-cache keep-alives during long replies (`112ec9176b`).
  Taken: none yet; background idle compaction, bounded skill-index descriptions, and prompt-cache keep-alives are candidates.
- **Check on**: its subagent and memory design against Outlore's lore scopes; Codync runs it as a harness, so it may appear in more places.

#### Grok Bot (xAI)

- **What it is**: always-on AI teammates that work across apps, inboxes and websites, including ones with no API; beta since 2026-08-11; on desktop and iOS; no public source found.
- **Good ideas**: a workflow the user demonstrates saved as a routine; bots messaging each other and working in group chats; interrupting the user only when an approval is needed.
- **Taken**: none yet.
- **Update** (2026-11-27, from `docs.x.ai/grok-bot/*.md`, now live; [research/agent-directory-watchlist-2026-11-27.md](research/agent-directory-watchlist-2026-11-27.md)):
  Settles the shared-computer conflict: all Bots on one account share a single cloud computer, cookies, files, and CLI credentials (per-Bot screens are work surfaces, not security boundaries, while isolation between users is hardware-backed).
  Settles pricing: bundled into The X Subscription on Premium ($30/mo), Super ($100/mo), Ultra ($200/mo), and Teams/Enterprise rather than waitlist-only.
  Docs also describe Auto Review, Vault Secure Forms with Hints and ephemeral chat-only secrets, and primary-Bot Initiative (proactive offers and broken-sign-in alerts).
  Taken: none yet; Vault item Hints, ephemeral chat-only secrets, and proactive broken-sign-in alerts are candidates.
- **Check on**: how its Auto Review and Vault Secure Forms evolve.

#### agentes.chat ([site](https://agentes.chat), [source](https://github.com/agentes-chat/agentes-chat))

- **What it is**: a team chat where people and AI agents share channels, in open beta; each agent has a role, tools, a budget, and a named person accountable for it; agents on desktop, iPhone, Android, and web.
- **Good ideas**: a named accountable person for each agent; approvals for merges, deploys, rollbacks and connected-app actions; agents picked for a message without an @mention.
- **Taken**: none yet.
- **Update** (2026-11-27, from `main` at `c59090ca0f`, `v0.1.18`, `desktop-v0.8.20`, `speech-helper-v0.1.0`; [research/agent-directory-watchlist-2026-11-27.md](research/agent-directory-watchlist-2026-11-27.md)):
  Now ships a desktop app connecting local computers for local apps and local plans (Claude Code, Codex, Devin CLI), and self-hosts in two Docker containers (Postgres 18 + pgvector, Bun app) or one embedded-DB binary.
  Added accessibility-tree app control without stealing the pointer or keyboard plus a menu-bar active-agent Stop button (`628b4929d1`, ADR 0258), a local Rust speech helper (`agentes-speech`) with an always-visible honest mic and one-click model download, macOS TCC permission diagnostics linking straight to System Settings, in-chat approval-policy change cards with Undo, and Claude Code pre-warming.
  Taken: none yet; pointer-free accessibility-tree app control with a menu-bar Stop, macOS TCC diagnostics, in-chat approval-level Undo cards, and the honest always-visible local-speech mic are candidates.
- **License**: AGPL-3.0 (confirmed in `LICENSE` at `c59090ca0f`, 2026-11-27; commercial license in `COMMERCIAL.md`). Ideas only, no code.
- **Check on**: how its accessibility-tree desktop control and approval-policy Undo cards evolve.

#### Codync ([source](https://github.com/leepokai/Codync))

- **What it is**: runs coding agents on the user's own computer as persistent bots, with iPhone and Android apps; Apache 2.0 from version 2.11.0 (MIT before); Claude Code, Codex, Hermes Agent and about 40 more.
- **Good ideas**: pairing by QR code with no account on the same network or Tailscale; the relay optional and end-to-end encrypted, with an account alone never unlocking a computer; push text sealed to the phone's key; approval cards on the phone.
- **Taken**: none yet.
- **Sandbox** (2026-11-23, from its source at `9dae3e2`; [research/sandbox-handling-2026-11-23.md](research/sandbox-handling-2026-11-23.md); corrected 2026-11-27 from misattribution under `Bloks`): none; its `SECURITY.md` says a paired device has full control and agents run shell commands "by default without asking", with permission policies and approval cards as the consent layer. Taken: none.
- **Update** (2026-11-27, from `main` at `695751ab25`, `v2.54.0`; [research/agent-directory-watchlist-2026-11-27.md](research/agent-directory-watchlist-2026-11-27.md)):
  Android app is now live on Google Play (`com.pokai.Codync.android`).
  `v2.54.0` adds bot-owned folders, per-project git worktree modes (`off`, `side by side`, `always`) with shared `node_modules` linking and `.worktreeinclude`, standalone threads with 7/30/90-day auto-cleanup, a multi-tab desktop thread panel (Browser, Terminal, side chat), workflow phone notifications deep-linking to approval, and a Network mailbox (`#619`).
  `private-relay/README.md` documents a single-process Node 22 relay verifying `Codync-Sig` against `CODYNC_PRIVATE_RELAY_PUBLIC_URL` (ignoring `Host`) and encrypted push tickets for APNs; Windows still lacks remote screen and the iOS 18+/26+ README mismatch remains.
  Taken: none yet; `.worktreeinclude` with shared `node_modules` linking and binding relay signatures to the configured public URL plus opaque encrypted push tickets are candidates.
- **Check on**: remote screen on Windows and how its worktree modes and Network mailbox evolve.

#### Bloks ([source](https://github.com/hamedgitty/bloks))

- **What it is**: a desktop app of personal agents that live on the user's machine, as chat contacts with Markdown memory, and rooms where agents take turns under a lead agent; version 3.2; FSL-1.1-MIT.
- **Good ideas**: a lead agent who speaks last in a room; memory kept as plain Markdown files the user can open; separate workspaces, each with its own agents, keys, rooms and folder; a phone app that holds nothing and only shows the computer's agents.
- **Taken**: none yet.
- **Update** (2026-11-27, from `main` at `17699a02a2`, `v3.2.15`; [research/agent-directory-watchlist-2026-11-27.md](research/agent-directory-watchlist-2026-11-27.md)):
  Android app is now live on Google Play (`dev.bloks.app`).
  `SECURITY.md` confirms Bloks Cloud relays end-to-end sealed traffic except forwarded agent emails and Meta WhatsApp messages (not stored on Bloks Cloud), supports optional sandboxes/Local VMs/Cloud boxes, refuses public-internet URLs for unauthenticated Chatterbox voice servers, and adds `team apply team.md` plus Composio realtime watchers.
  Taken: none yet; refusing public-internet URLs for unauthenticated local helper servers and declarative `team.md` templates are candidates.
- **License**: FSL converts to MIT two years after each release; ideas only until a decision record allows code.
- **Check on**: how its declarative `team apply team.md` and local sandbox options evolve.

#### Muse Bot (not identified)

- **What it is**: a U.S. personal agent card in the directory with no product link; no product named Muse Bot was found. Meta's Muse, launched 2026-09-08, is a possible match but unconfirmed.
- **Taken**: none yet.
- **Update** (2026-11-27; [research/agent-directory-watchlist-2026-11-27.md](research/agent-directory-watchlist-2026-11-27.md)):
  Directory link is still absent so the match to Meta Muse remains unverified; primary-source review of Meta Muse (`muse.ai`, `about.fb.com`) shows **Muse Secure VM** with a separate OS-isolated **Sentinel** agent gating all internet egress and approvals, browser-invisible credential storage plus Stripe Link one-time cards, and upcoming **Muse Confidential VM** with user-held keys.
  Taken: none yet; an OS-separated Sentinel egress/approval gate and browser-invisible user-typed credentials are references for `computer-use` and `connectors`.
- **Check on**: whether the directory card adds a link; how Meta Muse's Confidential VM ships.

#### OpenFuse ([repository](https://github.com/CopilotKit/openfuse), retired)

- **What it is**: a self-hosted personal agent with its own Chromium browser, an optional Linux terminal in a container, and files; MIT; formerly `CopilotKit/OpenMuse`.
- **Good ideas**: a container with no host-directory mounts or credentials; terminal networking off, with web access only through the browser worker; saved command receipts; PDFs moved between the computer and the app.
- **Taken**: none yet.
- **Update** (2026-11-27, from `main` at `34007f164c`; [research/agent-directory-watchlist-2026-11-27.md](research/agent-directory-watchlist-2026-11-27.md)):
  Renamed to `CopilotKit/openfuse` on 2026-11-17 (`67580f1605`) and retired on 2026-11-25 (`34007f164c`), merged into **OpenBot (CopilotKit)** as a skin (`Settings → Skin → OpenFuse`).
- **Check on**: retired; follow under OpenBot (CopilotKit) instead.

#### Noodle ([source](https://github.com/pdparchitect/noodle))

- **What it is**: personal agents on the Mac, with Noodle Hub for sharing from an always-on Mac and Noodle Mobile in TestFlight beta; FSL-1.1-ALv2 (changed from Apache 2.0 on 2026-11-26, `c1a06c033c`; converts to Apache 2.0 after 2 years; `Enterprise/` remains separate); macOS 26.
- **Good ideas**: restricted by default, with per-bot folder sharing; each agent keeping its own workspace, backstory and history; Hub bots that run on the Hub without the Mac's tools.
- **Taken**: none yet.
- **Update** (2026-11-27, from `main` at `68e61781fb`, `v0.98.0` / `server-v0.5.0`; [research/agent-directory-watchlist-2026-11-27.md](research/agent-directory-watchlist-2026-11-27.md)):
  `docs/security.md` confirms restricted-by-default bots (unrestricted mode hidden behind `defaults write`), blocking personal files, other bots, Keychain, and local Unix sockets (`ssh-agent`, Docker) and failing closed if limits cannot be applied (exact macOS mechanism remains unnamed); no in-chat approval prompts.
  Added Noodle Computer (Linux/macOS/Windows VMs), Noodle Browser, Copilot and Devin harnesses, telemetry disabling, stripping synced claude.ai/ChatGPT account skills and plugins, daily 7-day harness session/temp cleanup with a manual button, fresh sessions on harness switch, and centralized Claude Code token renewal.
  Taken: none yet; stripping synced account plugins/skills and daily stale-session cleanup are candidates.
- **Check on**: whether `docs/security.md` names the macOS isolation mechanism; license stays FSL-1.1-ALv2 (ideas only).

#### OpenBot (CopilotKit)

- **What it is**: open-source AI coworkers that each get a computer of their own; an MIT application template with a desktop app for Mac and Windows and a Helm chart; 12.4k stars; site at open.bot. A different project from the nightly-labs OpenBot above.
- **Good ideas**: tool access set per bot, per role and per person, with allow, approval or block; approvals in chat; spend and token limits per bot, role or person; an audit trail that exports to a SIEM.
- **Taken**: none yet.
- **Stated status**: the local Intelligence install is "a preview ... not a production installation"; the iOS, Android, Slack and Teams apps are early access.
- **Update** (2026-11-27, from `main` at `109f656986`, `v1.2.1`; [research/agent-directory-watchlist-2026-11-27.md](research/agent-directory-watchlist-2026-11-27.md)):
  Isolation is now settled (`README.md`): `supervisor` runs one Docker container per person (per-Bot folder and browser profile inside), plus opt-in per-Bot containers via **Isolated**, loopback-only (`127.0.0.1`) with per-container tokens; local Intelligence on macOS Docker Desktop remains a preview with boot-time API compatibility checks.
  Shipped `v1.2.0` and `v1.2.1`, absorbed OpenFuse as a skin, removed Google sign-in for Gemini (API key only), added PWA Home Screen Web Push with iOS Safari guidance, first-message local durability until ack (`23ef22d37d`), persistent `BOT_ENGINE_UNAVAILABLE` error state, and distinct OOM vs timeout reporting in desktop sandboxes (`5f0787cf3d`).
  Taken: none yet; separating OOM kills from timeouts, persisting engine-unavailable errors, holding a new conversation's first message locally until ack, and PWA Web Push iOS guidance are candidates.
- **Check on**: the separately licensed Intelligence service and how its Isolated per-Bot container mode matures.

### Claude Duet ([product](https://claude.com/product/claude-duet), [announcement](https://claude.com/resources/articles/claude-duet))

- **What it is**: Anthropic's proactive agent app, a research preview opened by waitlist on 2026-10-21 (US Pro, Max, Ultra): a standalone iOS and Android app (and claude.ai) where Claude comes to the owner — a short morning brief across connected apps, messages only when something needs attention, tasks handed over by text or voice that keep working on its own cloud computer, and a wait for approval before it sends, pays, signs, or deletes. One ongoing thread carries the owner's Claude memory, skills, and connectors.
- **Good ideas** (from its product page and announcement, read 2026-11-22; claims cited in [research/claude-duet-2026-11-22.md](research/claude-duet-2026-11-22.md)):
  - the phone as the place that says what needs you: a morning brief, then quiet until something needs a decision — attention as the home, not a chat list;
  - the count of what waits reaching the owner from every screen (its app icon), so nothing is opened just to check;
  - "it shows you exactly what it's about to do and waits for your approval" — important decisions stay with the owner, on the phone;
  - you can see what it is doing and steer it while it works, and it messages you when work is done or needs review.
- **Taken** (2026-11-22, [CHG-0647](changelog/0.2.2-Pre-Alpha.md)): the phone menu opens the Chronicle with its unread badge, the narrow top bar's menu button carries the same count, and Back from a Chronicle-opened quest or errand returns to the Chronicle — the attention-first phone loop. The morning brief was already Outlore's: daily background check-ins post to realm Missives.
- **Safety and approvals** (2026-11-27, from Anthropic's 2026-10-23 safety article `claude-duet-safety-privacy-and-security`; [research/assistants-and-memory-2026-11-27.md](research/assistants-and-memory-2026-11-27.md)):
  Product remains a waitlist research preview with no newer Duet announcement.
  The safety article details out-of-model approval and intent checking, hard-banned actions and non-waivable approvals (never eligible for "don't ask me again"), a two-tier outbound discretion classifier ("Never share" vs. "Needs consent"), single-use-key in-app password encryption with proxy token placeholders and an isolated browser VM, disconnect-keeps-learned-memory semantics, and 3-variant adversarial routine evals (innocent, injected instructions, temptation to overstep).
  Taken: none yet; non-waivable connector actions, explicit disconnect-keeps-lore wording, and 3-variant routine evals are candidates.
- **License**: closed (an Anthropic product). Ideas only; no code seen.
- **Check on**: whether the Duet preview opens up, how voice input evolves on the phone, and how the Duet app and the main Claude app come together.

### Cookout ([source](https://github.com/mattpocock/cookout))

- **What it is**: a self-hosted, Slack-style board (`@ai-hero/cookout`, Effect v4, SQLite or Postgres, SSE live stream, React web UI, CLI, and SDK) where people and external agents share channels and one-level-deep threads.
  It deliberately runs and spawns no agents itself: external harnesses (Claude Code, Codex, Cursor, Gemini CLI, Cline, OpenCode) join as human-owned agent identities via the `cookout` CLI, watch their Inbox over SSE (`cookout watch`), or wake on `@mention` via a Trigger URL.
- **Good ideas** (2026-11-25, from its source and ADRs at commit `d78e4ac`, version 0.8.0; full notes with citations in [research/cookout-2026-11-25.md](research/cookout-2026-11-25.md)):
  - every top-level message is a thread one level deep (a reply to a reply attaches to the parent), with open/closed state on the top-level message, single-command reply-and-close (`--close`), automatic reopen on any new reply, and UI-only folding so agents never miss messages;
  - `thread_moved` optimistic concurrency (`409` returning unseen replies) so an agent posting into an active thread reads newer replies before deciding whether to post;
  - quiet-thread **Nudges** (after 3 days, then 7 days) scheduled from storage so finished threads get closed without manual cleanup;
  - lightweight **Reactions** (`thumbs_up`, `thumbs_down`) stored separately and delivered to the message author as Inbox items instead of noisy thread replies;
  - a split-view **Inbox** with one row per thread or channel, 2-second visible auto-ack, explicit **Mark unread**, and first-pass **Read receipts** scoped to mentioned identities and parent authors;
  - **Harness guard** (`agent_as_human` refusal when a human token is used inside an agent harness) and short-code **Agent join requests** so remote workers get a session token without ever holding a human credential.
- **Taken**: none yet.
  Its one-level-deep reply attachment, closed-thread folding, `thread_moved` guard, reaction-as-inbox-item model, and quiet-thread nudges are candidates to weigh alongside Outlore's Slack-like thread replies and Chronicle work.
- **Update** (2026-11-27, from HEAD `f254d9e`, still `0.8.0`, ADRs `0131`–`0143`; [research/workspace-products-2026-11-27.md](research/workspace-products-2026-11-27.md)):
  Added a local wake-on-mention **Runner** (`cookout runner start`, ADRs `0131`–`0141`) that resumes closed harness sessions one run at a time on stdin JSON (no shell, no env token), batches/dedupes mentions, times out with process-group kill and Unreachable presence, stands down cleanly when a live `cookout watch` attaches (`0138`), and writes metadata-only `runner-events.jsonl` plus 1 MiB-capped per-run logs (`0141`).
  Added editable 1-line thread titles (`0140`), `/schedule`, `Mod+Shift+U` to attach files (`0142`), and TypeScript-enforced required shortcuts on every `MenuChoice` (`0143`).
  Taken: none yet; TypeScript-enforced menu shortcuts and metadata-only JSONL event logs plus byte-capped per-run logs are candidates.
- **License**: still unlicensed at `f254d9e` (no `LICENSE` file and no `"license"` field in `package.json`, all rights reserved).
  Ideas only, no code.
- **Check on**: whether it adds an open-source license, how its Inbox split view and thread closing evolve in daily multi-agent use, and whether its Runner adds richer thread-to-session links.

### Claude Code and Codex sandboxes and harness changelogs, checked 2026-11-27

Not inspirations as products but the sandboxes and CLIs Outlore's harnesses run in; details and citations in [research/sandbox-handling-2026-11-23.md](research/sandbox-handling-2026-11-23.md) and [research/assistants-and-memory-2026-11-27.md](research/assistants-and-memory-2026-11-27.md).
Claude Code's runtime `@anthropic-ai/sandbox-runtime` 0.0.83 (Apache-2.0, repo moved to `anthropics/sandbox-runtime`) has had no new commits or releases since `0bbebed0` (2026-11-12): it checks dependencies at startup (`checkDependencies()` returns `errors` and `warnings`) but does not test that a denial holds, runs unsandboxed on unavailable sandbox unless `sandbox.failIfUnavailable` is `true`, has no built-in credential deny list, and has no detection of an enclosing sandbox on macOS.
Its `denyRead` can be run model-free through its `srt` command, which Outlore's probe uses (CHG-0657).
Codex (`a1604a8` -> `afe555b9`, `0.172.0`–`0.174.0-alpha.8`) still has 0 commits in `sandbox_integrity` (paused) or `cli/src/doctor` (no start-time kernel check), but added `f22cc03b` (`#63743`, saved exec allow rules can no longer silently bypass review when read denials apply) and `1263a383` (`#63711`, bind sandbox CA access to prepared proxy route).
Harness integration highlights (2026-11-27): Claude Code `v2.1.332` added MCP-shipped skills (`server:skill`, beta), `oat02-` support in `CLAUDE_CODE_OAUTH_TOKEN` (check Outlore log scrubbers), `isSynthetic: true` for relayed `claude -p` turns on Opus 4.8+, and 60s-silence / 10m tap-mode voice dictation; Codex `0.174.0-alpha.8` added lazy stdio MCP startup on first tool call (`#62366`), preserving queued child-agent replies on parent interrupt (`#62348`), per-tool approval reviewers for connected apps (`#62360`), and Code Mode gRPC host connections (`#62476`).
**Check on**: whether Codex turns its integrity checker back on or adds a start check; whether `srt` gains an enclosing-sandbox check.

## Interface and design

### Crest ([crestbrowser.com](https://crestbrowser.com), [source](https://github.com/crest-browser/Crest))

- **What it is**: an open-source browser for Mac, iPhone, and iPad (SwiftUI; Chromium and WebKit on Mac). Its main idea is **Spaces**: work, home, research, or a private session, each with its own cookies, history, tabs, credentials, settings, and sync identity, and **Sub-Spaces** that share sign-ins within a group.
- **Good ideas** (from its README, 2026-11-09):
  - **Crest Studio**: each Space has a crest on its sidebar background, designed from a template through steps (shape, field, band, emblem, border, finish, sidebar), each step choosing among previews of the user's own crest, with Shuffle and Undo;
  - every part of the crest has its own color, named by what it paints;
  - emblems from heraldic artwork, emoji, monograms, or a searchable symbol picker;
  - an Appearance page with presets, live preview, and per-setting reset.
- **Taken** (2026-11-09): Outlore used a crest for each realm and a Crest Studio to choose the shape, colors, band, trim, and heraldic emblem.
  The emblems came from game-icons.net under CC BY 3.0.
  [CHG-0452](changelog/0.1.9-Prototype.md#chg-0452--2026-11-18--realm-crests-are-removed-from-the-contracts-the-service-and-the-app) removed the crest system.
- **Update** (2026-11-27, from `main` at `62e3996d`, dev `0.11.70`; [research/assistants-and-memory-2026-11-27.md](research/assistants-and-memory-2026-11-27.md)):
  Repository moved from `pauljoda/Crest` to `crest-browser/Crest`.
  Added coding-agent browser control (`/guides/coding-agents/`, `8a909b14`), opt-in per Space/Sub-Space group with macOS code-signature verification on first connect, always-prompt for private windows, and `CREST_BACKGROUND_LAUNCH=1`.
  Documented Sub-Spaces sharing sign-ins, passwords, extensions, and agent access with `"Shared by <Primary>'s Sub-Spaces."` footer labels and `Separate Pinned Tabs`; Crest Studio Banner and Gradient styles are moot for Outlore after CHG-0452.
  Taken: none yet; OS code-signature verification for local browser automation callers and explicit "Shared by …" inheritance labels are candidates.
- **License**: MPL-2.0. Ideas are written independently; the crest figures carry their own CC BY 3.0 credits. Check the license's file-level terms before copying any of its files.
- **Check on**: its [releases](https://github.com/crest-browser/Crest/releases) and [guides](https://crestbrowser.com/guides/), especially its coding-agent browser control and Sub-Space grouping.

## Memory and long-running agents

### Rerun ([rerun.build](https://rerun.build), [source](https://github.com/rerun-build/rerun))

- **Good ideas**:
  - a shared "brain" of pages (offering, market, voice, team, stack) that every coworker reads before each run, plus a private memory per coworker;
  - memories that fade by kind unless used, each use slowing the fading, dormant below a strength of 0.15 and archived to a file below 0.05, never deleted;
  - only an index of memories in context, with full text read on demand and new lines added at the end so the cached prompt stays valid;
  - duplicates merged on save after comparing with the closest five memories, conservatively;
  - tests for memory behaviour, such as a greeting not refreshing every memory;
  - each scheduled run starting a fresh session, so what carries over must be written down; templates never include memories or credentials.
- **Taken** (2026-11-06): fading by kind, the global index in context, replacing duplicates, and its fading tests ([scoped-intel](capabilities/scoped-intel/specifications.md)).
- **Update** (2026-11-27, from `dev` at `8f625622`, `v0.25.0`; [research/assistants-and-memory-2026-11-27.md](research/assistants-and-memory-2026-11-27.md)):
  Added one commit in `apps/engine/src/memory/` (`b5d90f66`, PR `#453`) pre-warming recall embeddings as soon as the hub receives a message (30s per-workspace in-flight cache, 1s pre-model timeout with FTS fallback).
  Also added script-only scheduled tasks without a model (1/5/15/60m timeout, notify-on-failure default) and self-deleting one-off tasks, MCP `${file:VAR}` file-backed credentials (`c68de082`), passage quote-reply plus mobile swipe-to-quote (`v0.25.0`), cross-device open-thread sync with a `Continue` banner, and a Brain `Proposals` review queue.
  Taken: none yet; pre-warming semantic recall with a 1s keyword fallback, zero-model Ritual commands with self-cleaning one-off schedules, and passage quote-reply / swipe-to-quote are candidates.
- **Check on**: changes to its memory code (`apps/engine/src/memory/`), its [second brain](https://rerun.build/features/second-brain) page, and its [concepts](https://docs.rerun.build/concepts.md) and [automations](https://docs.rerun.build/agents/automations.md) documentation.

### souls.house and its hearth guide ([souls.house](https://souls.house), [source](https://github.com/swombat/souls-house), [hearth](https://github.com/swombat/hearth))

- **Good ideas**:
  - journals compressed in steps: days into weeks, weeks into months, months into years, keeping the raw entries;
  - append-only writes, so several instances can write at once;
  - honest skips: when nothing is worth keeping, the agent keeps nothing;
  - a memory node as a pointer: a one-line summary, why it mattered, an importance set when created, and a link to the journal entry;
  - recall that strengthens what it finds; the closest match always first, and rare words (in three memories or fewer) pulling their memories forward;
  - capsules: sealed notes that come back on a date or condition, which the agent then raises, holds, or dismisses;
  - model changes never silent, memory export, nightly backups, and a public [decisions](https://souls.house/decisions) page explaining each choice and what would change it.
- **Taken** (2026-11-06): honest skips, recording an intel's origin, rare-word ranking, and history with undo ([scoped-intel](capabilities/scoped-intel/specifications.md)). Journal compression and capsules are in the [backlog](backlog.md).
- **Update** (2026-11-27, from `swombat/hearth` at `11fa827f` and `swombat/souls-house` at `308b10eb`; [research/assistants-and-memory-2026-11-27.md](research/assistants-and-memory-2026-11-27.md)):
  `swombat/hearth` has had no new commits since 2026-09-20.
  `swombat/souls-house` is now open-sourced under MIT (Rails 8, Svelte 5, Docker per resident running `Chaos`), featuring an agent-led self-hosting runbook (`self-host.md`), `bin/house doctor`, CPU-only embeddings, `llms.txt`, and a single-file `souls` Python CLI.
  Taken: none yet; an agent-readable setup runbook plus `doctor` pre-flight check is a candidate for standalone host and own-relay onboarding.
- **License**: `swombat/souls-house` is MIT (checked 2026-11-27); `swombat/hearth` has no `LICENSE` file (all rights reserved). Ideas only unless a decision record allows code.
- **Check on**: its [features](https://souls.house/features) and decisions pages, and `swombat/souls-house` updates.

### Timon ([timon-ai.com](https://timon-ai.com), [source](https://github.com/ai-timon/timon), [docs](https://docs.timon-ai.com))

- **Good ideas** (from its marketing site, updated 2026-11-27 from its repo and docs): every lesson becomes a rule for the next run; agents read a local notes vault before they act; every run leaves a trace that can be replayed step by step.
- **Taken**: none yet. Rules as a never-fading intel kind match its first idea.
- **Update** (2026-11-27, from `ai-timon/timon` at `ccfafd02` and `docs.timon-ai.com`; [research/assistants-and-memory-2026-11-27.md](research/assistants-and-memory-2026-11-27.md)):
  Now has a public AGPL-3.0 repo (+ plugin exception; MIT SDK) and full Markdown docs.
  Live memory is stored as scoped rules (`agent`, `project`, `role`, `global`; `pitfall`, `decision`, `preference`; `core` tier) with provenance beside read-only Markdown memory files, and removing a memory rule forces affected agents onto a fresh session because old transcripts still contain it (`plugins/memory.md`).
  Free for 1 dev/machine with BYO CLI subscriptions (Pro/Cloud pricing still coming soon), plus `timon doctor`, signed release manifests, quota-paced overnight series, browser flow recording with visual annotations, and ACP replay test helpers.
  Taken: none yet; flagging or resetting active threads when a delivered lore entry is forgotten or corrected and signed release manifests are candidates.
- **License**: AGPL-3.0 with plugin exception (SDK is MIT). Ideas only, no code.
- **Check on**: how its scoped rules, fresh-session invalidation, and Pro/Cloud offering evolve.

### Beads ([source](https://github.com/gastownhall/beads), docs at [beads.gascity.com](https://beads.gascity.com/))

- **What it is**: `bd`, a Go command-line issue tracker for coding agents on an embedded or server Dolt database: typed dependency edges, `bd ready` as a computed frontier, atomic claims with leases, gates, TOML workflow templates, and a small `bd remember` notes plane that `bd prime` injects through session hooks.
  Its charter keeps orchestration (routing, model choice, retries) out of core, so it is a task graph beneath an orchestrator, not a rival to one.
- **Good ideas** (2026-11-25, from its source and docs at commit `78624109`, v1.4.0-rc.4 pending and v1.3.4 stable; full notes with citations in [research/beads-2026-11-25.md](research/beads-2026-11-25.md)):
  - an injected-memory cap that cuts at whole entries and prints how many were left out and how to read them, because hosts truncate silently;
  - `blocks` and `waits-for` edges with a computed ready set, where a stored readiness flag needed a repair command (compute it on read instead);
  - gates, one waiting primitive for a human, a timer, a merged pull request, a CI run or another bead;
  - formulas stamped into graphs of steps, and `bd mol distill` turning a finished ad-hoc tree into a reusable template;
  - an events journal that errors on a truncated checkpoint instead of returning a smaller answer.
- **Taken**: none yet; the ideas are candidates for the leaner-preamble item and a future `workflow-running` specification in the [backlog](backlog.md).
  Recommendation: borrow ideas, no connector, no dependency, not Outlore's store.
- **Update** (2026-11-27, from `main` at `0c9c8e69`; [research/assistants-and-memory-2026-11-27.md](research/assistants-and-memory-2026-11-27.md)):
  `v1.4.0` has not shipped yet (`v1.4.0-rc.4` remains pending) and telemetry remains opt-out by default.
  Added `bd show --head` (`5845d3c1`, bounded tail view of the last 1 KB of notes plus 3 comments with an explicit `"withheld N bytes"` line), `hooks.manage` / `gitignore.manage` per-repo opt-outs (`86f27eab`), and `secure_file_priv` hardening on `dolt sql-server` (`c750b575`).
  Taken: none yet; tail-cutting append-only notes with an explicit withheld-bytes line is a candidate for leaner turn preambles.
- **Cautions**: anonymous command-usage metrics on by default (opt-out through `bd metrics off`, `BD_DISABLE_METRICS=1` or `DO_NOT_TRACK=1`); a fast release cadence with one-way schema migrations and experimental planes; its Claude Code and Codex setup writes hooks and `AGENTS.md` sections that Outlore's strict harness launches would not run or would not want.
- **License**: MIT (`LICENSE`).
  Ideas only; no code is taken.
- **Check on**: whether versioned beads and "Graph Preview 2" (1.4) stabilize the data model, whether the telemetry default changes, how errand ordering would fit the thread tree, and its open issues for data loss and lock problems, which were not read.

### Delta conversation terminals, checked 2026-11-10

Delta's [terminal documentation](https://delta.dev/docs/agents/terminals) describes `!` on an empty composer line opening a shell, ordinary exclamation marks staying text, and sending a frozen terminal snapshot while its process continues.
The owner's screenshot shows that snapshot as a terminal block inside the owner's message, with accompanying text beneath it.
Outlore takes that interaction independently, using the owner's home folder without a realm and the realm root with one, as the owner requested.
No Delta code was copied.
