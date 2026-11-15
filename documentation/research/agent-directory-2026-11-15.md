# Agent directory products, watch notes (checked 2026-11-15)

Primary-source notes on nine products from a directory of personal and team agents, checked on 2026-11-15 for [inspirations](../inspirations.md). The aim is to watch how each runs its agents: where they run, how they are isolated, how a phone reaches them, and what the license allows. Each claim cites the page it came from; GitHub figures are as the page showed them at check time. Items marked **unverified** could not be checked against a primary source.

Products already in the inspirations file and also shown in the directory (MausBot, OpenBot by nightly-labs, Rakazo) are not repeated here.

## Hermes Agent (Nous Research)

- **Source**: https://github.com/NousResearch/hermes-agent (README and sidebar).
- **What it is**: "The self-improving AI agent built by Nous Research." MIT license. 263.6k stars and 59.4k forks at check time. No release was listed on the page.
- **Where it runs**: the README says it is "not tied to your laptop" and can run on a cloud VM, reached from Telegram. Installs on Linux, macOS, WSL2, native Windows, and Android via Termux.
- **Reach**: a single gateway process connects to Telegram, Discord, Slack, WhatsApp, and Signal; the CLI table also lists Email.
- **Memory and learning**: agent-curated memory, session search with summarisation, and user modelling across sessions (README "A closed learning loop"). It writes its own skills after complex tasks and states compatibility with the agentskills.io standard.
- **Subagents**: it spawns isolated subagents for parallel work; the desktop app sets each subagent's provider, model, and limits under Settings → Model → Subagents (repository page, "Delegates and parallelizes").
- **Note**: Codync lists Hermes Agent as one of its supported agents (see below), so it is also a harness other products run.

## Grok Bot (xAI)

- **Source**: https://x.ai/news/introducing-grok-bot (launch post, dated 2026-08-11, "Grok Bot is in beta"). xAI's docs page at docs.x.ai/grok-bot/overview.md returned **HTTP 404** on 2026-11-15, so the docs were not read.
- **What it is**: "your team of always-on agents" that sign into the user's tools and work across apps, inboxes, and websites, including platforms "with no clean API or MCP." Bots message each other, work in group chats, and can save a workflow the user demonstrates as a routine.
- **Approvals**: bots "only come back when something needs your approval."
- **Own computer or shared — conflicting**: the same post says "Bots have their own computer" and also "Bots share a computer of their own in the cloud." A secondary review reports that xAI's docs say all Bots on an account share one computer and warn twice against treating separate Bots as a security boundary. **Unverified**, since the docs page was unavailable.
- **Access**: desktop and iOS, for SuperGrok, SuperGrok Plus, SuperGrok Heavy, Cursor Pro, Pro+, Ultra, and Cursor Teams Standard and Premium. Enterprise is waitlist only. Bots have their own usage, separate from the Grok and Cursor plans. No prices in the post.
- **Source code**: none located in this check; treat as closed.

## agentes.chat

- **Source**: https://agentes.chat (home page, read in full).
- **What it is**: "a team chat where people and AI agents work together," in open beta. Agents have a role, tools, and a budget, and each is accountable to a named team member.
- **Where it runs**: the workspace is in the cloud. Each agent gets its own desktop and browser on the workspace's cloud computer, which people can watch live and take over. Web, iPhone, and Android apps. No desktop app is listed.
- **Approvals**: merges, deploys, rollbacks, and sensitive actions in connected apps wait for a person.
- **Models**: a model chosen per agent, from an API key (stored encrypted) or the user's own Claude or ChatGPT plan on the workspace computer.
- **Prices (cloud)**: Personal $29 a month; Team $49 for up to 10 people; Business $99 for up to 25. Self-hosting is free according to the FAQ.
- **License — claimed, not checked**: the page says "AGPL license" and links a GitHub organisation (github.com/agentes-chat). No repository was named or opened in this check.

## Codync (leepokai)

- **Source**: https://github.com/leepokai/Codync (README, read 2026-11-15).
- **What it is**: "The open-source Grok Bot alternative." It runs coding agents on the user's computer as persistent bots that can be messaged from a phone.
- **Where it runs**: on the user's own computer, "using the subscriptions they are already signed into"; the README says it "never calls a provider's API with your login." Bots, chats, and memory are stored locally in `~/.codync`, with transcripts in SQLite.
- **Harnesses**: Claude Code, Codex, Cursor, Pi, OpenCode, Grok Build, Gemini, Copilot, Hermes Agent, and about 40 more from the ACP registry. Claude Code, Codex, and Pi run through ACP adapters that need Node.js.
- **Phone path**: on the same network or Tailscale the phone connects directly, with no account. Pairing is a QR code from the desktop app or `codync-host pair`. An optional free account (Apple, Google, or GitHub) enables a Cloudflare relay; the README says "an account alone never unlocks a computer." Relay traffic is end-to-end encrypted, and push text is sealed to the phone's key. A self-hostable `private-relay/` is provided.
- **Phone actions**: messages, notifications, approval cards, group chats, bots asking each other for help, remote screen viewing and control (not yet on Windows), voice calls.
- **Platforms**: native SwiftUI iPhone app; Electron on macOS, Windows, and Linux; a headless host; and `codync-host tui`, including over SSH.
- **License**: Apache 2.0 for the code, with a NOTICE file (up to 2.11.0 was MIT). The name, logo, and Codync Cloud relay are governed by TRADEMARK.md.
- **Conflict**: the install section says iOS 26+, while the badge says iOS 18+.

## Bloks (hamedgitty)

- **Source**: https://github.com/hamedgitty/bloks (README, read 2026-11-15); version 3.0 per its "Bloks 3 is out" section.
- **What it is**: "Personal AI agents that live on your machine." Agents appear as chat contacts, rooms as group chats where several agents take turns with a designated lead who speaks last.
- **Where data lives**: "no backend that holds your data"; conversations, memory, and files stay on the computer. Each agent's memory is plain Markdown files. Workspaces are separate instances with their own agents, memory, keys, rooms, and folder, and can run on servers the user controls.
- **Outbound traffic**: to the engines and connectors the user configures, plus bloks.dev (catalogue, team gallery, plan status), GitHub (release checks), npm (CLI update checks), and OpenRouter (a daily price list). `BLOKS_CLOUD=off` disables the bloks.dev requests. Crash reports stay local.
- **Phone path**: an iPhone app (App Store, with Apple Watch) that is only a window onto the computer's agents; nothing runs on the phone. Pairing is by QR code or six-digit code on the same Wi-Fi, or through Bloks Cloud, where relay traffic is sealed end to end except Meta's email and WhatsApp messages, which pass through readable. Android "coming soon."
- **Runtimes**: Claude Code, Codex, Gemini CLI, Pi, OpenCode, Command Code, Devin, Grok CLI, Cursor, Cline, Antigravity; API providers; Ollama.
- **Approvals**: an agent's action waits until answered; undo, rules, and sandboxed rehearsals.
- **License**: FSL-1.1-MIT. Each release converts to plain MIT two years after it ships.
- **Conflict**: a Stork listing says macOS only with no account; the README lists macOS, Windows, and Linux. The README is taken as the primary source.

## Muse Bot — not identified

- **Status**: no product named "Muse Bot" was found in two searches. The directory card has no link in the notes.
- **Closest match, unconfirmed**: Meta's Muse, launched 2026-09-08 for U.S. adults, which runs each user's agent on its own virtual machine, asks for approval before acting, and pays through a Stripe-built wallet (secondary coverage only). Noodle's harness list includes "Muse Code," and OpenMuse calls itself a Meta Muse alternative, so the name is in use.
- **Needed**: the card's link, to check the real product.

## OpenFuse (CopilotKit) — repository named OpenMuse

- **Source**: https://github.com/CopilotKit/OpenMuse. The page's README presents the product as **OpenFuse**, and its clone command uses `OpenMuse.git` into a folder named `openfuse`. The name mismatch is unexplained.
- **What it is**: "A personal agent with a browser, terminal, files, and work that keeps going, built with CopilotKit and AG-UI." MIT license; CopilotKit Intelligence, a separate service, is not included. Labelled "Alpha, for self-hosting and building on." 6.5k stars, 953 forks, 145 commits; no release or commit dates shown.
- **Browser**: persistent Chromium profiles, reading of public pages, a takeover console with live screenshots, PDF import.
- **Terminal**: optional Linux container, 30-second command limit, saved command receipts.
- **Isolation (as stated)**: a nonroot container with "no host-directory mounts or credentials," "not a full operating-system VM"; a named `/workspace` volume; terminal networking disabled, with web access through a token-protected browser worker (token at least 32 characters).
- **Auth**: one owner signs in with a shared access key, which the README says "is not a multi-tenant authentication system." The API needs the Docker engine, a privileged dependency.
- **Relation to OpenBot**: the README says the project is "independent of OpenBot" and includes a disabled, pinned OpenBot adapter; live bridging is future work.

## Noodle (pdparchitect)

- **Source**: https://github.com/pdparchitect/noodle (README, read 2026-11-15).
- **What it is**: "Personal AI agents for your Mac, iPhone and iPad." Each agent keeps its own workspace, backstory, and history. Its About line calls it a "grok bot alternative" and a "muse alternative."
- **Where it runs**: on the Mac by default. Noodle Hub, a companion for an always-on Mac, runs bots "entirely on the Hub," with sign-ins kept there, so Hub bots cannot use the tools on the user's Mac. "The Mac stays awake while this is on."
- **Isolation (as stated)**: "restricted by default, with per-bot folder sharing"; Noodle Server runs each bot "in a sandbox of its own." How the sandbox works is not stated on the page. A secondary review says each agent gets a separate macOS user account — **unverified**.
- **Phone**: Noodle Mobile, in TestFlight beta, chats with a Hub or the user's own Mac, if the user enables "Let My Devices Reach This Mac."
- **Harnesses**: Codex, Claude Code, Grok Build, Muse Code, OpenCode v2, Antigravity, and Apple Intelligence on device.
- **License**: Apache 2.0, except the `Enterprise/` folder under PolyForm Small Business License 1.0.0.
- **Activity**: 286 stars, 26 forks, 96 open issues, 9 open pull requests, 2,212 commits; no release listed.
- **Requirements**: macOS 26 for the main app and Hub; macOS 15 for the Applet.

## OpenBot (CopilotKit) — not the nightly-labs OpenBot

- **Sources**: https://github.com/CopilotKit/OpenBot (repository, read 2026-11-15) and https://open.bot (the site; copilotkit.ai/openbot redirects there). The name collides with the nightly-labs OpenBot already listed in [inspirations](../inspirations.md).
- **What it is**: "Open-source AI coworkers that each get a computer of their own": each gets a browser, files, and tools; actions are checked before they run and recorded afterward. MIT for the application template; CopilotKit Intelligence is licensed separately. 12.4k stars, 1.5k forks, 1,224 commits; no dates on the page.
- **Install**: a desktop app for Mac and Windows; from source, Docker, Bun 1.4+, a CopilotKit account and a model key (OpenAI default, Anthropic and Google also supported), run with `scripts/start.sh` on localhost:3010; a single Docker image (`ghcr.io/copilotkit/openbot`); a Helm chart for Kubernetes. The Helm example is single-user, so anyone who can reach it is an administrator.
- **Governance (per the site)**: tool access set per Bot, per role, and per person; policies allow, require approval for, or block; an audit trail with SIEM export; SSO, SCIM, and on-behalf-of tokens; spend and token limits per Bot, role, or person.
- **Stated status**: the local Intelligence install is "a preview for macOS with Docker Desktop, not a production installation." iOS, Android, Slack, Teams, and OpenBot for Business are "Early access"; web is "Coming soon." The repository never uses the word alpha.
- **Isolation**: the site does not say how each coworker is isolated. A secondary review describes a container per coworker with its own `/workspace` volume and Chromium profile — **unverified**; check the source.
- **Versions referenced**: v1.0.2 (Helm example) and v1.0.3 (source setup notes).
