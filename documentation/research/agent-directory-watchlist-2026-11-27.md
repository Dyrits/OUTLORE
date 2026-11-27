# Agent directory watch list: primary-source update (2026-11-27)

Checked 2026-11-27 against primary sources (upstream repositories via `git ls-remote`, GitHub REST API, GitHub release pages, raw repository files, and official documentation sites) to record what changed since [agent-directory-2026-11-15.md](agent-directory-2026-11-15.md) and [sandbox-handling-2026-11-23.md](sandbox-handling-2026-11-23.md).
Each product below pins the commit, tag, or document URL read on 2026-11-27.
Nothing was installed, built, or run.
Ideas only; no upstream code was copied.

## Corrections to existing entries in `inspirations.md`

Two 2026-11-23 Sandbox paragraphs in [inspirations.md](../inspirations.md) are attached to the wrong products, as verified against [sandbox-handling-2026-11-23.md](sandbox-handling-2026-11-23.md):

- **agentes.chat** (line 162 of `inspirations.md`) cites commit `249dc60` ("states that the operating system is the only boundary against an adversarial model... Chromium's `--no-sandbox`... re-probes once after an update").
  Commit `249dc60308a1ea3e13e8cd281433552cd25d36ab` belongs to **Hermes Agent** (`NousResearch/hermes-agent`), not `agentes.chat`.
- **Bloks** (line 178 of `inspirations.md`) cites commit `9dae3e2` ("its `SECURITY.md` says a paired device has full control and agents run shell commands 'by default without asking'").
  Commit `9dae3e2bec9b91a4a42f85a943eb3983f95d0503` belongs to **Codync** (`leepokai/Codync`), not Bloks.
  [sandbox-handling-2026-11-23.md](sandbox-handling-2026-11-23.md) explicitly recorded that Bloks and `agentes.chat` were not opened in that check.

## Hermes Agent (Nous Research)

- **Pinned source**: [`NousResearch/hermes-agent`](https://github.com/NousResearch/hermes-agent) at commit `1d15aad1dfa8e9e5fcbd2082cad5666a0907a07d` (`main`, pushed `2026-11-27T09:42:13Z`), latest stable tag `v0.23.4` (`2026-11-24`, measured at `8fc03744473`) and canary `canary.20261125T064800Z-v0.23.4` (`2026-11-25`).
- **License**: MIT (`LICENSE`, unchanged).
  Activity: 266,514 stars and 60,469 forks (up from 263.6k / 59.4k on 2026-11-15).
- **What changed since 2026-11-15 / 2026-11-23**:
  - **Stable releases resumed**: `v0.23.3` (`2026-11-20`) and `v0.23.4` (`2026-11-24`, rolling up 229 merged PRs and 1,122 non-merge commits since `v0.23.3`), with full curated release notes deferred to `v0.24.0` (GitHub release `v0.23.4`).
  - **Desktop sandbox approval cards**: `v0.23.4` release notes list approval cards in Hermes Desktop for a sandbox's folder and site requests, plus `skills.index_desc_limit` (configurable skill index description length) and gateway clients announcing who they are so plugins can see which client sent a turn.
  - **Background idle compaction and prompt-cache keep-alives** (`main`, 2026-11-27): `170d9637ea` adds background idle compaction across every route per channel (`feat(gateway): idle chats compact in the background on every route, per channel`), measured from transcript gaps (`5b1e7de42c`); `112ec9176b` and `c38c816b55` keep a request's prompt cache warm while its reply generates, with ordering guards so late keep-alive replies never rewind a newer fold (`ed1cbc8de4`).
  - **Gateway migration**: `hermes gateway migrate --backends` moves legacy serve/dashboard backends onto the gateway (`v0.23.4`), refusing macOS system `LaunchDaemons` with manual `sudo` steps (`9385cc48e7`).
- **Candidate ideas for Outlore**:
  - Background idle compaction per quest/thread route (`170d9637ea`) complements Outlore's backlog items on leaner turn preambles and journal compression.
  - Configurable `skills.index_desc_limit` (`v0.23.4`) is a direct knob for bounding skill-index token overhead in `tool-and-skill-loading`.
  - Keep-alive prompt-cache warming while long turns run (`112ec9176b`) is worth weighing if Outlore's long-running quests suffer cache expiry between tool calls.

## Grok Bot (xAI)

- **Pinned source**: Official documentation is now live at `https://docs.x.ai/grok-bot/overview.md` (HTTP 200 on 2026-11-27; was HTTP 404 on 2026-11-15), indexed in `https://docs.x.ai/llms.txt` (35 Grok Bot pages), plus `computer-and-apps.md`, `approvals-security-and-privacy.md`, `vault.md`, `initiative.md`, `teams-and-enterprises.md`, `https://docs.x.ai/x-subscription/grok-bot.md`, and `https://docs.x.ai/x-subscription/pricing.md`.
- **License**: Closed proprietary service (no public source).
- **Open Check-on questions settled**:
  - **Shared computer confirmed** (`docs.x.ai/grok-bot/computer-and-apps.md`): "One computer, shared by all your Bots."
    Every Bot on a user's account shares the same persistent cloud computer, browser cookies, signed-in sessions, filesystem, and CLI credentials; the docs explicitly warn: "The computer is assigned to your user account, not an individual Bot. Do not place a credential or file on it if another Bot on your account should not be able to use it."
    Each Bot gets its own screen on that shared computer for parallel browser/desktop work, and the docs state that "The screens are separate work surfaces, not separate security boundaries."
    Between users, each user's computer is dedicated and hardware-isolated.
  - **Pricing and Enterprise settled** (`docs.x.ai/x-subscription/pricing.md`, `docs.x.ai/x-subscription/grok-bot.md`, `docs.x.ai/grok-bot/teams-and-enterprises.md`): Grok Bot is no longer waitlist-only for enterprises and is bundled into **The X Subscription** (unifying Grok, Cursor, and X): **Premium** ($30/mo, 4x), **Super** ($100/mo, 15x), and **Ultra** ($200/mo, 50x) include Grok Bot drawing from one shared weekly pool; Free ($0) and Plus ($8/mo) do not include it.
    Teams plans are $30 / $100 / $200 per seat (Grok Bot enabled by default, no off switch), and Enterprise admins enable it per group from `cursor.com/dashboard/bot`.
- **What else is new in the docs**:
  - **Auto Review and Vault Secure Forms** (`approvals-security-and-privacy.md`, `computer-and-apps.md`, `vault.md`): Auto Review inspects each proposed action and pauses only when approval is needed; Vault logins and Secure Forms fill credentials and cards without showing the values to the Bot, with optional per-item "Hints" ("Use for work purchases") and ephemeral chat-only expiry when "Securely save to Bot's vault" is unchecked.
  - **Bot Initiative** (`initiative.md`): only the user's primary Bot proactively offers to take on tasks and flags broken app sign-ins ("offers first and asks before risky actions"), while Team Bots ask in their Slack thread when they need a user's connected app.
  - **Mobile and channels** (`overview.md`, `vault.md`, `llms.txt`): desktop, iOS (app version 1.19.0 noted in `vault.md`), Slack, Microsoft Teams, meetings, and `@bot` on X.
- **Candidate ideas for Outlore**:
  - Vault **Hints** ("Use for work purchases") and ephemeral one-turn-only secrets (unchecked "save to vault") fit Outlore's Vault and Connectors design without exposing raw secrets to harnesses.
  - Proactive broken-sign-in notices from the primary assistant (`initiative.md`) fit Chronicler and Outlore's daily background check-ins.

## agentes.chat

- **Pinned source**: [`agentes-chat/agentes-chat`](https://github.com/agentes-chat/agentes-chat) at commit `c59090ca0f9f6f32b35a0871cfebadbfe6e0b159` (`main`, pushed `2026-11-27T09:17:01Z`), releases `v0.1.18` (`2026-11-27`), `desktop-v0.8.20` (`2026-11-27`), and `speech-helper-v0.1.0` (`2026-11-27`).
- **License**: **AGPL-3.0** confirmed in repository `LICENSE` (2,075 stars, 424 forks), with an optional commercial license (`COMMERCIAL.md`) for closed-source modifications or white-label resale.
  Ideas only, no code.
- **Open Check-on questions settled**:
  - **Repository and license**: confirmed at `agentes-chat/agentes-chat`, AGPL-3.0, self-hosted free forever with no license key (`README.md`, `SELF_HOSTING.md`).
  - **Cloud vs local architecture** (`SELF_HOSTING.md`, `v0.1.18` release): self-hosted runs as two Docker containers (Postgres 18 + pgvector and one Bun app process, plus optional Tailscale) or as a single program with an embedded database without Docker; it now also ships a **desktop app** (`desktop-v0.8.20`, contradicting the 2026-11-15 "No desktop app is listed") that connects a person's own computer so agents can drive local apps and local provider plans (Claude Code, Codex, Devin CLI).
- **What changed since 2026-11-15**:
  - **Local app control through the accessibility tree** (`628b4929d1`, ADR 0258, `v0.1.18`): agents read an app's window via OS accessibility and press buttons or fill fields without taking the user's pointer or keyboard; clicks that send, pay, publish, or delete ask for approval first, and the desktop menu bar shows which agent is using which app with a **Stop** button.
  - **Local speech helper** (`448b3b2457`, `bebcbf9663`, `c59090ca0f`, `speech-helper-v0.1.0`): a small Rust helper (`agentes-speech`, pinned per-platform by SHA-256) transcribes voice locally; the mic button always renders with an honest unavailable state and offers a one-click setup/download card (`offer_voice_setup`, `c18012d5b7`).
  - **Desktop permission and folder flows** (`v0.1.18`): requesting a folder opens the native picker on the target computer; missing macOS permissions (Full Disk Access, Screen Recording, Accessibility, Automation, App Management) are surfaced in-app with a direct link to the matching System Settings pane; asking in chat to change approval level ("always ask me first") posts a confirmation card with Undo; `.zip` skills dropped in chat install directly; iOS simulators and Android emulators can be started/stopped from Settings or by agents.
  - **Claude Code startup warming** (`4a6252f572`, `0e8e643385`): pre-warms Claude Code on restarts and when opening a conversation, and stops blocking readiness on the server's tool list.
- **Candidate ideas for Outlore**:
  - Accessibility-tree app control without stealing the pointer/keyboard plus a menu-bar indicator showing which thread is driving which app with a **Stop** button (`v0.1.18`) is directly relevant to Outlore's drafted `computer-use` capability.
  - Surfacing missing macOS TCC permissions with a direct System Settings pane link and an in-chat approval-policy change card with Undo (`v0.1.18`) fit Outlore's desktop UX and `action-approval`.
  - Honest always-visible microphone button with one-click local speech-model download (`00fa7f2ff9`, `bebcbf9663`) fits Outlore's `voice-input` and mobile dictation backlog.

## Codync (`leepokai/Codync`)

- **Pinned source**: [`leepokai/Codync`](https://github.com/leepokai/Codync) at commit `695751ab251f10b0695bb1bde660180994edfa2d` (`main`, pushed `2026-11-27T09:56:10Z`), latest release `v2.54.0` (`2026-11-27`; rapid cadence through `v2.50.0`–`v2.54.0`).
- **License**: Apache 2.0 (`LICENSE`, unchanged; `TRADEMARK.md` covers name, logo, and Codync Cloud relay).
  Activity: 2,486 stars, 262 forks.
- **Open Check-on questions settled**:
  - **Relay and push design** (`README.md`, `private-relay/README.md`): the self-hostable `private-relay` is a single Node 22.13+ process (`node:sqlite`, `127.0.0.1` only behind a reverse proxy, max 32 computers) requiring `CODYNC_PRIVATE_RELAY_TOKEN` for initial host registration and verifying every `Codync-Sig` against `CODYNC_PRIVATE_RELAY_PUBLIC_URL` (ignoring `Host` headers) so signatures cannot be replayed across relays.
    It deliberately omits accounts, TURN, and push; push stays on a separate APNs worker where the phone trades its device token for an encrypted ticket so the host only ever holds tickets and push text is sealed to the phone's key.
  - **Remote screen on Windows**: still not supported (`README.md`: "no remote screen yet").
  - **iOS version conflict**: still unresolved in `README.md` (top badge says `iOS-18+`, install section says `iOS 26+`).
- **What changed since 2026-11-15 / 2026-11-23**:
  - **Android app shipped**: Google Play link (`com.pokai.Codync.android`) is now in `README.md`, with Android pagination fixes in `v2.54.0` (`81d499a713`).
  - **Bot-owned folders, git worktree modes, and standalone threads** (`v2.54.0`): bots live in their own folder and attach projects with per-project git worktree modes (`off`, `side by side`, `always`), linking shared folders like `node_modules` and copying files listed in `.worktreeinclude`; users can also start standalone threads without a bot, with auto-cleanup retention (7, 30, or 90 days) and a desktop thread panel with multiple Browser, Terminal, and side-chat tabs (`#590`).
  - **Workflows and phone deep-linking** (`v2.54.0`, `bccb4324fb`, `d9a9899259`): workflow step notifications on phones open straight to the step ready to approve, and retry/loop/restart semantics were hardened.
  - **Network mailbox** (`0adb1a980f`, `#619`): one command gives local coding agents a Network mailbox.
  - **Sandbox note correction**: commit `9dae3e2` in [sandbox-handling-2026-11-23.md](sandbox-handling-2026-11-23.md) confirmed Codync has no OS sandbox (per-bot permission policies and approval cards only); move that bullet from Bloks back to Codync in `inspirations.md`.
- **Candidate ideas for Outlore**:
  - `.worktreeinclude` plus linking shared `node_modules` into new git worktrees (`v2.54.0`) directly addresses Outlore's worktree setup friction (`.agents/worktree-setup.sh` and `workspace-attachment`).
  - Binding relay request signatures to the configured public relay URL (ignoring `Host`) and opaque encrypted push tickets (`private-relay/README.md`, `README.md`) are concrete hardening ideas for Outlore's per-user relay ([ADR 0003](../architecture-decision-record/0003-per-user-relay-carrying-all-traffic.md)) and future push notifications.

## Bloks (`hamedgitty/bloks`)

- **Pinned source**: [`hamedgitty/bloks`](https://github.com/hamedgitty/bloks) at commit `17699a02a20ae813669c6e0a99dcfa85a5c74b48` (`main`, pushed `2026-11-26T14:16:12Z`), latest release `v3.2.15` (`2026-11-26`; releases `v3.2.11`–`v3.2.15` shipped between 2026-11-23 and 2026-11-26).
- **License**: **FSL-1.1-MIT** confirmed in `LICENSE` (each version converts to MIT two years after release).
  Ideas only, no code.
  Activity: 336 stars, 48 forks.
- **Open Check-on questions settled**:
  - **Android app shipped**: live on Google Play (`dev.bloks.app`, `README.md`, `v3.2.15` release notes); `v3.2.15` fixed member/join-request cards that mislabeled Android phones as iPhones and generalized phone wording across seven languages.
  - **Bloks Cloud email and WhatsApp**: `README.md` and `SECURITY.md` confirm Bloks Cloud carries sealed traffic it cannot read between paired devices, with two explicit exceptions that arrive readable: email forwarded to an agent's Bloks Cloud address and WhatsApp messages from Meta, with nothing retained on Bloks Cloud.
  - **Sandbox and security model** (`SECURITY.md`, `README.md` at `17699a02a2`): unlike the misattributed Codync `9dae3e2` bullet in `inspirations.md`, Bloks's own `SECURITY.md` states agents can read local files and drive a computer, with optional sandboxes, Local VMs, or Cloud boxes per agent; it also refuses non-local addresses for unauthenticated Chatterbox voice servers (loopback/private/link-local only) and lets `BLOKS_CLOUD=off` cut all `bloks.dev` calls.
- **What changed since 2026-11-15**:
  - Android app moved from "coming soon" to Google Play, with full pairing, location/place watchers, and approvals (`v3.2.15`).
  - Added `team apply team.md` for declarative room/agent sync, Composio realtime app-watcher WebSocket support, offline-cached team/skill Catalogue (`catalog/index.json`), and local/cloud voice calls + meeting notes (`README.md`, `SECURITY.md`).
- **Candidate ideas for Outlore**:
  - Refusing public-internet URLs for unauthenticated local helper servers such as TTS/dictation (`SECURITY.md`) is a clean safety check for Outlore's local voice/connector services.
  - Declarative `team apply team.md` (`README.md`) is an interesting reference for future repeatable quest/Companion team templates.

## Muse Bot — identification update

- **Status**: No standalone product named "Muse Bot" was found in primary-source searches; the original agent-directory card still has no link in this repository, so confirmation that the card meant Meta's Muse remains **unverified**.
- **Primary-source check on closest match — Meta Muse** (`https://muse.ai`, `https://about.fb.com/news/2026/09/introducing-muse-personal-ai-agent/`, both HTTP 200 on 2026-11-27):
  - Launched September 8, 2026 (initially US, now also expanded to Singapore per `about.fb.com` related post), powered by Meta's **Muse Spark** model on iOS, Android, web (`muse.ai`), and WhatsApp; closed proprietary product.
  - **Muse Secure VM**: every user's agent runs in a dedicated, isolated cloud VM with its own browser and storage.
  - **Separate Sentinel agent**: a separate system-level **Sentinel** agent runs on the same VM, kept apart from Muse at the OS level; nothing Muse does reaches the internet unless Sentinel approves it, and Sentinel prompts the user for sensitive actions (sending email, purchases).
  - **Credentials and payments**: passwords and payment methods stay in secure storage invisible to Muse (including passwords the user types into the browser); Stripe Link generates one-time-use cards with purchase protection; **Muse Confidential VM** (user-held encryption key so even Meta cannot read the VM) is announced as coming later in 2026.
- **Candidate ideas for Outlore**:
  - Separating a system-level **Sentinel** policy/egress gate from the working agent (already partially echoed by Outlore's host-side Vault and approval broker) and never exposing user-typed browser credentials to the agent are strong reference points for `computer-use` and `connectors`.

## OpenFuse (`CopilotKit/openfuse`, formerly `CopilotKit/OpenMuse`)

- **Pinned source**: [`CopilotKit/openfuse`](https://github.com/CopilotKit/openfuse) at commit `34007f164c` (pushed `2026-11-27T03:04:40Z`; `CopilotKit/OpenMuse` now HTTP-redirects here).
- **License**: MIT (`LICENSE`, unchanged).
  Activity: 6,599 stars, 978 forks.
- **Open Check-on questions settled**:
  - **Renamed and retired**: renamed from `CopilotKit/OpenMuse` to `CopilotKit/openfuse` on `2026-11-17` (`67580f1605`, `#225`), and on `2026-11-25` (`34007f164c`, `#233`) marked **no longer maintained** and **merged into OpenBot as a skin** (`Settings → Skin → OpenFuse` in `CopilotKit/OpenBot`).
- **Action for watch list**: Stop tracking OpenFuse separately; follow its successor inside OpenBot (CopilotKit) below.

## Noodle (`pdparchitect/noodle`)

- **Pinned source**: [`pdparchitect/noodle`](https://github.com/pdparchitect/noodle) at commit `68e61781fb1ab4e6c795591ebfc922e8389d5022` (`main`, pushed `2026-11-26T22:46:00Z`), latest releases `v0.98.0`, `server-v0.5.0`, `rook-v0.9.0`, `pion-v0.15.0`, and `suite-a38899c4e8fd35155831c49e` (all `2026-11-26`).
- **MAJOR LICENSE CHANGE**: On `2026-11-26` (`c1a06c033c`), Noodle switched from **Apache 2.0** to **FSL-1.1-ALv2** (Functional Source License 1.1, converting to Apache 2.0 two years after each release; earlier versions remain Apache 2.0; `Enterprise/` remains separately licensed, `ea41cd36ca`).
  Ideas only, no code.
  Activity: 361 stars, 29 forks.
- **Open Check-on questions settled**:
  - **Per-bot sandbox (`docs/security.md`)**: every bot starts in **Restricted access**; enabling **Unrestricted access** is hidden by default and requires a `defaults write com.pdparchitect.noodle AllowUnrestrictedAccess -bool true` opt-in.
    A restricted bot can only read/write its own workspace and explicitly shared folders (Read Only or Read & Write), cannot read personal files, other bots' files, Noodle's storage, Keychain, or local Unix sockets (`ssh-agent`, Docker), cannot accept incoming connections, and **fails closed** (refuses to start) if Noodle cannot apply the limit or if macOS denies Keychain access.
    `docs/security.md` explicitly states "It is not a virtual machine" and does not name the underlying macOS enforcement mechanism (Seatbelt vs separate macOS users — the secondary-review claim of separate macOS users remains **unverified** from `docs/security.md`).
  - **Approvals model**: `docs/security.md` states Noodle does **not** show approval or question forms in chat — it auto-approves tool requests within the bot's access boundary and declines questions needing typed user input.
  - **Suite expansion (`README.md`, `CHANGELOG.md`)**: now ships **Noodle Computer** (Linux, macOS, and Windows VMs, with auto-growing Windows C: disks in `68e61781fb`), **Noodle Browser** (signed-in browsers assigned to agents), **Noodle Applet**, **Noodle Hub** (share harnesses from an always-on Mac), **Noodle Server** (`server-v0.5.0`), and **Noodle Mobile**.
- **What changed since 2026-11-15**:
  - Added **GitHub Copilot** (`v0.98.0`) and **Devin** (unreleased) harnesses alongside Codex, Claude Code, FX, Grok Build, Muse Code, OpenCode v2, Antigravity, and Apple Intelligence; turns off vendor telemetry (`DO_NOT_TRACK` + per-harness settings) and strips synced claude.ai/ChatGPT account plugins and skills from bots (`4f9266b5b3`, `eb31654956`).
  - Added **daily harness session and temp-file cleanup** (`625750fdb6`, `ec35d14fe5`, `Usage → Disk → Clean Up Sessions`) deleting unused harness sessions and bot temp files older than 7 days.
  - **Harness-switch freshness** (`v0.98.0`): moving a bot to another harness or access mode starts a fresh session rather than resuming a stale session on the old harness.
  - **Centralized Claude Code token renewal** (`docs/security.md`): Noodle renews a Claude Code sign-in itself before expiry and distributes it to bots so concurrent bots do not race to refresh it.
- **Candidate ideas for Outlore**:
  - Stripping synced claude.ai/ChatGPT account skills and plugins when running harnesses (`4f9266b5b3`, `eb31654956`) directly informs Outlore's open `Harness settings isolation` backlog item.
  - Daily cleanup of stale harness sessions and temp files with a manual **Clean Up Sessions** button (`625750fdb6`) is a low-cost disk-hygiene idea for Outlore's multi-harness host.
  - Hiding unrestricted/full-access mode behind an explicit opt-in (`docs/security.md`) and failing closed when the OS boundary cannot be applied reinforce Outlore's sandbox-first stance.

## OpenBot (CopilotKit) — not nightly-labs OpenBot

- **Pinned source**: [`CopilotKit/OpenBot`](https://github.com/CopilotKit/OpenBot) at commit `109f656986` (`main`, pushed `2026-11-27T09:43:16Z`), latest releases `v1.2.0` (`2026-11-25`) and `v1.2.1` (`2026-11-27`).
- **License**: MIT for the application source (`LICENSE`, unchanged); **CopilotKit Intelligence** remains separately licensed (`README.md`).
  Activity: 13,720 stars, 1,715 forks (up from 12.4k / 1.5k on 2026-11-15).
- **Open Check-on questions settled**:
  - **Coworker isolation settled** (`README.md`): the `supervisor` container gives **each person** their own Docker container (with a per-Bot folder and browser profile inside it), and ticking **Isolated** on a specific Bot gives that Bot its own separate container.
    Containers bind to `127.0.0.1` only and require a per-container token; `COMPUTER_SANDBOX=on` enables Chromium's own sandbox where the host permits it.
    (This refines the 2026-11-15 unverified secondary claim: default is one container per person, with per-Bot containers opt-in via Isolated.)
  - **Intelligence service status** (`README.md`): local Intelligence on macOS with Docker Desktop is still labelled a preview ("not a production installation"); at boot, OpenBot checks that the Intelligence server exposes every operation it calls and names the oldest compatible version if one is missing.
- **What changed since 2026-11-15**:
  - **Merged OpenFuse as a skin** (`Settings → Skin → OpenFuse`, confirmed in `CopilotKit/openfuse` `34007f164c`).
  - **Releases `v1.2.0` and `v1.2.1`** (`CHANGELOG.md`):
    - **Web Push notifications with PWA support** (Unreleased on `main`, `a435216e98`): browser push notifications even when closed, `display: standalone` manifest for iOS 16.4+ Home Screen push, with Safari prompting to add to Home Screen rather than showing a broken button.
    - **Google sign-in for Gemini removed** (`v1.2.1`, migration `0185`): Gemini now connects with an API key only; saved Google sign-ins for Gemini are deleted on upgrade.
    - **First-message durability and persistent failure state** (`9c86234d4e`, `23ef22d37d`, `9d8b768639`, `CHANGELOG.md`): sends a new conversation's first message immediately while keeping a local copy until acknowledged, and persists `BOT_ENGINE_UNAVAILABLE` under the unanswered message across reloads instead of clearing it on the next turn.
    - **Desktop sandbox OOM vs timeout** (`5f0787cf3d`): commands killed by memory limits are never misreported as timeouts.
    - **Personal AI connections, cloud migration, and GDPR-style account deletion** (`v1.2.0`, `v1.2.1`): per-person encrypted AI connections separate from org vaults, export/import move to OpenBot Cloud, operator computer holds, and pseudonymized audit trails with 180-day purge.
- **Candidate ideas for Outlore**:
  - Distinguishing OOM kills from timeouts in sandboxed commands (`5f0787cf3d`) and persisting engine-unavailable errors under the unanswered message (`CHANGELOG.md`) are crisp reliability improvements for Outlore's thread runner and UI.
  - Keeping a new quest's first message locally until the host acknowledges it (`23ef22d37d`) prevents lost drafts over flaky mobile/relay links.
  - PWA Home Screen Web Push with an explicit iOS Safari prompt (`CHANGELOG.md`) directly informs Outlore's `Device pairing, phone web app and notifications` backlog item.

## Not checked

- Full commit logs between 2026-11-15 and 2026-11-27 for `hamedgitty/bloks` and `CopilotKit/openfuse` via GitHub REST API (unauthenticated 60 req/hr limit was reached mid-batch; HEAD commits, `README.md`, `LICENSE`, `SECURITY.md`, and latest release pages were read directly via `git ls-remote`, `raw.githubusercontent.com`, and GitHub HTML).
- Noodle's underlying Swift/macOS sandbox implementation files (beyond `docs/security.md`) to verify whether restricted bots use Seatbelt profiles or separate macOS user accounts.
- Live installation, execution, or UI inspection of any of the nine products.
