# Assistants, memory products, Beads, and harness sandboxes: primary-source check (2026-11-27)

Researched 2026-11-27 against primary sources only: each product's own repository, release feeds, commits, patches, and official documentation.
Nothing was installed, built, or run locally.
Where a page rendered client-side or a check was skipped to stay within unauthenticated GitHub API limits, that gap is stated explicitly.
Per [Respect upstream licenses](../requirements.md), this note records ideas only; no code was copied.

## Claude Duet (Anthropic)

- **Sources**: product page (<https://claude.com/product/claude-duet>), announcement (<https://claude.com/resources/articles/claude-duet>), and safety article "Claude Duet Safety, Privacy, and Security" dated 2026-10-23 (<https://claude.com/resources/articles/claude-duet-safety-privacy-and-security>), all fetched 2026-11-27.
- **License**: closed (Anthropic).
  Ideas only; no code seen.
- **What changed since 2026-11-22**: the product page and announcement still describe Claude Duet as a waitlist research preview, and no newer Duet update article was found.
  The safety article—listed as unread in [claude-duet-2026-11-22.md](claude-duet-2026-11-22.md)—was read in full on 2026-11-27 and adds concrete design details:
  - **Out-of-model approval and intent check**: before sending a sensitive message, paying, or deleting, Duet shows the action, destination, content, and every recipient, and waits; a separate automated check (extended from Claude Code's auto mode classifier) runs outside the working model so prompt injections in a page cannot answer the approval card (`claude-duet-safety-privacy-and-security`, "You approve important actions").
  - **Non-waivable approvals and hard bans**: trading securities, moving money between accounts, and accessing another person's account stay off-limits even with user approval; paying or sending money, deleting an order, and creating an account can never be added to a "don't ask me again" rule, and unattended routines keep the same safeguards (`claude-duet-safety-privacy-and-security`, "You approve important actions").
  - **Two-tier discretion classifier**: a separate classifier checks outbound messages and browser file uploads into "Never share" (sign-in credentials, full card/bank numbers, government IDs—refused even if asked) and "Needs consent to share" (health or finances, where the user's own request counts as consent); when blocked, Duet can rewrite without the sensitive details and ask for approval (`claude-duet-safety-privacy-and-security`, "Your information is handled with discretion").
  - **Credential and browser isolation**: passwords entered in the in-app sign-in form (never delivered by link, SMS, or email) are encrypted with a single-use key held only on the cloud browser VM; 1Password approval handoff is listed as upcoming; connected-app tokens stay behind placeholders substituted by an external proxy (the Claude Managed Agents pattern); the browser runs in a dedicated VM driven by fixed commands so site code and cookies never reach the agent or its memory, with a distinct `User-Agent` and published IP addresses (`claude-duet-safety-privacy-and-security`, "Credentials and the browser are isolated from the model").
  - **Disconnect vs. memory**: disconnecting an app stops new access immediately, while facts already learned stay until the user resets memory in settings (`claude-duet-safety-privacy-and-security`, "You have visibility into tasks and connected apps").
  - **Adversarial routine evals**: routine-shaped evaluations run in three variants—innocent, injected instructions, and temptation to overstep (`claude-duet-safety-privacy-and-security`, "How we tested Claude Duet").
- **Candidate ideas for Outlore**:
  - Mark certain high-stakes connector actions as non-waivable (never eligible for standing "always allow" permissions), matching Outlore's `action-approval` and `connectors` specifications.
  - State clearly in the Connectors UI that disconnecting a service stops new access without erasing lore already learned from it.
  - Keep Duet's three-variant routine evaluation pattern (innocent, injected, temptation) as input for Outlore's `Thread quality eval` backlog item.
- **Not checked**: whether Duet's mobile UI changed inside the closed research preview app, or how voice input behaves on iOS/Android.

## Crest browser (`crest-browser/Crest`, formerly `pauljoda/Crest`)

- **Sources**: GitHub repository `crest-browser/Crest` (`pauljoda/Crest` now returns HTTP 301 to `crest-browser/Crest`), `main` at commit `62e3996d` (committed 2026-11-27T09:19:27Z), latest prerelease `development-0.11.70-2026-11-27-1732-r732.1`, `README.md`, and official help guides at <https://crestbrowser.com/guides/> (`/guides/coding-agents/`, `/guides/sub-spaces/`, `/guides/customize-spaces/`), all read 2026-11-27.
- **License**: MPL-2.0 (confirmed via GitHub API).
  Ideas only.
- **What changed since 2026-11-09**:
  - **Repository moved**: `pauljoda/Crest` now redirects to `crest-browser/Crest` (1,462 stars); `inspirations.md` still points to the old URL.
  - **Coding agents can drive Crest** (`/guides/coding-agents/`, commit `8a909b14` "Tell an agent when Crest is full instead of not running (#1387)"): off by default under `Settings > Agents`; enabled per Space (turning on any Space in a Sub-Space group enables the whole group); exposes tab listing/opening, page reading, clicking/typing, screenshots, and console/network inspection using existing Space sign-ins.
    On first connection, macOS verifies the caller by its **code signature** rather than the name the agent claims, lists it under `Allowed agents` with a `Forget` disconnect action, always prompts before opening a private window, and supports `open -g --env CREST_BACKGROUND_LAUNCH=1 -a Crest` so Crest launches behind the active app and surfaces only to ask.
  - **Sub-Spaces** (`/guides/sub-spaces/`): a primary Space and its Sub-Spaces share sign-ins, cookies, history, Crest Passwords, extensions, site permissions, lock, and coding-agent access while keeping separate tabs, folders, crests, colors, and browsing settings; an optional group-wide `Separate Pinned Tabs` switch decouples pinned tabs, and shared settings display `"Shared by <Primary>'s Sub-Spaces."` at the bottom of their page.
  - **Crest Studio** (`/guides/customize-spaces/`): supports both `Banner` (the eight-step Crest Studio builder, dimming colors for parts the current crest does not draw) and `Gradient` (1–3 colors with direction, intensity, and texture).
    Outlore removed realm crests in CHG-0452, so Crest Studio is no longer directly active for Outlore.
- **Candidate ideas for Outlore**:
  - For future `computer-use` browser access or paired-device trust, identify local callers by OS code signature rather than self-reported client names, and keep private/incognito actions always-prompt.
  - If Outlore ever adds grouped realms (sharing connectors or permissions while keeping separate folders and quests), label inherited settings explicitly at the bottom of each section ("Shared by …").

## Rerun (`rerun-build/rerun`)

- **Sources**: GitHub repository `rerun-build/rerun`, default branch `dev` at commit `8f625622` (2026-11-27T08:25:59Z), latest release `v0.25.0` (2026-11-26), memory commit `b5d90f66` (2026-11-18, PR #453) read via patch, `https://docs.rerun.build/concepts.md`, `https://docs.rerun.build/agents/automations.md`, and `https://github.com/rerun-build/rerun/releases.atom`, all read 2026-11-27.
- **License**: AGPL-3.0 (confirmed via GitHub API).
  Ideas only; no code reused.
- **What changed since 2026-11-06**:
  - **Memory code (`apps/engine/src/memory/`)**: exactly one commit since 2026-11-06—`b5d90f66` (2026-11-18, PR #453, `perf(memory): start the recall embedding when the hub receives the message`).
    When a user message arrives at `/api/chat` or the Chief of Staff route, the hub starts computing its recall embedding immediately without awaiting it; `/api/embed` deduplicates and caches in-flight embeddings per workspace for 30 seconds (never caching failures) so the engine joins the warm request.
    Per-turn automatic recall before calling the model waits at most **1 second** for the embedding before falling back to keyword/FTS search, while explicit `memory_recall` calls and memory writes keep a 5-second timeout (`apps/engine/README.md`, `apps/engine/src/agents/systemPrompt.ts`).
  - **Script-only scheduled routines without a model** (`docs.rerun.build/agents/automations.md`): a scheduled task can switch from a model prompt to a plain shell command (no model, no credit) with a configurable timeout (1, 5, 15, or 60 minutes, failing with exit code 124), `Notify only when it fails` on by default, and the last 64,000 characters of output kept in history.
  - **One-off scheduled tasks** (`docs.rerun.build/agents/automations.md`): fire once at a date and self-delete on success (preserving the run thread), while staying switched off on failure, stop, or pending question so the owner can inspect and rerun.
  - **Unattended runs keep approvals** (`docs.rerun.build/agents/automations.md`): a 3 AM run still pauses in `Needs you` and notifies the user instead of bypassing approvals.
  - **MCP file-backed credentials** (commit `c68de082`, 2026-11-27, PR #1025): `${file:VAR}` lets an MCP server read a secret credential as a file.
  - **Quote-reply and mobile swipe-to-quote** (`v0.25.0`, PRs #1006–#1009; `docs.rerun.build/concepts.md`): selecting text shows a `Reply` button, and swiping a bubble right on mobile quotes it, sending the quoted passage, author, and source message ID to the coworker.
  - **Cross-device open threads and Brain proposals** (`docs.rerun.build/concepts.md`): up to 8 open threads stay synced across devices with a `Continue` banner when resuming from another device; the shared Brain files pages by Box and routes coworker edits through a `Proposals` review queue.
- **Candidate ideas for Outlore**:
  - When Outlore adds semantic recall to the leaner turn preamble (`backlog.md`), pre-warm the query embedding on message receipt with a strict 1-second timeout and FTS fallback so slow embeddings never stall a turn.
  - Add a zero-model command mode (with timeout and notify-on-failure default) and one-off self-cleaning schedules to Rituals.
  - Add passage quote-reply (desktop selection and mobile swipe-to-quote) to Outlore's Slack-style conversations.
- **Not checked**: `rerun.build/features/second-brain` body beyond HTTP 200 title check (covered by `docs.rerun.build/concepts.md`).

## souls.house and hearth (`swombat/hearth`, `swombat/souls-house`)

- **Sources**: `swombat/hearth` (`master` at `11fa827f`, last pushed 2026-09-20T18:08:11Z), `swombat/souls-house` (`master` at `308b10eb`, discovered via `https://souls.house/self-host.md`), `LICENSE`, `README.md`, `https://souls.house/llms.txt`, and `https://souls.house/self-host.md`, all read 2026-11-27.
- **License**: `swombat/hearth` has **no LICENSE file** (`license: None` on GitHub; treat as all rights reserved, ideas only).
  `swombat/souls-house` is **MIT** (`LICENSE`, "Copyright (c) 2025-2026 Daniel Tenner and the souls.house contributors").
  This settles the "License: not checked" note in `inspirations.md` for `souls.house` while keeping `hearth` unlicensed.
- **What changed since 2026-11-06**:
  - **`swombat/hearth`**: no new commits since 2026-09-20 (`11fa827f`); nothing new since the 2026-11-06 review.
  - **`swombat/souls-house`**: the whole platform is now open source under MIT (Rails 8, Svelte 5 via Inertia.js, PostgreSQL, Docker).
    Each resident runs in its own Docker container on the `Chaos` harness (x86-64 Linux, no `/dev/kvm` yet), with local CPU memory embeddings (~452 MiB shared Postgres + embeddings, 31–126 MiB per quiet resident in their 2026-09-07 measurement).
    Its self-hosting path is an **agent-led runbook** (`https://souls.house/self-host.md`): operators hand the URL to Claude Code or Codex, which runs `bin/house init`, `bin/house doctor` (DNS, SSH, Docker, RAM, disk), and `bin/kamal setup` one verified stage at a time with explicit approval before spending money, erasing data, or exposing services.
    It also publishes `https://souls.house/llms.txt` and a single-file Python CLI (`souls`) over a cursor-paginated JSON API.
- **Candidate ideas for Outlore**:
  - Publish an agent-readable runbook (like `self-host.md`) and a `doctor` pre-flight check when Outlore ships its standalone background host and self-deployed relay onboarding.
- **Not checked**: `https://souls.house/features` and `https://souls.house/decisions` render via Inertia.js/Svelte on the client (plain `curl` returned only the HTML shell and `<title>`), so any recent copy changes on those two pages were not read.

## Timon (`timon-ai.com`, `docs.timon-ai.com`, `ai-timon/timon`)

- **Sources**: <https://timon-ai.com/>, <https://timon-ai.com/pricing>, `https://timon-ai.com/go/github` (302 to `https://github.com/ai-timon/timon/`), `ai-timon/timon` `main` at commit `ccfafd02b8b89d55a4e5d3fb932b781d592ef9dd`, `README.md`, `LICENSE`, `https://docs.timon-ai.com/llms.txt`, `https://docs.timon-ai.com/plugins/memory.md`, and `https://docs.timon-ai.com/usage/concepts.md`, all read 2026-11-27.
- **License**: **GNU AGPL-3.0** (`LICENSE`) with a plugin exception (`LICENSING.md`); `@timon-ai/sdk` and plugin templates are **MIT** (`README.md`).
  Ideas only for core.
- **What changed since the previous entry**: `inspirations.md` previously knew only Timon's marketing site and asked whether it published docs on how lessons and the vault are stored.
  Timon is now an open-source local-daemon multi-agent workstation (`ai-timon/timon`) with full Markdown documentation at `docs.timon-ai.com` (including `llms.txt` and `.md` mirrors for every page):
  - **Memory rules and read-only files** (`docs.timon-ai.com/plugins/memory.md`): live agent memory is stored as structured **rules** injected into prompts by scope (`agent`, `project`, `role`, `global`), kind (`pitfall`, `decision`, `preference`), and tier (including `core`), each tagged with provenance (`source: "plugin:<id>"`, `user`, or `agent`).
    Per-agent and per-project Markdown files (e.g., `notes.md`) are readable via `memory.show` but read-only to plugins—live memory enters through `rules.add`, accepted proposals, or nightly synthesis.
  - **Fresh-session invalidation on rule deletion** (`docs.timon-ai.com/plugins/memory.md`): removing a memory rule forces any agent that could have seen it to start a fresh conversation on its next mission, because the earlier transcript still contains the deleted rule.
  - **Pricing and scope** (`timon-ai.com/pricing`, `README.md`): Free for one developer on one machine with all features using the user's own CLI subscriptions (Claude Code, Codex, Grok, Copilot, opencode, Pi, Kimi, Ollama Cloud, Hermes, Antigravity, and any ACP agent); Pro (multi-user with roles, white-label, premium plugins/support) and Cloud (self-hosted team server) still show "Pricing coming soon".
  - **Other workstation features** (`README.md`, `docs.timon-ai.com/llms.txt`): background daemon (`systemd`, `launchd`, Windows scheduled task) on a Cordis plugin kernel + SQLite; `timon doctor` and `timon backends`; signed release manifest with checksum verification; overnight task series paced to quotas and quota fallbacks; built-in browser with recorded flows and visual page annotations; ACP transcript replay test helpers (`createAcpReplayPeer`, `replayTranscript`).
- **Candidate ideas for Outlore**:
  - When a lore entry is forgotten or corrected in Outlore, mark active sessions that already received it in their transcript (or offer a fresh-session reset), because the old rule remains in the harness's conversation history.
  - Tag lore entries with caller provenance (`owner`, `thread`, `ritual`) and emit change events if Outlore ever exposes lore to plugins or connectors.
  - Compare Timon's signed release manifest check and `doctor` command with Outlore's `app-updates` backlog item.
- **Not checked**: Timon's `usage/mission-isolation.md` and `usage/antigravity.md` pages, and its actual source tree beyond `README.md` and `LICENSE`.

## Beads (`gastownhall/beads`)

- **Sources**: GitHub repository `gastownhall/beads`, `main` at commit `0c9c8e69` (2026-11-27T03:32:45Z), 16 commits since the last read `78624109` (2026-11-20), release list, commit patches `86f27eab` and `5845d3c1`, and `docs/reference/faq.md` at `main`, all read 2026-11-27.
- **License**: MIT (unchanged).
  Ideas only.
- **What changed since 2026-11-25 (commit `78624109`)**:
  - **Release status**: `v1.4.0` has still not shipped; `v1.4.0-rc.4` (2026-11-20) remains the latest prerelease and `v1.3.4` (2026-11-04) the latest stable release.
  - **Telemetry**: `docs/reference/faq.md` is unchanged—anonymous command-usage metrics remain **on by default (opt-out)** via `bd metrics off`, `BD_DISABLE_METRICS=1`, or `DO_NOT_TRACK=1`.
  - **16 new commits on `main` (all landed 2026-11-27)**:
    - `5845d3c1` (`feat(show): --head prints a short view of a long issue (#7187) (#8625)`): bounded text view printing headers/labels/dependencies, the **last 1 KB of appended notes** (cut at UTF-8 and line boundaries), and the **last 3 comments**, followed by one line naming what was withheld and its byte size; refused alongside `--json` or `--long` so callers requesting a bounded view never silently receive an unbounded dump.
    - `86f27eab` (`feat(config): hooks.manage and gitignore.manage per-repo opt-outs (#8600)`): durable per-repo `config.yaml` booleans (overridden by `BD_HOOKS_MANAGE` / `BD_GITIGNORE_MANAGE`) so repos running their own hook manager stop `bd` from overwriting git hooks or `.beads/.gitignore`.
    - `c750b575` (`fix(doltserver): confine the managed server's SQL file access with secure_file_priv (#8606)`): restricts SQL file access on managed `dolt sql-server`.
    - `708992f7`, `b146be6a`, `b7c95393`, `0c9c8e69`: Dolt consistency and race fixes (minting the Dolt commit before blocked recheck, replaying a store delete that loses commit-time merge, preserving closed beads that live beads still depend on during `prune`, serializing overlapping label edits).
- **Candidate ideas for Outlore**:
  - Reuse Beads' `--head` tail-cut + explicit `"withheld N bytes"` line pattern when trimming long journals or starting contexts (`backlog.md`, "Starting context, staged from batch 17" and "A leaner turn preamble"), cutting from the tail of append-only notes so the newest state survives.
- **Not checked**: open GitHub issues for data loss and lock contention (skipped to stay within unauthenticated GitHub API limits; still open from [beads-2026-11-25.md](beads-2026-11-25.md)).

## Sandbox runtimes (checked against `sandbox-handling-2026-11-23.md`)

- **Claude Code `@anthropic-ai/sandbox-runtime`**:
  - **Sources**: GitHub repository `anthropics/sandbox-runtime` (moved from `anthropic-experimental/sandbox-runtime`, HTTP 301), `main` at commit `0bbebed0` (2026-11-12T22:34:05Z), latest release `v0.0.83` (2026-11-13), Apache-2.0.
  - **What changed since 2026-11-23**: **no new commits and no new release**; only the repository moved from `anthropic-experimental/sandbox-runtime` to `anthropics/sandbox-runtime`.
    No enclosing-sandbox check or start-time read-denial probe was added.
- **Codex (`openai/codex`)**:
  - **Sources**: GitHub repository `openai/codex`, `main` at commit `afe555b9` (2026-11-27T05:03:45Z), releases `rust-v0.172.0` (2026-11-24) through `rust-v0.174.0-alpha.8` (2026-11-26), commit patch `f22cc03b` (2026-11-24, PR #63743), Apache-2.0.
  - **What changed since 2026-11-23 (commit `a1604a8c`)**:
    - **Integrity checker**: **0 commits** in `codex-rs/exec-server/src/sandbox_integrity` since 2026-11-23; `#62389` ("Pause runtime sandbox integrity checks") shipped in `0.172.0` and remains paused.
    - **`codex doctor`**: **0 commits** in `codex-rs/cli/src/doctor` since 2026-11-23; no start-time kernel enforcement probe was added.
    - **`codex-rs/sandboxing`**: 2 commits since 2026-11-23:
      - `f22cc03b` (PR #63743, `Review saved exec escalations when read denials apply`): a saved command allow rule can no longer silently authorize broader filesystem access when read denials are active; explicit escalation requests route through Guardian while preserving read denials.
      - `1263a383` (PR #63711, `Bind sandbox CA access to the prepared managed proxy route`).
    - In `0.172.0`: shared sandbox launcher for Linux and macOS (`#62353`), piped I/O for Seatbelt commands (`#62350`), `codex exec resume` preserving saved sandbox permissions and workspace roots (`#62194`), Windows MXC sandbox launch diagnostics (`#62439`), and reserved credential permission tables in Codex configuration (`#62358`).
- **Candidate ideas for Outlore**:
  - Mirror Codex PR `#63743`'s rule in Outlore's standing permissions (`action-approval`): a standing allow rule for a command must never silently bypass Vault `denyRead` protections.
  - Update the `sandbox-runtime` repository link in future notes from `anthropic-experimental/sandbox-runtime` to `anthropics/sandbox-runtime`.

## Claude Code and Codex changelogs (harness integration)

- **Claude Code (`anthropics/claude-code`, `CHANGELOG.md` at `main`, `v2.1.330` on 2026-11-20 through `v2.1.332` on 2026-11-25; closed source)**:
  - **Skills from MCP servers (beta)** (`2.1.332`): MCP servers can expose skills shown as `server:skill` in `/` (also announced on `claude.com` on 2026-11-24).
    Relevant to Outlore's `connectors` and `tool-and-skill-loading` capabilities if vendored or user MCP servers start shipping skills.
  - **`CLAUDE_CODE_OAUTH_TOKEN` prefix update** (`2.1.332`): tokens can now end in `oat02-` as well as `oat01-`; update any log scrubber or redaction regex that matches `oat01-`.
  - **`claude -p` / SDK mid-turn messages** (`2.1.332`): from Opus 4.8 on, mid-turn messages count as the user's where feature flags are not fetched; relayed text should be marked `isSynthetic: true`.
  - **Code Mode and `claude -p` reliability** (`2.1.331`–`2.1.332`): reduced startup memory for `claude -p` and large MCP tool lists (`2.1.332`); Code Mode resume now tells Claude its earlier script variables are gone (`2.1.332`); long script output gives a path to the uncut text instead of dropping the middle (`2.1.331`); `claude auth login` now exits 1 with a diagnostic when a login cannot be saved (`2.1.332`); named-pipe reads (such as locked secrets managers mounting `.env`) time out after 20 seconds instead of hanging (`2.1.332`).
  - **Voice dictation UX** (`2.1.332`): tap-mode timeout increased from 15s silence / 2m max to **60s silence / 10m max**, leaving dictated text unsent so the next tap appends, and stopping with an explicit reason when the mic or panel drops.
  - **Model switch keeps effort** (`2.1.332`): switching models from mobile/web preserves the previous model's saved effort level when none is saved for the new model.
  - **`claude doctor` API connectivity** (`2.1.331`): reports HTTP status or error for API reachability.
- **Codex (`openai/codex`, `rust-v0.172.0` on 2026-11-24 through `0.174.0-alpha.8` on 2026-11-26; Apache-2.0)**:
  - **Lazy stdio MCP startup by default** (`0.172.0`, `#62366`): optional stdio MCP servers with cached tool lists start only on their first tool call—a strong candidate for Outlore's connector gateway startup cost.
  - **Preserving queued child-agent replies on parent interrupt** (`0.172.0`, `#62348`): interrupting a parent turn keeps queued child replies for the next turn—worth checking against Outlore's `thread-messaging` interrupt path.
  - **Immediate stream error reporting and scoped spend limits** (`0.172.0`, `#62329`, `#62356`): reports provider errors as soon as they arrive and names which API spend limit was hit—useful for Outlore's `budget-control` error handling.
  - **Per-tool approval reviewers for connected apps** (`0.172.0`, `#62360`) and **cross-OS app-server path preservation** (`#62375`–`#62377`): relevant to Outlore's `connectors` per-tool approvals and paired desktop hosts across OSes.
  - **Code Mode gRPC host connections and tool-specific JS preloads** (`0.172.0`, `#62476`, `#62430`): relevant if Outlore evolves its `run_code` Code Mode runtime.
