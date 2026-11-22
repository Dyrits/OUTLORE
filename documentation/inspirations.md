# Inspirations

Products Outlore follows for ideas. For each: what it does well, what Outlore took or may take, and what to check on at the next review. Ideas are written independently and follow [Respect upstream licenses](requirements.md); code is reused only where a decision record allows it.

Review this list when starting a capability, and every few weeks: read each product's changelog, releases, or documentation, and add what is new below with its date. Record a taken idea in the capability's specifications and the changelog; put a candidate in the [backlog](backlog.md).

## Agent workspaces and harnesses

### OpenBot

- **Good ideas**: an agent panel per agent; installing and updating each harness's command-line tool from its official package, checked against the published hash; how permissions are asked of casual users.
- **Taken**: harness installs and updates ([architecture](architecture.md)); the thread panel idea ([backlog](backlog.md)); built-in safe git (CHG-0032 in the [changelog](changelog/0.1.0-Prototype.md)); (2026-11-07) the window's look: a sidebar on a grey frame beside a raised panel, a neutral palette with one blue accent, tinted state pills, and a composer with its pickers inside (CHG-0056).
- **Attachments** (2026-11-10, from its source `nightly-labs/openbot`): a file added to a message is first written to a managed drafts folder; sending moves it to a transfers folder with a manifest (name, type, size, sha256), and the message carries cards that survive the file's deletion ("file not found"); limits of 10 files, 100 MB each, 250 MB in all; Codex-style `localImage` items turned into base64 `image` blocks for ACP; Claude Code receives only a text list of local files; image or plain file is told by extension, so HEIC and TIFF are never sent as images. Taken: upload first then reference, and cards that outlive the file (CHG-0102).
- **Multiplayer** (2026-11-14, from its source and docs at commit `b51a1aa`, release 0.70.0; nothing copied; full notes with citations in [research/openbot-multiplayer.md](research/openbot-multiplayer.md)): people share a host, not only agents. Accounts use one-time email codes; memberships, invitations and logical sessions live on Cloudflare Workers and D1, and everything else stays on the host. Roles are owner, admin, and member, plus host-side custom roles that give each member a level per agent (none, view, chat, manage). Invitations are single-use or permanent links, revoked when their creating admin loses authority. A client gets a short signed ticket from the account service, connects over WebRTC (directly or through the project's coturn relay) with a handshake that binds the ticket, a client key, a pinned host key and the transport fingerprints; Signal relays only setup messages, and Cloudflare never carries chats, files, or commands. A channel chat is shared by every member who can see it, but its "task owner" is an agent, not a person: any member can send, stop, resume, reassign (to another agent) or cancel, commands to one channel are applied one at a time, and only archive, restore, delete and clearing history need owner or admin. Delegation is agent to agent. Approvals are first answer wins, with a conflict answer for the other client, and dangerous actions are for owner and admin only. A member's turn runs on the host with the host's providers and the agent's own access; a role only decides which agents a member sees and can talk to. Removal ends the member's sessions and makes every connected member reconnect; I found no cancellation of the removed member's queued or running turns. Current Team API protocol is 9 (versions 4 and 8 are only the minimums for OpenCode and Hermes agents); the README's "WebRTC protocol v3" could not be matched to the code. Taken: none yet. Compare with the multiplayer items in the [backlog](backlog.md): its person-authored-request rule for powerful channel tools bears on telling a guest's request from untrusted input, its role-changes-close-sessions rule on downgrading a guest, and its direct-then-relay transport on how guests reach a host.
- **Browser** (2026-11-18, from its source and docs at commit `67d0a82`, release 0.73.0; nothing copied; full notes with citations in [research/openbot-browser-2026-11-18.md](research/openbot-browser-2026-11-18.md)): agents drive the Chromium inside its own Electron app, tab by tab, through the built-in CDP debugger, not Playwright or a separate browser; a VPS runs the whole app under a virtual display (or the whole host in a Docker image), so no browser is downloaded. The agent reads a bounded accessibility-tree snapshot with short element refs, plus separate screenshots, and can run a sandboxed script of many steps in one call; tools reach each provider through its own tool channel, not MCP over a network. The default profile is one persistent profile shared by every agent (own or named profiles and per-profile proxies are optional); there is no per-site prompt and no address filter that I found, only a first-fill approval per card and page. "User control" is one map from tab to holder: while a person holds a tab the agent's calls wait, then get a fixed "the page may have changed" answer; holds end with the session, a disabled or removed member, and are refused while a secret is entered. Phones watch a CDP screencast as JPEG frames on a socket inside the WebRTC link and send input as fractions of the frame. Taken: none yet. Compare with the computer-use entry in the [backlog](backlog.md) and [research/computer-use-alternatives.md](research/computer-use-alternatives.md).
- **License**: PolyForm Noncommercial 1.0.0. Ideas only, no code ([0001](architecture-decision-record/0001-new-codebase-not-a-fork.md)).
- **Check on**: its memory, routine, and approval features, as the closest product to Outlore; its team features, especially whether a removed member's running turns get cancelled, whether a channel gains per-member checks on task controls, and what the README's "WebRTC protocol v3" means.

### MausBot

- **Good ideas**: runtime event and driver contracts, an ACP client and vendor adapters, Claude Code and Codex drivers, a delegation-tree state machine, process and recovery helpers.
- **Taken**: these modules may be cherry-picked under Apache 2.0 with their notices ([0001](architecture-decision-record/0001-new-codebase-not-a-fork.md)).
- **Attachments** (2026-11-10, from `milind-soni/OpenMausBot`): paste, drop, and a picker; Electron's native `clipboard.readImage()` keeps the Paste item enabled for images; uploaded over HTTP, the message carries `<attached-image path>` tags; Claude Code gets a base64 block, Codex an `image` item with a data URL (its box could not see paths), ACP an `image` block only when `promptCapabilities.image` is true, with a clear error otherwise; 10 MB per image, 10 per turn.
- **License**: Apache 2.0, except its `enterprise/` folder, which is not used. Its brand is not reused.
- **Check on**: new versions of the drivers Outlore takes code from.

### Paseo

- **Good ideas**: a relay Worker with end-to-end encryption; an Electron window that loads the Expo app's web build.
- **Taken**: the relay and its encryption ([0001](architecture-decision-record/0001-new-codebase-not-a-fork.md), [0003](architecture-decision-record/0003-per-user-relay-carrying-all-traffic.md)); the desktop shell approach ([0004](architecture-decision-record/0004-electron-desktop-shell.md)). Its shared, project-run relay was rejected.
- **Attachments** (2026-11-10): paste listener on web and Electron, a native paste module on mobile; the image travels as base64 inside the WebSocket message (the same path serves the phone through the relay); Claude Code gets a base64 block, Codex a temp file (mode 0600) as `localImage`; no capability check for ACP, so an unsupported type reaches Claude as a silent skip.
- **Connection and folders** (2026-11-12, from its source, nothing copied): a client reaches a daemon directly (a chosen listen address, optional password), through an SSH tunnel, or through the relay, which stays off until the owner enables it and pairs with a QR code or link carrying the daemon's public key; each saved host has its own connection and a host menu switches between them. Its "Add project" flow starts with the host and offers only what that host supports (`canBrowse`, `canCreateDirectory`); the folder picker is a type-to-search run by the host, with suggestions from folders the agent sessions of the last 30 days used, and a two-step New folder. Its production relay is now a separate distributed Elixir service and the Cloudflare one in its repository is "legacy code and is not deployed" (reason not stated). Taken for Outlore: the host-aware folder picker and its suggestions ([device-pairing](capabilities/device-pairing/specifications.md), CHG-0202); the relay's history is a risk noted in the [draft](capabilities/device-pairing/draft.md).
- **Daemon** (2026-11-14, from its source at `42c7b7f`, nothing copied): the daemon is plain Node, run by the desktop app on Electron's own Node (`ELECTRON_RUN_AS_NODE`), and also shipped as an npm CLI and a Docker image; the desktop app attaches to a running daemon or starts one detached, and a "keep running after quit" setting, off by default, decides whether quitting stops it; no login service, so it does not come back after a restart; a PID file with a heartbeat keeps one daemon per data folder, and a per-start token file readable only by the owner lets local clients in; terminals run in their own worker that outlives daemon restarts. Details and citations in [research/paseo-daemon.md](research/paseo-daemon.md).
- **License**: Apache 2.0 (checked in its repository, 2026-11-12).
- **Check on**: relay and encryption changes; why its Cloudflare relay was retired.

### T3Code

- **Source review** (2026-11-15): [primary-source notes](research/t3code.md) pin `pingdotgg/t3code` at `0de6ddb8235debee8c7119343e1a4da9cd8b5de8`, whose server and desktop packages say 0.1.9. The current project includes an independent host, OS-managed background services, app-owned delegated threads with independent model choices and messaging, portable conversation handoffs, scheduled tasks, and beta guest and peer-machine features. It is not accurately described as only a Codex chat interface.
- **Potential reuse**: compare its implemented host lifecycle, service updates, host-owned terminals, Git/worktree tools, and delegation with the corresponding Outlore plans before building them independently. Shared TypeScript/Effect choices make it worth inspecting, not automatically interchangeable.
- **Constraints**: managed T3 Connect uses a trusted broker and account authentication; the inspected path is not Outlore's account-free, application-layer end-to-end encrypted relay. Its portable handoff also has a bounded message history, not complete tool/session-state transfer. See the [comparison](research/outlore-t3code-comparison.md) before treating a similar feature name as equivalent behavior.
- **Taken**: no code or architecture change. This is research, not approval to fork, migrate, or add a service.
- **License**: MIT at the inspected commit; preserve its copyright and permission notice if code is later reused. Any reuse still needs the project's architectural decision and dependency/license checks.
- **Also found**: threads without a project (per-thread scratch folder, promotable to a project), comparable to the Borderlands' scratch folder; no per-project or per-thread memory was found, so scoped lore stays a real difference.
- **Check on**: how a local/self-hosted installation can meet Outlore's access and cost requirements, the stability of guest/peer features, and whether its app-owned delegation can carry Outlore's quest, lore, and budget rules without maintaining a second orchestration system.

### Delta and Zed's DeltaDB

- **Good ideas**: a handover that replays the full history to the new harness; version control for agent edits and conversations (DeltaDB).
- **Taken**: full-history handover ([0006](architecture-decision-record/0006-handover-replays-full-history.md)).
- **License**: Delta is closed, so ideas only. DeltaDB is not open source as of 2026-11-04.
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
- **License**: MIT (sandbox, CLI, workspace, platform). Code may be reused with its notice where a decision record allows it.
- **Check on**: its [changelog](https://intentic.dev/changelog/), [releases](https://github.com/intentic/intentic/releases), and [docs](https://intentic.dev/docs/), especially UI changes and whether it adds nested agents or threads. Its name is close to "Intent", a candidate for Outlore's mission term.

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
- **License**: Apache 2.0 according to its site; not checked in the repository. Ideas only until it is checked.
- **Check on**: its [docs](https://rakazo.com/docs/), [releases](https://github.com/elie222/rakazo/releases), and [integrations](https://rakazo.com/integrations/), especially how skills learned by demonstration are stored and how approvals are configured.

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
- **License**: closed, as far as its site shows: no source or license is published. Ideas only.
- **Check on**: its [changelog](https://myturnstone.ai/changelog), [how-to](https://myturnstone.ai/howto) and [academy](https://myturnstone.ai/academy) pages, especially how a model switch carries context and how the Chief of Staff sets up Agents; and whether Cloud ships.

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
- **License**: Apache 2.0 according to its site; not checked in the repository. Code may be reused with its notice where a decision record allows it, once checked.
- **Check on**: its [docs](https://github.com/makecindy/cindy/tree/main/docs) and [releases](https://github.com/makecindy/cindy/releases), especially its Pi harness, how it moves a task between devices, and how the review step is wired; as the open-source product closest to Outlore's multi-harness tree.

### Watch list from an agent directory (2026-11-15)

Nine products added on 2026-11-15 from a directory of personal and team agents, to watch how each runs its agents, not only what it offers. Each claim is cited in [research/agent-directory-2026-11-15.md](research/agent-directory-2026-11-15.md). MausBot, OpenBot (nightly-labs) and Rakazo, also in that directory, are already above.

#### Hermes Agent ([source](https://github.com/NousResearch/hermes-agent))

- **What it is**: a self-improving agent from Nous Research, MIT, running on a laptop or cloud VM, reached through one gateway from Telegram, Discord, Slack, WhatsApp, and Signal.
- **Good ideas**: skills written by the agent after complex tasks; memory the agent curates, with user modelling across sessions; subagents for parallel work, each with its own provider, model, and limits.
- **Taken**: none yet.
- **Check on**: its subagent and memory design against Outlore's lore scopes; Codync runs it as a harness, so it may appear in more places.

#### Grok Bot (xAI)

- **What it is**: always-on AI teammates that work across apps, inboxes and websites, including ones with no API; beta since 2026-08-11; on desktop and iOS with SuperGrok and Cursor plans; no public source found.
- **Good ideas**: a workflow the user demonstrates saved as a routine; bots messaging each other and working in group chats; interrupting the user only when an approval is needed.
- **Taken**: none yet.
- **Conflict**: the launch post says both "own computer" and "share a computer"; xAI's docs page returned 404 on 2026-11-15, so the shared-computer claim from secondary coverage is unverified.
- **Check on**: the docs page, to settle whether Bots share one machine; prices and the enterprise waitlist once out of beta.

#### agentes.chat ([site](https://agentes.chat))

- **What it is**: a team chat where people and AI agents share channels, in open beta; each agent has a role, tools, a budget, and a named person accountable for it; agents on iPhone and Android and on the web.
- **Good ideas**: a named accountable person for each agent; approvals for merges, deploys, rollbacks and connected-app actions; agents picked for a message without an @mention.
- **Taken**: none yet.
- **License**: the site says AGPL; the repository was not opened to confirm it.
- **Check on**: the GitHub organisation, for the license and repository; how its cloud computer per agent compares with Outlore's local-first stance.

#### Codync ([source](https://github.com/leepokai/Codync))

- **What it is**: runs coding agents on the user's own computer as persistent bots, with an iPhone app; Apache 2.0 from version 2.11.0 (MIT before); Claude Code, Codex, Hermes Agent and about 40 more.
- **Good ideas**: pairing by QR code with no account on the same network or Tailscale; the relay optional and end-to-end encrypted, with an account alone never unlocking a computer; push text sealed to the phone's key; approval cards on the phone.
- **Taken**: none yet.
- **Check on**: its relay and push design against the per-user relay in [0003](architecture-decision-record/0003-per-user-relay-carrying-all-traffic.md); remote screen on Windows; the iOS version the README gives (26 in the install section, 18 in the badge).

#### Bloks ([source](https://github.com/hamedgitty/bloks))

- **What it is**: a desktop app of personal agents that live on the user's machine, as chat contacts with Markdown memory, and rooms where agents take turns under a lead agent; version 3.0; FSL-1.1-MIT.
- **Good ideas**: a lead agent who speaks last in a room; memory kept as plain Markdown files the user can open; separate workspaces, each with its own agents, keys, rooms and folder; a phone app that holds nothing and only shows the computer's agents.
- **Taken**: none yet.
- **License**: FSL converts to MIT two years after each release; ideas only until a decision record allows code.
- **Check on**: how Bloks Cloud relays email and WhatsApp (readable there, unlike other traffic); the Android app; a Stork listing says macOS only, which the README contradicts.

#### Muse Bot (not identified)

- **What it is**: a U.S. personal agent card in the directory with no product link; no product named Muse Bot was found. Meta's Muse, launched 2026-09-08, is a possible match but unconfirmed.
- **Taken**: none yet.
- **Check on**: the card's link first; then look at what it does for its users.

#### OpenFuse ([repository](https://github.com/CopilotKit/OpenMuse))

- **What it is**: a self-hosted personal agent with its own Chromium browser, an optional Linux terminal in a container, and files; MIT; labelled alpha. The repository is named OpenMuse, but its README calls the product OpenFuse.
- **Good ideas**: a container with no host-directory mounts or credentials; terminal networking off, with web access only through the browser worker; saved command receipts; PDFs moved between the computer and the app.
- **Taken**: none yet.
- **Check on**: whether the repository is renamed; the separate Intelligence service it needs; its statement that the shared access key is not multi-tenant authentication.

#### Noodle ([source](https://github.com/pdparchitect/noodle))

- **What it is**: personal agents on the Mac, with Noodle Hub for sharing from an always-on Mac and Noodle Mobile in TestFlight beta; Apache 2.0, except an Enterprise folder under PolyForm Small Business; macOS 26.
- **Good ideas**: restricted by default, with per-bot folder sharing; each agent keeping its own workspace, backstory and history; Hub bots that run on the Hub without the Mac's tools.
- **Taken**: none yet.
- **Check on**: how its per-bot sandbox works, which its page does not say (a secondary review claims separate macOS users, unverified); the Hub's status.

#### OpenBot (CopilotKit)

- **What it is**: open-source AI coworkers that each get a computer of their own; an MIT application template with a desktop app for Mac and Windows and a Helm chart; 12.4k stars; site at open.bot. A different project from the nightly-labs OpenBot above.
- **Good ideas**: tool access set per bot, per role and per person, with allow, approval or block; approvals in chat; spend and token limits per bot, role or person; an audit trail that exports to a SIEM.
- **Taken**: none yet.
- **Stated status**: the local Intelligence install is "a preview ... not a production installation"; the iOS, Android, Slack and Teams apps are early access.
- **Check on**: how each coworker is isolated (the site does not say; a secondary review claims a container per coworker, unverified); the separately licensed Intelligence service.

### Claude Duet ([product](https://claude.com/product/claude-duet), [announcement](https://claude.com/resources/articles/claude-duet))

- **What it is**: Anthropic's proactive agent app, a research preview opened by waitlist on 2026-10-21 (US Pro, Max, Ultra): a standalone iOS and Android app (and claude.ai) where Claude comes to the owner — a short morning brief across connected apps, messages only when something needs attention, tasks handed over by text or voice that keep working on its own cloud computer, and a wait for approval before it sends, pays, signs, or deletes. One ongoing thread carries the owner's Claude memory, skills, and connectors.
- **Good ideas** (from its product page and announcement, read 2026-11-22; claims cited in [research/claude-duet-2026-11-22.md](research/claude-duet-2026-11-22.md)):
  - the phone as the place that says what needs you: a morning brief, then quiet until something needs a decision — attention as the home, not a chat list;
  - the count of what waits reaching the owner from every screen (its app icon), so nothing is opened just to check;
  - "it shows you exactly what it's about to do and waits for your approval" — important decisions stay with the owner, on the phone;
  - you can see what it is doing and steer it while it works, and it messages you when work is done or needs review.
- **Taken** (2026-11-22, [CHG-0647](changelog/0.2.2-Pre-Alpha.md)): the phone menu opens the Chronicle with its unread badge, the narrow top bar's menu button carries the same count, and Back from a Chronicle-opened quest or errand returns to the Chronicle — the attention-first phone loop. The morning brief was already Outlore's: daily background check-ins post to realm Missives.
- **License**: closed (an Anthropic product). Ideas only; no code seen.
- **Check on**: the announcement and its safety article for how approvals and the see-what-it-does view evolve, whether voice input grows on the phone, and how the Duet app and the main Claude app come together.

## Interface and design

### Crest ([crestbrowser.com](https://crestbrowser.com), [source](https://github.com/pauljoda/Crest))

- **What it is**: an open-source browser for Mac, iPhone, and iPad (SwiftUI; Chromium and WebKit on Mac). Its main idea is **Spaces**: work, home, research, or a private session, each with its own cookies, history, tabs, credentials, settings, and sync identity, and **Sub-Spaces** that share sign-ins within a group.
- **Good ideas** (from its README, 2026-11-09):
  - **Crest Studio**: each Space has a crest on its sidebar background, designed from a template through steps (shape, field, band, emblem, border, finish, sidebar), each step choosing among previews of the user's own crest, with Shuffle and Undo;
  - every part of the crest has its own color, named by what it paints;
  - emblems from heraldic artwork, emoji, monograms, or a searchable symbol picker;
  - an Appearance page with presets, live preview, and per-setting reset.
- **Taken** (2026-11-09): Outlore used a crest for each realm and a Crest Studio to choose the shape, colors, band, trim, and heraldic emblem.
  The emblems came from game-icons.net under CC BY 3.0.
  [CHG-0452](changelog/0.1.9-Prototype.md#chg-0452--2026-11-18--realm-crests-are-removed-from-the-contracts-the-service-and-the-app) removed the crest system.
- **License**: MPL-2.0. Ideas are written independently; the crest figures carry their own CC BY 3.0 credits. Check the license's file-level terms before copying any of its files.
- **Check on**: its [releases](https://github.com/pauljoda/Crest/releases) and [guides](https://crestbrowser.com/guides/), especially new Crest Studio steps or emblem sources, and whether Sub-Spaces (shared sign-ins across a group) suggest grouping realms.

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
- **Check on**: changes to its memory code (`apps/engine/src/memory/`), its [second brain](https://rerun.build/features/second-brain) page, and its [concepts](https://docs.rerun.build/concepts.md) and [automations](https://docs.rerun.build/agents/automations.md) documentation.

### souls.house and its hearth guide ([souls.house](https://souls.house), [hearth](https://github.com/swombat/hearth))

- **Good ideas**:
  - journals compressed in steps: days into weeks, weeks into months, months into years, keeping the raw entries;
  - append-only writes, so several instances can write at once;
  - honest skips: when nothing is worth keeping, the agent keeps nothing;
  - a memory node as a pointer: a one-line summary, why it mattered, an importance set when created, and a link to the journal entry;
  - recall that strengthens what it finds; the closest match always first, and rare words (in three memories or fewer) pulling their memories forward;
  - capsules: sealed notes that come back on a date or condition, which the agent then raises, holds, or dismisses;
  - model changes never silent, memory export, nightly backups, and a public [decisions](https://souls.house/decisions) page explaining each choice and what would change it.
- **Taken** (2026-11-06): honest skips, recording an intel's origin, rare-word ranking, and history with undo ([scoped-intel](capabilities/scoped-intel/specifications.md)). Journal compression and capsules are in the [backlog](backlog.md).
- **License**: not checked. Ideas only until it is.
- **Check on**: its [features](https://souls.house/features) and decisions pages, and the hearth guide's narrative memory (`docs/05-narrative-memory.md`) and mnemodyne (`docs/12-mnemodyne.md`) notes.

### Timon ([timon-ai.com](https://timon-ai.com))

- **Good ideas** (from its marketing site only): every lesson becomes a rule for the next run; agents read a local notes vault before they act; every run leaves a trace that can be replayed step by step.
- **Taken**: none yet. Rules as a never-fading intel kind match its first idea.
- **Check on**: whether it publishes documentation on how lessons and the vault are stored, and its [pricing](https://timon-ai.com/pricing) page for new features.

### Delta conversation terminals, checked 2026-11-10

Delta's [terminal documentation](https://delta.dev/docs/agents/terminals) describes `!` on an empty composer line opening a shell, ordinary exclamation marks staying text, and sending a frozen terminal snapshot while its process continues.
The owner's screenshot shows that snapshot as a terminal block inside the owner's message, with accompanying text beneath it.
Outlore takes that interaction independently, using the owner's home folder without a realm and the realm root with one, as the owner requested.
No Delta code was copied.
