# OpenBot, MausBot, Paseo, and T3 Code: primary-source update (2026-11-27)

Researched 2026-11-27 to track changes since the last entries in [inspirations](../inspirations.md) and surface concrete ideas or corrections for Outlore.
Ideas and factual observations only; no upstream code was copied, installed, built, or executed.

## Sources and method

- **OpenBot (`nightly-labs/openbot`)**: shallow clone (`--filter=blob:none --shallow-since=2026-11-15`) at HEAD `206587a2988b8d0dddfc4c8aec8210ce348048a0` (committed `2026-11-27 10:24:53 +0100`, `package.json` version `0.80.0`), plus GitHub Releases `v0.74.0` through `v0.80.0` and `android-v1.4.13` / `android-v1.4.14`.
  License: `PolyForm-Noncommercial-1.0.0` (`package.json`, `LICENSE`); ideas only, no code.
  Last entries in `inspirations.md`: `v0.73.0` at `67d0a82` (browser, 2026-11-18) and `a31e9a3` (sandbox, 2026-11-23), with connector inventory at `b1e5ea74` (2026-11-22).
- **MausBot (`milind-soni/OpenMausBot`)**: shallow clone (`--filter=blob:none --shallow-since=2026-11-15`) at HEAD `f07ef1426527e278a547c96838a4118563af045b` (committed `2026-11-27 14:51:10 +0530`, `package.json` version `0.1.184`), plus GitHub Releases `v0.1.178` through `v0.1.184`.
  License: `Apache-2.0` (`LICENSE`, `package.json`; `enterprise/` excluded per [ADR 0001](../architecture-decision-record/0001-new-codebase-not-a-fork.md)).
  Last entry in `inspirations.md`: `3aec210` (sandbox, 2026-11-23).
- **Paseo (`getpaseo/paseo`)**: shallow clone (`--filter=blob:none --shallow-since=2026-11-15`) at HEAD `82dcf7821e20094e22bd2a61812287ca1b89f130` (committed `2026-11-27 09:50:43 +0000`, `package.json` version `0.17.6`), plus GitHub Releases `v0.17.4` through `v0.18.0` (`v0.18.0` published `2026-11-27T09:56:22Z`).
  License: `Apache-2.0` (`package.json`, `LICENSE`).
  Last entries in `inspirations.md`: `3389138` (sandbox, 2026-11-23) and `cf1a5a9e` (ACP/Antigravity, 2026-11-24), with connectors note at `c1b43ee5` (2026-11-25).
- **T3 Code (`pingdotgg/t3code`)**: HEAD `83b6c4cd1362cc2673b8ef8a93d42cd4e301c88b` (`apps/server/package.json` version `0.1.13`) inspected via raw GitHub files and GitHub Releases (`v0.1.12`, `android-beta-831`, `v0.1.13`, `v0.1.14-nightly.20261127.5332`) plus PR metadata (`#42518`, `#43026`, `#43087`).
  License: `MIT` (`LICENSE`, "Copyright (c) 2026 T3 Tools Inc.").
  Last entries in `inspirations.md`: `0de6ddb8` (`0.1.9`, 2026-11-15), `f4c38ca` (sandbox, 2026-11-23), and `93a7cfe7` (ACP/Antigravity, 2026-11-24), with connectors note at `21a96989` (2026-11-25).

---

## 1. OpenBot (`nightly-labs/openbot`, `v0.74.0`–`v0.80.0`, HEAD `206587a2`)

Eight desktop/server releases (`v0.74.0` on 2026-11-19 through `v0.80.0` on 2026-11-26) and two Android releases (`android-v1.4.13`, `android-v1.4.14`) landed after `67d0a82`, totaling 532 commits since `a31e9a3`.

### Multiplayer and protocol ("Check on" updates)

- **Team API protocol 10** (`78ad15d1`, PR `#12111`, 2026-11-18): protocol 9 hit its 256-capability cap, so protocol 10 treats the frozen protocol 9 capability list as a baseline and exchanges only delta `capabilities` and `absent` lists in both directions; desktop and web speak 10 with a v10 host while mobile stays on 9.
- **Direct delegation confined to the requesting member's role** (`c57e4cb2`, PR `#13546`, 2026-11-20): in a turn started by a member, `list_agents` and `send_message` now restrict targets to agents where every requesting member has `chat` or higher, returning "unknown id" for hidden agents, and propagate `requesterIds` across `send_message`, automatic results, failure notes, `start_task`, and `agent-interrupt-tool`.
  The commit message notes explicit remaining limits: `send_to_channel`, channel work, `read_agent`, other tools taking an agent id, and wait wake-ups are not yet covered.
  This updates `inspirations.md`'s earlier statement that roles only govern Team API visibility.
- **Member removal still does not cancel running turns**: in `src/main/team-api/route-team.ts:62-69` (at `206587a2`), `removeMember` calls `store.removeMember`, `remoteScreen.revokeMember`, and `browser?.releaseUserControlHeldBy`, with no cancellation of queued or running agent turns.
- **WebRTC framing and README**: commit `38fd2ed1` (PR `#12139`, 2026-11-18) moved WebRTC framing into current code and refuses unmarked WebRTC requests; `README.md` and `docs/` at `206587a2` no longer contain "WebRTC protocol v3".
- **Shared workflow presence and team limits**: `v0.80.0` (`b7d503f9`, PR `#17142`) shows live cursors and selected steps of other members on a shared workflow canvas, and raises the Team license ceiling from 10 to 25 users (hosted servers remain capped at 10; `CHANGELOG.md`).
  `v0.75.0` added server ownership transfer with recipient acceptance (`CHANGELOG.md`).

### Memory, routines, workflows, and execution

- **Prompt-cache pre-expiry compaction** (`f8624e13`, PR `#14521`, `v0.77.0`, `CHANGELOG.md`): idle Claude or Pi chats, tasks, or channel threads at ≥200K tokens auto-compact before their 1-hour prompt cache expires so the next message avoids an uncached full-context read, controlled by a default-on toggle under `Server settings → Providers`.
- **Parallel tasks per agent** (`740efbb4`, PR `#13577`, `v0.76.0`, `CHANGELOG.md`): one agent can split unrelated work into concurrent tasks, receive results back in the main chat to combine, send follow-ups, or stop individual tasks.
- **Automatic finish-check continuation** (`CHANGELOG.md`, `v0.76.0`+): after a tool-using turn finishes, the model checks the request against its work and continues unfinished parts up to 3 times without a user "continue", while still stopping on user questions or approvals.
- **Memory**: `v0.76.0` added Mem0 in Apps plus an `OpenBot memory` toggle per agent (`Agent settings → Advanced`) to disable built-in memory when using an external memory app (`CHANGELOG.md`).
  Agents can now search messages above a "New chat" divider on demand while sending less context by default (`CHANGELOG.md`), background subagent memory edits persist after turn end (PR `#12911`, `v0.75.0`), `~/.claude` memory is skipped when the Claude setup switch is off (PR `#12093`, `v0.74.0`), and the `remember` tool exposes the memory limit to the agent (`5362b669`, PR `#11065`).
- **Quiet routines and typed workflows**: Antigravity, OpenCode, linked routine steps, and workflow agent steps gained quiet-ending `routine_no_update` handling (`1cddd633`, `58d3a006`, `b35d17ed`, `d47d03cc`, `141e6f1a`, `82b57c9b`).
  Workflows added typed **Answer fields** (e.g., `priority: high|normal|low`, `count: number`), zero-cost deterministic **Check** conditions, `{{field}}` autocomplete, pause/resume, **Run from this step**, starter templates, folders/tabs, and an `openbot.workflow` export/import format that refuses files containing secrets (`CHANGELOG.md`, `v0.75.0`–`v0.79.0`).

### Providers, pooling, browser, approvals, and mobile

- **Account pool Spread strategy** (`f47ec1b6`, PR `#17216`, `v0.80.0`, `CHANGELOG.md`): `Settings → Providers → Pool accounts` adds **Spread** alongside **Fill first**, placing agents on accounts with the most remaining usage and switching only when another account has much more room.
  `v0.80.0` also lets admins remove a provider account while a turn is running (waits for the turn to finish, moves agents, then removes; `CHANGELOG.md`).
- **Harness hardening**: fallback to backup model on Google Gemini license refusal (`db0b00d5`, PR `#16795`, `v0.80.0`), failing OpenCode turns that emit tool calls or `<execute>` blocks as plain text (`9ac91dbf` PR `#15960`, `100c60e8` PR `#16883`), starting a fresh ACP session when the agent's session database is damaged (PR `#16744`, `v0.80.0`), and disabling Claude Code's silent-turn reminder (`3d3ef100`, PR `#14807`).
- **Browser**: `v0.79.0`–`v0.80.0` shipped a Chrome extension (side panel with chats, threads, dictation, and shared access to the user's open Chrome tabs; published to Chrome Web Store on release tags).
  `v0.76.1` (PR `#14225`) lets users detach the agent browser into its own window; `v0.79.0` (PR `#15953`) unloads idle browser tabs under memory pressure; hosts with <7 GB RAM cap open browser tabs at 5 per chat (`CHANGELOG.md`).
- **Approvals and Vault**: Vault redaction switched to whole-word matching and stops redacting immediately on delete (`v0.80.0`, `CHANGELOG.md`); agents can propose MCP server headers in chat with approval (refused from external chats like Telegram/Slack); all providers support multi-select questions (`v0.76.0`); agents can request one-time phone location via an approval card (`v0.77.0`); NEAR crypto wallet payments and credit-based media generation use editable approval cards with spend caps and passkey backup checks (`v0.79.0`–`v0.80.0`).
- **Mobile, Apple Watch, and Signal relay**: `v0.80.0` lets the Apple Watch app talk E2EE directly to the server via Signal even when the iPhone app is closed (waking sleeping hosted servers, revoking on iPhone sign-out); `v0.74.0`/`v0.77.0` added a Singapore Signal node and a latency-measured Signal server picker; logs record STUN/TURN failures and ICE candidate pairs (`relay/udp -> srflx/udp`) without logging device IP addresses (`CHANGELOG.md`).
  Mobile `1.4.14` (PR `#17034`) turns on cloud servers and browser flags, adds a Copy button on confirmation draft previews (PR `#16891`), and surfaces usage-limit holds on queued phone messages (PR `#16869`).

---

## 2. MausBot (`milind-soni/OpenMausBot`, `v0.1.178`–`v0.1.184`, HEAD `f07ef142`)

Five releases (`v0.1.178` on 2026-11-23 through `v0.1.184` on 2026-11-26) and 1,192 commits landed after `3aec210`.

### Driver and provider updates ("Check on" updates)

- **Antigravity CLI 1.5.16 per-profile file token storage** (`7dd86877`, 2026-11-25, `server/drivers/antigravity-acp.ts:90-91, 296-308`): CLI 1.5.16 ignores both `AGY_ACP_FORCE_FILE_STORAGE` and `SSH_CONNECTION` whenever an OS keychain can be opened, collapsing all profiles onto one keychain login; 1.5.16 requires `AGY_CLI_FORCE_FILE_TOKEN_STORAGE=1` (set alongside `SSH_CONNECTION` for 1.5.15).
- **Antigravity CLI session tool-list size budget** (`09a4d73c` PR `#7578`, `b2e66200` PR `#7715`, `v0.1.184`, `server/tool-list-budget.ts`, `server/drivers/own-mcp-session-budget.ts`): native Antigravity CLI silently drops the largest tools once total tool declarations exceed its ~55 KB budget (86 KB dropped 11 of 82 tools on CLI 1.5.17).
  MausBot compacts JSON schemas and trims parameter then tool descriptions (least loss first, protecting core tools) while still validating calls against full schemas.
- **Antigravity quota stderr fallback** (`a3e4f3c8`, PR `#7427`, 2026-11-26): treats quota failures printed on harness stderr as usage limits so the fallback model takes over.
- **Codex and Claude drivers**: multiple ChatGPT accounts on Cloud via device-code auth (`v0.1.181`, `server/drivers/codex-device-auth.ts`, `94a1a6d1`); room turns no longer create junk Codex history entries (`v0.1.181`); updater targets the app's own Codex copy instead of global npm (`bf82a725`, PR `#7580`); gateway-named Claude Opus 5.5 (1M) compacts at 1M (`dab1fde0`, PR `#7630`); custom Anthropic-compatible endpoints fold older images to stay under the 20-image cap (`v0.1.181`).

### Workflows, memory, threads, and devices

- **Skill Burger** (`v0.1.178`, `v0.1.180`, `v0.1.181`): a compact pill in chat records each concrete step a bot (or a multi-bot team hand-off) performs—app actions, shell changes, file writes, pages opened—and lets the user edit inputs, untick steps, and save the run as a replayable workflow skill usable by any bot, with symlink-escape blocking (`04336f51`, PR `#7521`).
- **Memory per conversation** (`v0.1.178`): separates matter-specific notes per conversation from global user preferences.
- **Hand-offs, threads, and chat UX** (`v0.1.180`, `v0.1.182`, `v0.1.184`): a live strip above the composer shows active hand-offs with per-handoff **Stop**; one-off hand-off threads auto-close and archive when finished; the receiving bot's main chat shows a folded one-line record opening the hand-off (`f14966e7`, `9894ccce`); group-chat threads can be closed/reopened with one-step delete of closed threads; typing answers an open free-text question directly; `👎` is quiet (read on the next turn without starting a turn) while `👍` means "go ahead"; faded **Suggested replies** fill on `Tab`; bot-generated pages can be saved as standalone **Local apps** (`v0.1.184`).
- **Devices, Tailscale, push alerts, and privacy** (`v0.1.181`, `v0.1.182`): unified `Settings → Devices` with a connection map; one-switch Tailscale ("Let my other computers connect"); lock-screen-private push notifications showing only the bot's name (iOS 2.0.1+, Android later); template publishing automatically strips local paths, emails, phones, usernames, and EXIF metadata and blocks keys/tokens; Cloud browser sandboxes carry saved sign-ins and refuse to start if the policy blocking `file://` cannot be written (`3c029726`).

---

## 3. Paseo (`getpaseo/paseo`, `v0.17.5`–`v0.18.0`, HEAD `82dcf782`)

Three releases (`v0.17.5` on 2026-11-26, `v0.17.6` and `v0.18.0` on 2026-11-27) and 92 commits landed after `cf1a5a9e`.

### Antigravity terms compliance (critical finding for Outlore)

- **Removed `agy -p /usage` background probe** (`39410ae7`, PR `#10953`, `v0.17.6`, 2026-11-27): deleted `plugins/antigravity-provider/server/usage.ts` and `usage.test.ts`.
  The commit message cites Google's Antigravity FAQ and a maintainer reply in `google-antigravity/antigravity-cli#1493` confirming that driving `agy -p` from a third-party harness breaches consumer terms (with risk of account suspension and no exception for personal use).
  Outlore's CHG-0722 added `agy --print "/usage"` on 2026-11-25 (`backlog.md:75`), so this directly challenges that probe.

### Relay, connectivity, and features

- **Relay and security posture** (`0a856ab`, PR `#10749`, 2026-11-25): updated `SECURITY.md`, privacy docs, and homepage to document the Noise NK relay handshake, replay protection, and `daemon.relay.requireProtectedSecurity`.
  `docs/architecture.md:196` still states that production runs `getpaseo/paseo-relay` (distributed Elixir) and retains the Cloudflare relay as "legacy code and is not deployed" without stating why Cloudflare was retired.
  `docs/architecture.md:279` documents mobile foreground liveness detection: returning to foreground runs two 5-second application `ping`/`pong` windows back to back (discarding timers that spanned OS suspension) and reconnects without backoff if dead.
- **First-class Tailscale** (`6c237aa`, PR `#10801`, `v0.17.5`; Refresh control `#10903`, `v0.17.6`): toggle Tailscale directly from host settings or setup without editing config files.
- **Remote workspace browser proxy** (`6d2db42`, PR `#10944`, `v0.18.0`): desktop browser tabs in remote workspaces route through the workspace daemon so remote `localhost` dev servers open directly inside Paseo.
- **Per-device notification preferences and plugin notifications** (`3c0553d`, PR `#10888`, `v0.18.0`): each device chooses which agent, terminal, and plugin events notify.
- **Agent profile system prompts and settings polish**: optional system prompt per agent profile (`539f4af`, PR `#10996`, `v0.18.0`), dedicated Agent Profiles page with one-tap save from the model picker (`#10789`/`#10824`, `v0.17.5`), Settings split into Device vs Host (`#10933`, `v0.17.6`), Cmd/Ctrl+click multi-workspace archive (`#10798`/`#10821`, `v0.17.5`), one-tap copy of quoted drafts without `>` markers (`#10608`, `v0.17.5`), and Desktop update modes (auto-download, notify only, never check; `#10785`, `v0.17.5`).
- **ACP/MCP and platform fixes**: MCP protocol version `2026-07-28` fix (`#10558`, `v0.17.4`), OpenCode session reopen after tool-definition changes (`#10533`, `v0.17.4`), Linux AppImage runtime env leak fix (`#10920`, `v0.17.6`), and worktree ownership root drift fix (`#10878`, `v0.17.6`).

---

## 4. T3 Code (`pingdotgg/t3code`, `v0.1.12`–`v0.1.13`, HEAD `83b6c4cd`)

Two stable releases (`v0.1.12` on 2026-11-25 with 1,092 changes, `v0.1.13` on 2026-11-26 with 401 changes), an Android beta (`android-beta-831`, Android `2.4.0`), and `v0.1.14-nightly` landed since `93a7cfe7`.

### Antigravity compliance and ACP updates

- **Stopped reading Antigravity usage limits** (`96423cb5`, PR `#43026`, `v0.1.13`): removed direct quota calls to `cloudcode-pa.googleapis.com` (`retrieveUserQuotaSummary` / `fetchAvailableModels`), stating Google told them Antigravity supports only ACP for external clients and calling internal APIs can flag accounts.
- **Always identifies as T3 Code, refuses `agy 1.5.0`** (`5e37e6db`, PR `#43087`, `v0.1.13`, `apps/server/src/provider/acp/AntigravityAcpSupport.ts:126`): dropped `clientInfo: { name: "zed" }` spoofing and refuses `agy 1.5.0` so all traffic identifies honestly over ACP.
- **ACP and Antigravity runtime improvements**: `update_steps` checklist maps into the task list instead of raw tool rows (`#41923`, `v0.1.12`); Antigravity subagent threads project thinking, tools, and replies into the normal timeline (`#43491`, `v0.1.13`); Auto-accept edits approves file changes inside the thread's folders and asks about the rest (`#43046`, `v0.1.13`); approval cards reveal invisible/non-printing characters (`#43049`, `v0.1.13`); bounded silent post-settle background command holds (`#40858`, `v0.1.12`); idle agent sessions free memory after 2 minutes (`#41174`) and agent terminals cap retained output at 1.25 MiB (`#41243`).

### Workflows, multi-repo, linked machines, and mobile

- **Durable Workflows (beta) with named concurrency pools and subjects** (`v0.1.12` PRs `#38882`/`#38884`, `v0.1.13` PRs `#42517`/`#42518`, `462596a0`): durable workflows combining agents, schedules, webhooks, and human approvals; `within("builders", { limit: 4 }, body)` caps concurrent runs across server restarts and queues excess runs in arrival order (`limit: 1` acts as a lock); runs declare a subject (issue or PR) for cross-lookup.
- **Multi-repository projects** (`v0.1.12`): one project and thread can span multiple repositories with isolated worktrees, and `v0.1.13` protects shared-checkout edits when cancelling worktree setup.
- **Linked threads (beta) and Connections map (beta)** (`v0.1.12`, PRs `#39406`, `#39439`, `#39515`): read threads on linked machines and connect on demand without pairing each machine up front, link a machine through another environment, and open subagents, side chats, and linked threads uniformly; link codes and guest links now enforce the access level they grant (`#41742`).
- **In-thread MCP sign-in and MCP Events** (`v0.1.12`, PRs `#39921`, `#40774`, `#41141`): sign in to an agent's MCP server directly from its thread warning (including on remote environments), and expose milestones to external agents via MCP event polling/streaming or webhooks.
- **Apple Speech local dictation and Android beta** (`v0.1.12` PR `#34027`, `v0.1.13` PR `#43210`, `android-beta-831`): local Mac dictation via Apple Speech on macOS 26+, and Android beta `2.4.0 (831)` adding side chats, subagents, and previews to the Android inspector.
  No per-project or per-thread memory feature appeared in `v0.1.12` or `v0.1.13`, so scoped lore remains a clear Outlore differentiator.

---

## Not checked

- `pingdotgg/t3code` was not cloned locally because its monorepo object count timed out a shallow clone; its HEAD metadata, `LICENSE`, `AntigravityAcpSupport.ts`, release notes (`v0.1.12`–`v0.1.14-nightly`), and PRs `#42518`, `#43026`, `#43087` were read directly from GitHub, while individual PR diffs for other T3 Code bullets rely on their official GitHub Release notes.
- `getpaseo/paseo-relay` (separate Elixir repository) was not inspected to see whether it states why Paseo retired its Cloudflare relay.
- `google-antigravity/antigravity-cli#1493` was not fetched directly; its summary above is cited from Paseo's commit `39410ae7` (unverified directly against Google's tracker).
- None of the four projects was built, installed, or executed.
