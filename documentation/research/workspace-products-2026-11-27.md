# Workspace products: primary-source update notes

Researched 2026-11-27 against primary sources (GitHub repositories via REST API and `raw.githubusercontent.com`, plus official changelogs, documentation, and RSS feeds) to track what changed since the last dated entries in `documentation/inspirations.md`.
Covers six inspirations: intentic, Cindy, Rakazo, Turnstone, Cookout, and Delta / Zed's DeltaDB.
Nothing was installed or executed; no upstream code was copied.
Where a page returned an HTTP error or could not be verified directly, it is labeled plainly below.

## 1. intentic (`intentic/intentic`, `intentic.dev`)

- **Pinned baseline**: last read in `inspirations.md` was site 2026-11-07, attachments 2026-11-10, and sandbox at `e9bd596` (2026-11-23).
- **Read now**: `github.com/intentic/intentic` HEAD `5fbfb05` (2026-11-26T23:57:36Z; 249 commits ahead of `e9bd596`), releases `v1.428.0` (2026-11-19) through `v1.431.0` (2026-11-25), `https://intentic.dev/changelog/`, and `https://intentic.dev/docs/parallel-agents/`.
- **License**: MIT (`LICENSE` at `5fbfb05`, `Copyright (c) 2026 Artur Kurowski`).

### What is new since last read

- **Nested agents and two-tier delegation** (`https://intentic.dev/docs/parallel-agents/`, `v1.431.0`, commit `410333a`, commit `eb49ca5`): intentic now documents and ships two delegation layers.
  Runtime-native subagents stay inside the provider's loop and share the parent's worktree.
  Full child agents ("the meta-harness") run above vendor runtimes, support cross-provider nesting, work in their own git worktree cut from the parent's state, and merge back to the parent checkout with conflict markers if edits clash.
  In `v1.431.0`, parent cards whose own turn finished while started workflow runs or child agents are still working stay in the **Active** column instead of prematurely moving to **Finished**.
  Post-`v1.431.0` commits add headings and an `outside` field to child-agent permission cards (`410333a`) and draw child updates on the owner edge (`eb49ca5`).
- **Host-direct execution outside Docker** (`v1.431.0`, `https://intentic.dev/changelog/`): users can now run agents directly on their own computer outside sandboxes using installed harnesses such as Devin, and move a conversation running on a remote runner into a sandbox with all its work.
- **Account and plan-aware model routing** (`v1.428.0`, `v1.430.0`, `v1.431.0`): accounts whose plan does not include a model are excluded from that model's pool and shown separately; a model a provider refuses for one account is offered to another account instead of failing repeatedly; the capacity rail shows roomier accounts accurately, collapses providers without a capacity bar into one icon, and adds a tick mark showing whether spend is ahead or behind the reset window.
- **UI and workspace polish** (`v1.430.0`, `v1.431.0`): a quick bar lets the user write to an agent while the chat dock is tucked; the **Finished** lane stays visible and folds overflow into "N earlier"; Memory displays all workspace `AGENTS.md` files as chips with a ring showing usage against a 20,000-character limit; throwaway probe turns are excluded from Past chats; turns resume automatically after a sandbox restart unless disabled; automation runs hitting allowance limits show as "carried forward" rather than failed; the Claude Code plugin was removed as a breaking change in `v1.431.0`.
- **Device sharing and screen control** (`v1.430.0`): per-device toggles control screen viewing, mouse/keyboard control, and remote terminals; Wayland screen capture and VA-API encoding were added on Linux.

### Candidate ideas for Outlore

- Keep a quest card in **Active** while its own turn ended if child errands or workflow runs are still active (avoids premature "done" state in the sidebar and Chronicle).
- Add a reset-window pace tick mark on plan-usage bars (complements Outlore's CHG-0723 plan-usage table).
- Mark Ritual runs deferred by a budget or allowance limit as "carried forward" rather than "failed".
- Offer a workspace `AGENTS.md` / instruction-file chip strip with size rings in the thread details panel.
- Exclude internal probe turns (such as plan-limit or sandbox probes) from visible history, and auto-failover a model refusal to another signed-in account in the Companion stack.

## 2. Cindy (`makecindy/cindy`, `cindy.app`)

- **Pinned baseline**: last read in `inspirations.md` was site 2026-11-09, attachments 2026-11-10, and sandbox at `e6ba8eb` (2026-11-23).
- **Read now**: `github.com/makecindy/cindy` HEAD `68edbcc` (2026-11-27T09:32:47Z; 1,892 commits ahead of `e6ba8eb`), releases `v0.1.144` (2026-11-23) through `v0.1.148` (2026-11-26), root directory listing, `LICENSE`, `docs/provider-pi-runtime-initialization.md`, `docs/pi-subagent-parity-plan.md`, `docs/orca-cross-device-worker-plan.md`, `docs/agent-net-session-plan.md`, and `docs/dev-rules/orca-team-architecture.md`.
- **License (verified)**: Apache-2.0 (`LICENSE` at `68edbcc` is full Apache License 2.0, with a `NOTICE` file and no `enterprise/` folder at repository root).
  This resolves the "not checked in the repository" note in `inspirations.md`.

### What is new since last read

- **Model groups and smart account pools** (`v0.1.145`, `v0.1.146`, `v0.1.148`, commits `60c5922`, `0f375cf`): OpenAI subscriptions and official API keys can now merge into one account pool with configurable order, weight, concurrency limits, and three selection strategies (exhaust-first, most-remaining, weighted).
  On failure, Cindy distinguishes provider-level errors (immediate failover) from transient errors (retry twice on the same source first) and logs which source took over and why.
  Model groups now work across scheduled tasks, Orca Lead/Worker sessions, and mid-task smart routing (`60c5922`).
- **Pi harness and subagent parity** (`docs/provider-pi-runtime-initialization.md`, `docs/pi-subagent-parity-plan.md`, commit `b5a1bb1`): custom providers with a Claude Code runtime automatically derive a Pi runtime (`anthropic-messages` protocol) on save, keeping API keys in an isolated credential slot injected via env vars rather than plaintext in `models.json`.
  Pi subagents run on a durable runner with built-in roles (`scout`, `reviewer`, `planner`, `worker`, `oracle`, `researcher`, `delegate`), foreground/detached execution, `mode:chain` and declarative `mode:workflow` DAGs (`dependsOn`), optional `isolation:require-worktree` (never creating hidden checkouts on large repos), and a `subagent {action:"doctor"}` health probe.
- **Cross-device Orca workers and Agent-Net v2 session layer** (`docs/orca-cross-device-worker-plan.md`, `docs/agent-net-session-plan.md`, `v0.1.145`, `v0.1.147-beta`): Orca separates **Agent host** (model/login on another computer, files local) from **Worker execution device** (entire worker task, working directory, commands, and files on another computer, while the Lead stays local and approvals route back to the Lead).
  Agent-Net v2 replaces stacked reliable transports (which caused 39 s–156 s head-of-line stalls over TCP relay) with a single priority-scheduled session layer so stop/approval/input messages jump ahead of large payload transfers.
  Smart direct-vs-relay path selection with dual latency display and automatic reconnect without losing mobile login state shipped in `v0.1.145` and `v0.1.147-beta`.
- **ACP plugin engines, read-only `/review` sandbox, and credential protection** (`v0.1.146`, `v0.1.147-beta`, commits `633df31`, `8d96d27`, `90a41c4`): ACP plugin engines now support multi-account pools, device-code login, per-directory read/write authorization, a read-only `/review` sandbox (`633df31`), automatic 30-minute idle engine release, and hardened protection of plugin-engine and Antigravity isolated account credential paths (`8d96d27`).
- **UX touches** (`v0.1.145`, `v0.1.147-beta`): cross-turn image gallery browsing across all images in a task; explicit explanation when an approval times out due to lock-screen or nobody answering (distinguished from an explicit Deny); Live Activity / Dynamic Island on iOS showing the teammate avatar (`9350751`) and avoiding stale "expired" frames.

### Candidate ideas for Outlore

- Distinguish transient errors (retry same Companion twice) from provider/quota errors (fail over immediately) in Companion fallback stacks, and record a one-line notice saying which backup took over and why.
- Distinguish an approval timeout (screen locked / unanswered) from an explicit owner Deny in thread results.
- Support a read-only `/review` sandbox mode for review errands so verification/review threads cannot accidentally edit files.
- Prioritize control frames (stop, approval response, user message) over large history/sync payloads on the paired-device relay channel (learned from Cindy's Agent-Net head-of-line blocking postmortem).
- Check Cindy's `8d96d27` Antigravity isolated-account credential protection when implementing Outlore's Antigravity multi-account batch 2.

## 3. Rakazo (`elie222/rakazo`, `rakazo.com`)

- **Pinned baseline**: last read in `inspirations.md` was site 2026-11-09, attachments 2026-11-10, and sandbox at `e64d732` (2026-11-23).
- **Read now**: `github.com/elie222/rakazo` HEAD `bbb70b6` (2026-11-27T07:14:20Z; GitHub compare against `e64d732` returned 404, indicating history rewrite or unindexed ancestor, so changes were read from releases and `CHANGELOG.md`), releases `v0.14.0` (2026-11-22) through `v0.16.0` (2026-11-24), `LICENSE`, `NOTICE`, `docs/approvals.md`, `docs/skills.md`, `docs/integrations.md`, and `CHANGELOG.md`.
- **License (verified)**: Apache-2.0 (`LICENSE` at `main` is full Apache License 2.0, with `NOTICE` crediting OpenMausBot Apache-2.0 and NousResearch MIT for Grok Bot import, and no `enterprise/` directory at root).
  This resolves the "not checked in the repository" note in `inspirations.md`.

### What is new since last read

- **How approvals are configured and prompt-injection-aware Auto Review** (`v0.14.0`, `v0.16.0`, `docs/approvals.md`): three modes (**Ask**, **Auto**, **Never ask**) plus per-tool Allow/Block lists with a **Preview** button and per-bot tool disable.
  In **Auto** mode, an approval model checks actions against the user's request and tracks taint from untrusted external content: once a run reads a web page, email, file, or another bot's message, Auto Review also gates memory/skill saves, routine edits, instruction rewrites, shell commands, page typing, and any recipient/site/payee/bank account that appeared only in read content.
  Unattended runs (routines, webhooks, bot-to-bot) expire pending approval cards after 30 minutes (`UNATTENDED_APPROVAL_EXPIRE_AFTER_MS`), while interactive chat cards stay open; sensitive actions (instruction edits, payments, saved logins, first use of the user's computer/app, autonomous bot-management changes) always ask and cannot be skipped by **Always allow**.
- **How skills learned by demonstration work** (`docs/skills.md`): **Teach a task** (web and desktop only) lets the user open the bot's computer preview, describe the goal, click **Start recording**, perform the task while typing secrets via **Protected input** (unrecorded), and click **Stop teaching**.
  The bot posts a **Draft skill** card containing the learned steps, trigger conditions, checks, and when to ask first, with **Save**, **Test**, and **Add to routine** actions.
  Skills imported from GitHub or plugins are strictly instructions-only (bundled scripts are never executed).
- **Integrations and tool sources** (`docs/integrations.md`, `v0.15.0`, `v0.16.0`): supports chat-initiated OAuth ("connect my Google Calendar"), managed app catalogs, direct GitHub/Linear/Notion connections, public MCP directory search (with an "unreviewed" warning), remote HTTPS MCP, OpenAPI, GraphQL, and local stdio MCP for self-hosters; mobile bots can read/add phone Calendar events (iOS/Android) and iOS Reminders directly without external OAuth.
  In `v0.15.0`, changing an MCP server URL strips stored bearer tokens/headers so credentials are never leaked to the new address.
- **Routines on the owner's paired computer and prompt-cache-friendly memory** (`v0.15.0`, `CHANGELOG.md`): a routine owner can enable **Use my computer** so scheduled runs use the paired desktop machine, automatically disabling the switch if the prompt, owner, bot, or paired machine changes; recurring routines skip starting a new run while the previous run is still active; recalled memory notes are placed *after* chat history to preserve prompt-cache hits; memory text is escaped before prompt injection and bot prompts are encrypted at rest (`v0.14.0`); Office `.docx`/`.pptx` attachments are supported while macro-enabled formats are refused (`v0.15.0`).

### Candidate ideas for Outlore

- Place dynamically recalled lore/notes after stable prefix content (or only on change, reinforcing Outlore's backlog item "Turn note only when changed") to preserve prompt caching, and escape lore text so saved lore cannot masquerade as instructions.
- Expire unattended Ritual approval cards after a bounded timeout (e.g., 30 min) instead of leaving them stuck forever, and prevent a recurring Ritual from overlapping an already-running instance.
- Clear stored auth headers/tokens whenever a connector or MCP server's URL is edited (security hardening for Outlore's Connectors slice).
- Keep a small "never skip with Always allow" list (e.g., changing a Ritual's instructions or elevating connector scope), and add taint-aware approval checks after reading untrusted external content.
- Consider "unreviewed" warnings when adding community MCP servers and an "instructions-only" safety note for imported skills.

## 4. Turnstone (`myturnstone.ai`)

- **Pinned baseline**: last read in `inspirations.md` was site 2026-11-09.
- **Read now**: `https://myturnstone.ai/`, `https://myturnstone.ai/changelog`, `https://myturnstone.ai/howto`, and `https://myturnstone.ai/academy`.
  `https://myturnstone.ai/pricing` returned HTTP error (curl exit 56 / non-200) and could not be read directly.
- **License**: closed source (no public repository or license found).

### What is new since last read

- **Changelog activity**: the newest entry on `https://myturnstone.ai/changelog` is still **0.8.7 (November 7, 2026)**, meaning no new public changelog releases were posted between 2026-11-09 and 2026-11-27.
  The homepage banner notes funding led by Y Combinator.
- **Answers to "Check on" items** (from `changelog`, `howto`, and `academy`):
  - **Setup agent ("Pebbles")**: `howto` names the main setup agent **Pebbles** (rather than only "Chief of Staff", which is now listed as a ready-made template in the Agent Library); users tell Pebbles what to take off their plate and it sets up and coordinates the rest of the team, and any agent can "hire" another specialist ("Agents make agents").
  - **Model switching and fallback**: `0.8.7` documents configurable fallback priority across connected AI providers/models when the current choice is unavailable, plus **Turnstone Credits** (`0.8.6`) for topping up supported models; public docs do not explain the internal mechanics of how context is carried across a mid-conversation model switch (only that shared **Brain** and conversation history stay consistent across models).
  - **Per-agent working context**: `howto` shows each Agent's Brain split into three user-editable sections: **Right now** (current focus), **How I work** (editable working-rule bullets kept in sync with saved instructions), and **Keeps** (saved context), with a toggle for whether changes to the agent's working identity require owner review.
  - **Turnstone Cloud status**: `changelog` (`0.8.6`–`0.8.7`) and `howto` describe Cloud as active for accounts with Cloud/experimental access (Cloud Schedules run while the Mac is offline; Cloud setup explains what moves and which connections need attention), not yet documented as generally available.
  - **Other `0.8.6`–`0.8.7` details**: expandable table previews on desktop and mobile, a compact one-line sidebar toggle, 1Password CLI and Composio Connect OAuth, Firecrawl OAuth MCP, and read-only X access.

### Candidate ideas for Outlore

- Expandable table previews in replies on desktop and phone (useful for wide Markdown tables in narrow panes and mobile).
- A compact one-line sidebar row option (fits Outlore's backlog item "Sidebar row anatomy and future display modes").
- Explicit "review changes to my working rules" toggle (maps well to Outlore's lore approval rules, where global lore already asks while realm/quest lore saves immediately).
- Update `inspirations.md` to note that Turnstone's main setup agent is now called **Pebbles** and that no public changelog entries have appeared since 2026-11-07.

## 5. Cookout (`mattpocock/cookout`)

- **Pinned baseline**: last read in `inspirations.md` and `documentation/research/cookout-2026-11-25.md` was commit `d78e4ac` (`v0.8.0`, 2026-11-25).
- **Read now**: `github.com/mattpocock/cookout` HEAD `f254d9e` (2026-11-26T18:56:58Z; 594 commits ahead of `d78e4ac`, largely branch merges into `v1`/`main`), `package.json` (still `0.8.0`), and ADRs `0131`–`0143`.
- **License**: still no `LICENSE` file (404 at `f254d9e`) and no `"license"` field in `package.json`.
  Remains unlicensed (all rights reserved): ideas only, no code.

### What is new since 2026-11-25

- **Local wake-on-mention Runner** (ADRs `0131`, `0133`, `0134`, `0135`, `0136`, `0138`, `0141`, all 2026-11-26): a major shift in Cookout's workflow—while the board server still spawns nothing, a new local `cookout runner start` daemon watches mentions for registered closed harness sessions (`cookout join --as <name> --wake -- <argv…>`) and resumes them one wake run at a time (e.g., `claude -p --resume {session-id}`).
  Key design details:
  - Mentions arrive on stdin as JSON (never interpolated into a shell); no token is passed in env; runs never overlap per agent, batch waiting mentions, skip already-acked mentions, catch up on start, and retry an unacked mention at most once (`0131`, `0134`).
  - Presence shows "Wakes on mention" (`?as=runner`), switches to Online during a wake run, and marks the agent **Unreachable** (plus one owner Inbox alert and a short board reply like "My wake run timed out after 10 min.") on non-zero exit or timeout (default 10 min, process-group SIGTERM→SIGKILL; `0133`, `0136`).
  - **Attended handback** (`0138`): when a human opens a live terminal `cookout watch`, the runner cleanly stands down on `watch_replaced`, polls presence every 5 s, and automatically reclaims the agent and catches up once the terminal closes and its 60 s grace expires.
  - **Per-run logs** (`0141`): JSONL event log (`runner-events.jsonl`, message IDs only, no text or tokens) plus per-run stdout/stderr files capped at 1 MiB per agent.
- **Editable thread titles on top-level messages** (ADR `0140`, commits `55cd720`, `f84b1da`, `e254d5a`): any active identity can set, edit, or clear a 1-line, ≤100-char plain-text title stored directly on the top-level message row (`PUT /v1/messages/:id/title`).
  Setting a title is explicitly not a message (no read-position move, no notifications, no `@mention` trigger), and the `cookout` skill tells agents to title threads that run long or wait on someone (`e254d5a`).
- **Keyboard-first discipline and `/schedule` composer command** (ADRs `0142`, `0143`, commit `0d3f8d3`): `/schedule` replaces the three-dot menu beside Send in the composer (`Mod+Shift+Enter` opens the Schedule dialog); `Mod+Shift+U` attaches files from any message box (`0142`); TypeScript's `MenuChoice` type now *requires* a `Shortcut` from the central keymap so no menu item can ship without a keyboard shortcut, enforced by typecheck and browser tests (`0143`).

### Candidate ideas for Outlore

- **Type-enforced menu shortcuts** (ADR `0143`): require a `Shortcut` on desktop menu-choice types (or opt-out explicitly) so keyboard accessibility stays consistent as menus grow.
- **Per-run bounded output logs + metadata-only event log** (ADR `0141`): useful pattern for debugging failed Ritual or background-check-in runs without leaking prompt text or secrets into an unbounded log.
- **Clean attended/unattended handback** (ADR `0138`): relevant if Outlore ever lets a paired CLI/terminal attach directly to a host-managed thread and hand it back cleanly on exit.
- Outlore already covers thread titles (`set_mission_title`) and local harness execution/resumption; Cookout's `/schedule` composer command is worth weighing alongside Outlore's Ritual creation flow.

## 6. Delta and Zed's DeltaDB (`delta.dev`, `github.com/zed-industries`)

- **Pinned baseline**: last read in `inspirations.md` was 2026-11-04 (DeltaDB not open source), 2026-11-11 (Delta sidebar hover actions), and 2026-11-14 (Zed One themes).
- **Read now**: `https://delta.dev/`, `https://delta.dev/deltadb`, `https://delta.dev/roadmap`, `https://delta.dev/docs`, `https://delta.dev/docs/agents/subagents`, `https://delta.dev/pricing`, `https://delta.dev/releases.rss`, `github.com/orgs/zed-industries/repos`, and `github.com/zed-industries/delta-claude` (`README.md`).
- **License**: Delta and DeltaDB remain **closed source** as of 2026-11-27.
  No `deltadb` repository exists in `github.com/zed-industries/repos`, and `https://delta.dev/deltadb` FAQ states "DeltaDB comes with Delta. Download the app, or open a shared thread in your browser." (Self-hosting DeltaDB is advertised on `delta.dev`, not open-source licensing.)
  Two companion repositories are public: `zed-industries/delta-claude` (AGPL-3.0, Claude Code plugin for DeltaDB, pushed 2026-11-26) and `zed-industries/delta-nix` (no license file, Nix flake, pushed 2026-11-26).
  Ideas only for Delta/DeltaDB; do not reuse AGPL code from `delta-claude`.

### What is new since last read

- **Delta public beta and latest release `v0.29.0` (2026-11-25)** (`https://delta.dev/releases.rss`, `https://delta.dev/roadmap`):
  - **Built-in browser tab beside the thread** (`v0.29.0`, macOS 14+): users can browse the web in a tab beside their thread, configure which links open there, and Delta's own agent can open, read, and operate those tabs.
  - **Split subthread tabs & drag-to-split panes** (`v0.29.0`): split subthread tabs to view multiple conversations alongside their parent, and drag tabs to a pane's edge to split or move.
  - **`View Diff from Here` / `View Diff from Cursor`** (`v0.29.0`): right-click any point in the transcript to see everything that changed since that message (enabled by DeltaDB's continuous edit-and-message history).
  - **Thread search filters** (`v0.29.0`): filter by own threads, subthread categories, archived threads, tags, and `from:<user>`.
  - **Claude Code plugin & Delta CLI (Beta)** (`zed-industries/delta-claude`, `delta.dev/docs`): records external Claude Code sessions and their Git checkouts into DeltaDB so teammates can open and join any thread via URL; Codex, Pi, and Zed CLI plugins are listed as In Progress on the roadmap.
  - **Roadmap items** (`https://delta.dev/roadmap`): In Progress—repository-based access, repository-level context across worktrees, sandboxing, ACP support, more CLI plugins; Up Next—Delta MCP server, agent-to-agent coordination, WSL support, conversation branching, graph view, and read/view permissions.
  - **Pricing** (`https://delta.dev/pricing`): Personal is $0 (BYOK / external agents, including Cloud Runners currently free), Pro is $10/month (shared Zed + Delta account and credits).

### Candidate ideas for Outlore

- **`View Diff from Here`** (right-click a message in a quest/errand transcript to view cumulative workspace changes since that turn): high-value review aid even without DeltaDB, using git commit/snapshot checkpoints per turn.
- **Split errand tabs beside their parent quest** (fits Outlore's desktop conversation-panes model, allowing the owner to watch a parent quest and a running errand side by side).
- **Rich search filters** (`from:`, archived, tags, errand vs. quest) in the Chronicle and quest switcher.
- DeltaDB itself is still not open source, so Outlore's backlog item ("DeltaDB could replace own copies if published as open source") remains blocked/unchanged.

## Not checked

- `https://myturnstone.ai/pricing` returned an HTTP error on curl and was not verified.
- `https://api.github.com/repos/elie222/rakazo/compare/e64d732...bbb70b6` returned 404, so Rakazo changes were reconstructed from GitHub Releases (`v0.14.0`–`v0.16.0`), `CHANGELOG.md`, and `docs/` rather than a commit-by-commit diff from `e64d732`.
- Full bodies of `intentic`'s earlier November releases (`v1.427.0` and older) and Cindy's full PR list across 1,892 commits were not read individually; release notes and authoritative architecture/plan docs were used instead.
- No upstream code was cloned, built, or run.
