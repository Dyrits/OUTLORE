# T3 Code and Paseo: connectors, MCP servers, plugins and tool sources

Researched 2026-11-25 for the quest "Add many connectors", as one part of an inventory of the connectors that OpenBot, T3 Code, Paseo and other products offer.
Ideas and facts only; no code was copied and nothing below is Outlore code.
[T3 Code](t3code.md) and the [Paseo daemon](paseo-daemon.md) notes cover other topics, and the [ACP note](acp-antigravity-t3code-paseo-2026-11-24.md) already covers how both pass MCP servers over ACP, so this note does not repeat them.

## Question

What do T3 Code and Paseo offer that is a connector, MCP server, integration, plugin, skill or tool source for their agents (configuration screens, bundled servers, registries, presets, how MCP servers reach each provider's agent), and what could Outlore reuse to add many connectors?

## Answer in brief

- **Neither product ships a connector catalogue in its core.** Both let each coding agent keep its own MCP configuration and only add their own MCP server on top, so a user's Gmail or Linear connection lives in Claude, Codex or Cursor, not in T3 Code or Paseo.
- **T3 Code** offers: its own MCP server for outside agents (95 tool declarations, OAuth sign-in, a Read only access level), a secret provider (1Password), eight source-control integrations, a Linear issue tracker (personal API key), an in-thread MCP sign-in relay for Claude and Codex, MCP Apps rendering, and the ACP Registry of agents.
- **Paseo** offers: its own MCP tool catalogue (40 tools plus 23 browser tools), a plugin system with a hook that injects MCP servers into agents, Paseo Hub (hosted or self-hosted) with scoped Slack, Discord and GitHub tools and trigger sources, 17 bundled plugins (usage sources and agent providers), and a registry of 640 community plugins, of which a small number are real connectors.
- **The most reusable find is a community Paseo plugin, `itsjustanks/paseo-mcp` (MIT), and its data file**: 31 vendor-documented MCP servers in code, plus a separate MIT gallery of 69 servers in the official MCP Registry `server.json` shape, each with an authentication kind and, for 14 of them, a "cannot be added in one click" reason.
  Its data, not its code, is what Outlore would use: this note's table of 81 distinct endpoints is built from it.
- **Gate for Outlore:** 57 of the 69 gallery servers use OAuth with a browser sign-in, and Outlore's connector backend today sends one fixed header with a Vault key (`catalog.ts` `CatalogBackend` `Http`).
  Reaching most of the services below needs one generic OAuth client for MCP servers (sign in on the service's own page, token kept in the Vault), not a screen per connector.
  Thirteen gallery servers cannot be reached even with that, because the vendor only admits its own approved apps, your own OAuth app, or an administrator's approval (table below).

## Method and sources

- **T3 Code**: shallow clone of `https://github.com/pingdotgg/t3code`, **commit `21a96989b07cf9156053880236a928e10baaeef8`** (committed 2026-11-25T03:05:43-08:00, "fix(web): include reopened issue selection in the /issues URL (#42745)"). Licence MIT, "Copyright (c) 2026 T3 Tools Inc." (`LICENSE`). The older note read `0de6ddb8`; this is far newer.
- **Paseo**: shallow clone of `https://github.com/getpaseo/paseo`, **commit `c1b43ee571ee15f409b4f1374b279f2f94387448`** (committed 2026-11-25T17:48:24+07:00, "Keep Git watchers responsive during large directory scans (#10788)"), version 0.17.4 (`package.json`, `packages/cli/package.json`). Licence Apache-2.0 (`packages/plugin/package.json` says `Apache-2.0`; the root `LICENSE` is Apache with a third-party carve-out).
- **Paseo Hub**: `https://github.com/getpaseo/hub` at **`0c71590dec86009b2767850dde4227db01eb8665`** (2026-11-25T15:36:02+07:00), `LICENSE` is Apache-2.0 and `package.json` says `Apache-2.0`. Only its public documents in the Paseo repository were read for behaviour; its code was not read.
- **Paseo plugin registry**: `https://getpaseo.github.io/plugins/index.json`, fetched 2026-11-25 (`generatedAt` 2026-11-25T10:11:49Z); the website code names this URL as its default base (`packages/website/src/plugins/published.ts:87`). It lists 640 plugins by 310 authors. I read only the index (names, descriptions, categories, artifact pins, install counts), not each plugin's code, except the ones named below.
- **Community plugin sources read**: `itsjustanks/paseo-mcp` at the registry-pinned commit **`8a3d1bf7e592d7793c818dd9bc3213c4d59b1c26`** (tag v0.19.2, 2026-10-06; MIT, "Copyright (c) 2026 Ankit Paliwal"); `itsjustanks/mcp-gallery` at **`27b1bd1311c86f358964a5c50ef652407e358ea1`** (2026-10-05, "Add 15 apps (Composio Connect, Meta Ads, 13 everyday apps); remove Zendesk"; MIT); and the READMEs of `neunzig-zehn/paseo-composio` (`a9fd354`, MIT), `hulkzzhou1/paseo-mcp-manager` (`ea387c1`), `yuruiz/paseo-plugins` (`secrets`, `5b11a30`) and `ClarePhang/paseo-im` (`ebb0cec`, MIT). Those README facts are the plugin authors' own claims; I did not run any plugin.
- **Live checks, 2026-11-25**: for each remote URL in the table I sent one unauthenticated JSON-RPC `initialize` request and read the status and any `WWW-Authenticate` header (details under "Live probe"). I called the GitHub licence API for each repository a gallery entry names, and read a few server READMEs for read-only modes. Nothing was installed or signed in.
- Nothing from T3 Code or Paseo was installed, built or run. A path that exists is not proof the feature works. Line numbers are at the pinned commits.
- Tool counts were **not** read from any server's `tools/list`; where the table says "not stated" no source I read gives a count.

## T3 Code

### How MCP servers reach each provider's agent

- **T3 Code has no screen for adding or editing user MCP servers.** The user documents say each provider loads its own configuration: Cursor's `.cursor/mcp.json`, `~/.cursor/mcp.json` and `~/.cursor/plugins` (`docs/user/cursor.md:18-22`); fx's `~/.fx/mcp.json` (`docs/user/providers-fx.md:42`); Kiro "using your own Kiro account, custom agents, steering, hooks, and MCP configuration" (`docs/user/providers-kiro.md:3-4`); Pi's project settings, extensions, skills and MCP servers, skipped when the folder is not trusted (`docs/user/providers-pi.md:85-92`). Claude and Codex read their own configuration too, and `docs/user/composer.md:308` tells the user to use **Restart agent session** after adding skills, plugins or MCP servers.
- **Searched and not found:** I searched `docs/user` and `apps/web/src/components/settings` for an MCP-server add form, a catalogue, a gallery or a connector page and found none. The only MCP-related settings code is for T3's own server and sign-in (below). Absence in what I searched, not proof.
- **What T3 does inject is its own MCP server, `t3-code`.** For Codex it writes `mcp_servers.t3-code` with a URL, a tool timeout and an `Authorization` header, plus a second direct-only registration (`apps/server/src/orchestration-v2/Adapters/CodexAdapterV2.ts:1743-1750`, `CODEX_DIRECT_ONLY_T3_TOOLS` at `:1684`); it leaves the user's other servers alone ("Override only T3's servers so launch-argument MCP servers survive", `:1741`). For Claude it calls the SDK's `setMcpServers` (`ClaudeAdapterV2.ts:1840-1867`). For ACP agents it picks MCP-over-ACP, then HTTP, then a stdio bridge (`packages/provider-acp/src/server/AcpSessionRuntime.ts:2374-2388`; `apps/server/src/mcp/AcpMcpStdioBridge.ts:12`, covered in the [ACP note](acp-antigravity-t3code-paseo-2026-11-24.md)).
- **In-thread MCP sign-in relay for Claude and Codex.** When an MCP server the user added to the agent needs a sign-in, the thread shows a **Sign in** notice; the user approves on the service's page, copies the address of the page the browser then fails to load, pastes it into T3 Code and chooses **Finish sign-in**; "Claude keeps the sign-in and reconnects the server"; it needs permission to manage providers (`docs/user/providers-claude.md:121-129`, `docs/user/providers-codex.md:131-139`). The code asks the agent to start the sign-in and submits the pasted callback address (`apps/server/src/mcpApps/McpSignIn.ts`, "Agents keep the credential themselves, so this never starts a session"; Claude control requests `mcp_authenticate` and `mcp_oauth_callback_url`, `ClaudeAdapterV2.ts:1043-1044`, `:2123`). T3 never holds the token. Connectors added on claude.ai are signed in on claude.ai and T3 does not ask (`providers-claude.md:128`).
- **Cursor limit:** the local SDK "cannot complete interactive MCP OAuth itself", so the user runs `agent mcp login <server>` in a terminal (`docs/user/cursor.md:23-30`). A checkout's own `.cursor/mcp.json` loads only in Full access (`:20-22`).
- **MCP Apps:** when an MCP server returns an interactive app with a tool result (the MCP Apps standard), T3 shows it in the thread for Claude (Claude Code 2.1.301 or newer) and Codex; "T3 Code asks first unless the server marks the tool as read-only, and it asks before every message" (`docs/user/html-renders.md`, section "MCP apps"). Code: `apps/server/src/mcpApps/`, `packages/shared/src/mcpApp`.
- **Skills and plugins:** T3 lists the provider's own skills with `$`, including enabled Claude plugins' skills under names such as `plugin:review` (`providers-claude.md:107-113`), reading Claude's `known_marketplaces.json` and each marketplace's `.claude-plugin/marketplace.json` (`apps/server/src/provider/Drivers/ClaudeSkills.ts:350-358`, `:609-633`). The only skill T3 bundles is `skills/t3-workflows` (a guide for writing T3's own workflows); `.agents/skills/*` are for developing T3 itself.

### What T3 Code offers as connectors and tool sources

| Item | Category | Delivery | Authentication | Licence | Maintainer | Tools | Read-only mode |
|---|---|---|---|---|---|---|---|
| **T3 Code MCP server** (T3 as a tool source for outside agents and for its own threads) | orchestration | built-in native code, HTTP MCP at `<environment>/mcp` (`docs/user/outside-agents.md`) | OAuth with browser sign-in on the T3 Connect page or the environment's page, or a one-time code (valid once, 5 minutes); sign-in lasts 30 days | MIT | T3 Tools Inc. | 95 `Tool.make` declarations in `apps/server/src/mcp/toolkits/*/tools.ts` (my grep); 31 carry `Tool.Readonly, true` | yes: **Read only** access level reads projects and threads only; modes up to Full access (`outside-agents.md`, "Approve a sign-in") |
| **1Password** secret provider | secrets | built-in native code over the `op` CLI | local sign-in of `op`; or a service account; or a Connect server (`docs/user/secrets.md`, `secrets-1password-service-account.md`, `secrets-1password-connect.md`) | MIT | T3 Tools Inc. | n/a (reads references `op://vault/item/field`) | n/a; "T3 Code never replaces a saved credential it cannot read" |
| **GitHub** source control and issues | developer | built-in native code over GitHub's API; or `gh` CLI 2.81.0+ | token saved in Settings (kept in the server's secret store), `GH_TOKEN`, or `gh auth login` (`docs/user/source-control.md:45-58`) | MIT | T3 Tools Inc. | `pull_request_*`, `list_issues`, `read_issue`, `create_issue`, `set_issue_state`, `ci_logs`, `ci_rerun` and others in `mcp/toolkits/{pullRequests,issues}` | scope `source-control:write` needed to write remotely (`source-control.md:432`) |
| **GitLab** | developer | native code over the `glab` CLI | `glab auth login` (`source-control.md:83-86`) | MIT | T3 Tools Inc. | same toolkits | same |
| **Bitbucket** | developer | native code over the API | access token, or Atlassian email plus API token (`source-control.md:93-111`; env `T3CODE_BITBUCKET_ACCESS_TOKEN`) | MIT | T3 Tools Inc. | same | same |
| **Azure DevOps** | developer | native code over Azure CLI with the DevOps extension | `az login` (`source-control.md:121-125`) | MIT | T3 Tools Inc. | same | same |
| **Forgejo and Gitea** | developer | native code over `fj` or `tea` CLI | `fj auth add-token` or `tea login add` (`source-control.md:63-76`) | MIT | T3 Tools Inc. | same | same |
| **GitCafe**, **TanStack Source**, **Cursor Origin** | developer | native code over `cafe`, `src`, `origin` CLIs | CLI login or a token in Settings (`source-control.md:130-178`) | MIT | T3 Tools Inc. | same | same |
| **Linear** issue tracker | productivity | built-in native code over Linear's GraphQL API, not MCP (`packages/issue-tracker-linear/src/server/LinearApi.ts`) | personal API key saved in Settings → Source control and issues; sent as is, not as `Bearer` (`LinearIssueTracker.ts:38` label "Personal API key"; `LinearApi.ts:251`); several accounts allowed (`source-control.md:421-427`) | MIT | T3 Tools Inc. | list, read, comment, edit, label, assign, move state (`source-control.md:434-440`) | the key's own scope; reads through a project that does not own the repository are "read-only" for GitHub-style trackers (`source-control.md:439`) |
| **ACP Registry** agents (agents, not connectors) | agents | binary, `npx` or `uvx` packages from `https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json` (`packages/provider-acp-registry/src/server/AcpRegistrySupport.ts:53`); exact versions, SHA-256 when given (`docs/user/providers-acp.md`) | each agent's own sign-in in Settings → Providers | per agent; "review an agent's source and license before adding it" | third parties | n/a | n/a |

Notes on the table:

- The "T3 Code MCP server" toolkits also include `request_secret` (a private card; "The value never appears in the conversation", `docs/user/secrets.md`, section "When an agent asks for a secret"), `preview_*` browser tools, `device_*`, `schedule_task`, `html_render`, `t3_thread_*` and `t3_workflow`. A tool search tool, `McpToolExposure.TOOL_SEARCH`, loads tools on demand (`mcp/toolkits/toolSearch/tools.ts`).
- A bot that supports MCP Events (`io.modelcontextprotocol/events`) can poll, stream or take webhooks for T3 events; webhooks go only to public `https` addresses (`outside-agents.md`).
- "Outside agents" reach T3 through Claude Code (`claude mcp add --transport http t3 .../mcp`, then `claude mcp login t3`), Codex (`codex mcp add t3 --url`), ChatGPT custom MCP apps with OAuth, or "any agent that supports remote MCP servers over HTTP with OAuth"; "Apps that require their own client ID cannot connect" (`outside-agents.md`). This is a T3 server other agents use, the reverse of a connector, but it shows T3 publishing a remote OAuth MCP server.
- T3's source-control and issue code is a native adapter per service, each with its own sign-in fields in Settings. That is the pattern Outlore's constraints rule out (no connector-specific sign-in screens), so it is a feature list to compare, not a design to copy.
- A statement in `docs/user/secrets.md`: "1Password is the supported provider", and "The Secrets settings page is in preview and is not in every build yet". Secret providers are registered in `packages/secret-provider-definitions/src/registry.ts` with a single definition.

## Paseo

### How MCP servers reach each provider's agent

- **Paseo also has no connector catalogue in its core.** `public-docs/providers.md:11` says: "Your subscriptions, config, skills, and MCP servers stay intact." I searched `packages/app/src` for `mcpServers` and found nothing; the field exists in the session configuration (`packages/protocol/src/agent-types.ts:575`, `packages/protocol/src/messages.ts:549` and `:3458`) and the SDK documents "Session-scoped MCP servers" (`public-docs/sdk/reference.md:78`). The CLI has no MCP-server flag (`packages/cli/src` matches only in `onboard.ts`, `agent/inspect.ts`, `daemon/local-daemon.ts`).
- **Paseo's own tools reach agents either natively or through one injected MCP server.** `daemon.mcp.injectIntoAgents` defaults to `false`; "Depending on the provider, Paseo delivers tools through its native tool interface or MCP" (`public-docs/mcp.md:18-20`). The injected server is named `paseo` and is an HTTP server at `/mcp/agents?callerAgentId=<id>` with a bearer capability token (`packages/server/src/server/agent/runtime-mcp-config.ts`, `withRuntimePaseoMcpServer`). Per provider ID, `paseoTools.enabled` and `paseoTools.disabledTools` filter the catalogue by exact tool name (`public-docs/mcp.md:22-60`); "It is not a security boundary for an agent that can access the host through a shell".
- **Delivery per provider:** each provider adapter converts `mcpServers` its own way: Claude through its SDK options with a delivery mode (`providers/claude/agent.ts:4092-4095`), Codex into its app-server configuration (`codex-app-server-agent.ts:6110`), OpenCode through its own MCP configuration call (`opencode-agent.ts:5218-5236`), Pi through a generated extension or a per-agent `--mcp-config` file (`docs/providers.md:143-145`), and ACP agents through the ACP `mcpServers` list; ACP adapters that cannot start a session with a non-empty list can set `options.supportsMcpServers: false` (`docs/custom-providers.md:548-559`).
- **Exact MCP tool preapproval exists as a contract:** a session's tool policy is `preapproved: [{ kind: "mcp", server, tool }]`, one record per exact server and tool name (`packages/protocol/src/messages.ts:523-535`), and "a new provider must fail closed for Hub unattended execution until it can approve one exact injected MCP" (`docs/providers.md:98-99`). This is the same exact-name idea as Outlore's catalogue.

### The plugin hook that injects MCP servers and tools

- **Plugins are trusted, unsandboxed TypeScript** installed into one daemon: "server code and preparation commands run with the daemon" (`public-docs/plugins/index.md:120`); installed with `paseo plugin add owner/slug` from the reviewed registry or `git:owner/repo` (`docs/plugins.md:134-140`).
- **`agent.open.before` can add MCP servers per session:** a plugin returns `{...request, mcpServers: {...request.mcpServers, company: {type: "http", url}}}`; the map "starts empty for each plugin", never contains saved servers, and a name collision with a saved server or another plugin "fails the session open and names both sources" (`public-docs/plugins/hooks.md:362-392`; example `plugin-examples/agent-configuration`).
- **The same hook can attach in-process tools** with `defineAgentTool({name, description, input: zod, execute})` (`hooks.md:394-420`; example `plugin-examples/agent-tools`), so a plugin can be a native connector with no MCP server at all.
- **Example connector plugin:** `plugin-examples/linear` adds an "Attach Linear issue" composer item; the key is `LINEAR_API_KEY` in the daemon's environment, "keep credentials and vendor API calls out of the client bundle" (`plugin-examples/linear/README.md`).

### Paseo Hub: integrations, scoped tools and triggers

- **What it is:** a managed service (`hub.paseo.sh`) or self-hosted Apache-2.0 software (`github.com/getpaseo/hub`) above daemons, so "GitHub · Linear · Slack · Discord · Schedules · Webhooks" start agents and agents can read or post (`public-docs/hub/index.md`, `hosted.md`).
- **Authentication:** an **app** is the provider application (GitHub App, Linear OAuth app, Slack app, Discord app); an **integration** is a workspace, account or server connected under Integrations, with a connection slug such as `acme-slack` (`public-docs/hub/concepts.md:27-28`). "Hub keeps provider tokens on the server and enforces the connection, action, and channel allowlist on every tool call" (`public-docs/hub/tools.md`).
- **Scoped tools in a trigger, by exact grant:** `run.tools.slack: {connection, actions: [read|post], channels: [IDs, 1 to 50]}`; read exposes `slack_list_channels` and `slack_read`, post exposes `slack_post`; Discord exposes `discord_list_channels`, `discord_read`, `discord_latest`, `discord_post` (`public-docs/hub/tools.md`). That is seven tools in two Read and Write groups, with an explicit channel allowlist.
- **GitHub access without a long-lived token:** `run.github` mints a GitHub App installation token of at most one hour, with requested permissions (`contents`, `pull_requests`, `issues`) capped by the installation (`public-docs/hub/github.md`).
- **Limit:** "Hub verifies inbound requests, enforces sender allowlists, mints scoped GitHub tokens, and authorizes every Hub MCP tool call on the server. It does not sandbox the coding agent process on your machine" (`public-docs/hub/concepts.md:65`).

### Bundled plugins in the Paseo repository

The repository's `plugins/` folder has 17 plugins (`paseo-plugin.json` in each): 10 usage sources, 6 agent providers and `worktree-include`.

| Plugin | Service | Category | Delivery | Authentication | Licence |
|---|---|---|---|---|---|
| `claude-usage-source` | Anthropic Claude plan usage | usage | plugin; calls `https://api.anthropic.com/api/oauth/profile` | the Claude CLI's own OAuth credentials (keychain or `.credentials`) read locally | none found in the folder (repository Apache-2.0) |
| `codex-usage-source` | OpenAI Codex | usage | plugin | reads Codex's `auth.json` (OAuth or API key) | same |
| `copilot-usage-source` | GitHub Copilot | usage | plugin | OAuth credentials from the keychain | same |
| `cursor-usage-source` | Cursor | usage | plugin; `https://api2.cursor.sh/aiserver.v1.DashboardService/GetCurrentPeriodUsage` | bearer from Cursor's `auth.json` | same |
| `grok-usage-source` | Grok | usage | plugin; `https://cli-chat-proxy.grok.com/v1/billing` | `auth.json` or API key | same |
| `kimi-usage-source` | Kimi | usage | plugin; `https://api.kimi.com/coding/v1/usages` | bearer (OAuth) | same |
| `minimax-usage-source` | MiniMax | usage | plugin; `https://api.minimax.io/v1/token_plan/remains` | API key env | same |
| `opencode-go-usage-source` | OpenCode Go | usage | plugin; `https://opencode.ai/zen/go/v1/usage` | API key | same |
| `openrouter-host-usage-source` | OpenRouter | usage | plugin; `https://openrouter.ai/api/v1/key` and `/credits` | API key env, bearer | MIT (`LICENSE` in the folder, "Copyright (c) 2026 Sian Lerk Lau") |
| `zai-usage-source` | Z.ai | usage | plugin | API key env | none found in the folder |
| `antigravity-provider`, `fx-provider`, `goose-provider`, `hermes-provider`, `hoplite-provider`, `muse-provider` | agents | providers | plugin over each agent's CLI | the agent's own sign-in | none found in the folder |

These are usage meters and agent bridges, not tool sources; they confirm that Paseo reads each CLI's local credentials rather than offering sign-in screens. The per-plugin lines come from a grep of each folder for URLs and credential words; I did not read the plugins end to end.

### The Paseo plugin registry (community)

- **640 plugins by 310 authors** at 2026-11-25; 397 pinned to a Git commit and 243 to an npm package (`index.json`, `artifact.kind`). Categories (a plugin can have several): Utils 282, Sidebar 193, Workspaces 181, Themes 121, Orchestration 98, Git 42, Providers 56, Daemon management 48, Extras 70. About 80 of the 640 are Obsidian theme ports; most of the rest are interface add-ons.
- **Plugins that are connectors, MCP managers or tool sources** (my selection from the descriptions in the index; installs are the registry's count):

| Plugin | What it does (registry description, shortened) | Installs | Notes |
|---|---|---|---|
| `itsjustanks/mcp` (paseo-mcp) | "Connectors for your AI apps: add them from a gallery, keep Claude and Codex in step, see what's broken and sign in." | 166 | MIT; read in depth below |
| `neunzig-zehn/composio` | Gmail, GitHub, Slack, Linear "and 1,000+ more apps" through Composio | 58 | MIT; sign-in through Composio's CLI session flow, key in a 0600 file under the plugin data folder (README), not a vault |
| `hulkzzhou1/mcp-manager` | "Manage HTTP and stdio MCP connections for new Paseo agents." | 55 | tokens are literal headers or env values in host JSON with restricted permissions; "OAuth, token-file lookup, SSE editing ... are outside its scope" |
| `ragokan/mcp-toggle`, `davnn1/opencode-mcp-toggle` | turn Claude's, Codex's or OpenCode's MCP servers on or off per chat | 61, 17 | |
| `koinzhang/customize` | inspect local instructions, rules, skills, MCP servers, commands, subagents, plugins | 67 | |
| `omercnet/context-mode` | Context Mode health, savings and MCP activation | 78 | |
| `kevinle128/computer-use` | native macOS apps through typed MCP tools | 93 | overlaps Outlore's Apple apps connector |
| `oliexe/bots` | "Personal bots ... instructions, a model, memory, routines, teams, skills, MCP tools and connected apps." | 1145 | most installed connector-adjacent plugin |
| `clarephang/im` | IM bridge, twelve channels: Feishu, WeChat, DingTalk, WeCom, QQ, Slack, Telegram, Discord, WhatsApp, iMessage, Matrix | 52 | MIT; WeChat on an "undocumented iLink bot API" and WhatsApp on "the unofficial Baileys protocol — both can break without notice"; iMessage needs Full Disk Access on macOS (`OVERVIEW.md`) |
| `daaaaave/telegram`, `mikeyates/waseo` (WhatsApp through WACLI) | single-channel chat bridges | 64, 0 | |
| `yuruiz/secrets` | "Private inputs with one-use execution grants, plus 1Password Connect access" | 19 | secrets are injected into a command's environment, values are not shown to the agent (README) |
| `alysnnix/github-integration`, `andrioid/attention-span`, `ajma/issues-workspaces`, `denny64/github-kanban` | GitHub pull requests, issues and boards | 258, 47, 49, 20 | interface plugins over GitHub |
| `zedobaia/linear`, `ethanl06/linear`, `yannelli/linear`, `drgould/linear`, `anh-chu/tasks` | Linear issues, several accounts | 135, 14, 3, 1, 276 | |
| `tranhuywin/jira`, `ariel1safar/jira`, `mbranicky/jira-dashboard` | Jira Cloud tickets as workspaces | 39, 32, 17 | |
| `geongyu09/notion`, `casonmo/obsidian`, `jegork/grafana`, `xztsummer/task-notify` (Feishu or Telegram notices), `kiawin/openrouter-usage`, `applixodoo/cloudflare-public-link`, `vercel-labs/vercel-sandbox` | Notion pages, Obsidian vault (read-only), Grafana alerts, notices, OpenRouter credits, Cloudflare tunnel, Vercel Sandbox hosts | 3 to 28 | |

- **Reading of the registry:** the community built connectors mainly as interface plugins over a vendor API (Linear, Jira, GitHub, Notion) and as MCP-server managers; no registry entry was found that ships a curated catalogue except `paseo-mcp`. The registry says it reviews each artifact ("Paseo installs the registry's reviewed artifact", `public-docs/plugins/index.md`); I did not review any.

### `paseo-mcp`: a connector gallery with sign-in handling

All from `README.md` and `shared/catalog-curated.ts` at `8a3d1bf` (MIT).

- **Delivery:** it edits the MCP configuration of other apps, not Paseo's: user-level servers of Claude Code, Codex, Kimi Code and Grok, and project `.mcp.json`; it keeps backups before writes and never copies a sign-in (README, "What it does").
- **Gallery shelves:** **Recommended** is 31 servers in `shared/catalog-curated.ts`, each URL "copied from the vendor's own documentation" on 2026-09-24; **Libraries** default to the MCP Gallery below; **Registries** can include the official MCP Registry (`registry.modelcontextprotocol.io`), listed but off by default; "A server that only ships a package (npm, PyPI, an image) is shown, marked 'Runs code on this server'" and is not added in one click.
- **Library format:** the official registry's `server.json` list shape plus an optional `_meta["io.github.itsjustanks/mcp-gallery"]` with `displayName`, `category`, `publisher`, `iconUrl`, `auth` (`oauth`, `token`, `none`), `docsUrl`, `verifiedAt`, `setup`.
- **Authentication handling:** the plugin starts Claude or Codex OAuth "in the computer's default browser and shows the fallback URL"; secrets are masked; a client secret never goes into a file: for one case it runs `claude mcp add-json --scope user --client-secret` with the secret in a child's environment (README, "Bring your own sign-in app").
- **Setup kinds, the part most relevant to Outlore:** `byo-oauth` (the vendor admits only an OAuth client you register; the plugin shows the redirect address `http://localhost:33418/callback` and the scopes), `per-org` (needs your subdomain), `approved-clients` ("Only the vendor's approved AI apps can sign in"), `admin` ("an administrator turns it on first") (README, "Some official servers can't be added in one click").
- **Whether tools are loaded and counted:** it lists the tools each server exposes and shows which a chat used, but the gallery data holds no tool names or counts.
- **Newer than the registry pin:** the repository's HEAD is `9ae26e1` (version 0.20.1, 2026-10-14); I used the registry-pinned `8a3d1bf`.

### Live probe of the remote URLs, 2026-11-25

One unauthenticated `initialize` POST per URL, through the sandbox's proxy, with the final HTTP status.

- **401 with a Bearer challenge naming `resource_metadata` (OAuth protected-resource metadata, so the server advertises OAuth discovery):** GitHub (`api.githubcopilot.com/mcp/`), Cloudflare Workers Bindings and Observability, Customer.io US and EU, Airtable, Asana, Atlassian, Attio, Intercom US and EU, Figma, Gleap, Jam, Linear, Neon, Notion, PostHog, Sentry, Stripe, Supabase, Vercel, Zapier, Relume, Slack, Box, Dropbox, Todoist (`ai.todoist.net`), HubSpot, GitLab, Canva, monday.com, ClickUp, PayPal, Square, Zoom, Calendly, Miro, Postman, Hugging Face, Webflow and Composio Connect. Mapbox answered with a Bearer challenge and scopes but I did not see `resource_metadata` in the first 110 characters I kept.
- **401 with no OAuth challenge (key in a header):** HeroUI Pro and JustCall, as the curated list says.
- **200 on `initialize` with no token:** Cloudflare Docs, Microsoft Learn, Context7, DeepWiki, AWS Knowledge; the three Google endpoints (`calendarmcp`, `gmailmcp`, `drivemcp`.googleapis.com) also answered 200 to `initialize`, which says nothing about tool calls, which the gallery says need your own Google Cloud OAuth client.
- **Not reachable:** `mcp.todoist.com` (proxy 502); the gallery's own URL `ai.todoist.net` answered.
- **Limit:** this shows which servers answer and how they challenge, not that a sign-in succeeds or which tools they list. No token was sent and no tool was called.

### Services the two sources name (81 distinct endpoints)

The table merges the 69-entry MCP Gallery (`servers.json` v0.2) and the 12 additional endpoints only the Recommended shelf has (`Atlassian` and `Intercom (US)` appear in both with the same URL and are listed once). Delivery is the entry's first remote URL or package. Authentication is the gallery's `auth` field, with the setup kind in bold where the gallery gives one. Licence is of the repository the entry names, from the GitHub licence API on 2026-11-25; "(no repository named)" means the gallery lists a hosted endpoint only, so the licence of the hosted server is not stated by these sources. Maintainer is "vendor" because the gallery and the curated list call these official servers and link vendor documents; I did not check each vendor's page. Tools: no source I read states a tool count. Read-only: found only where a README says so; "not found" means I did not find one in the sources read, not that none exists.

| Service | Category | Delivery | Authentication | Licence (repository the entry names) | Maintainer | Tools | Read-only mode |
|---|---|---|---|---|---|---|---|
| Day AI | crm | remote MCP, streamable-http, `https://day.ai/api/mcp` | OAuth, browser sign-in | — (no repository named) | vendor (per gallery) | not stated | not found |
| Fathom | productivity | remote MCP, streamable-http, `https://api.fathom.ai/mcp` | OAuth, browser sign-in | — (no repository named) | vendor (per gallery) | not stated | not found |
| Fireflies | productivity | remote MCP, streamable-http, `https://api.fireflies.ai/mcp` | OAuth, browser sign-in | — (no repository named) | vendor (per gallery) | not stated | not found |
| Granola | productivity | remote MCP, streamable-http, `https://mcp.granola.ai/mcp` | OAuth, browser sign-in | — (no repository named) | vendor (per gallery) | not stated | not found |
| Otter.ai | productivity | remote MCP, streamable-http, `https://mcp.otter.ai/mcp` | OAuth, browser sign-in | — (no repository named) | vendor (per gallery) | not stated | not found |
| Supercut | productivity | remote MCP, streamable-http, `https://mcp.supercut.ai/mcp` | OAuth, browser sign-in | — (no repository named) | vendor (per gallery) | not stated | not found |
| Linear | productivity | remote MCP, streamable-http, `https://mcp.linear.app/mcp` | OAuth, browser sign-in | — (no repository named) | vendor (per gallery) | not stated | not found |
| AWS Knowledge | docs | remote MCP, streamable-http, `https://knowledge-mcp.global.api.aws` | none | Apache-2.0 (awslabs/mcp) | vendor (per gallery) | not stated | not found |
| Hugging Face | developer | remote MCP, streamable-http, `https://huggingface.co/mcp?login` | OAuth, browser sign-in | — (no repository named) | vendor (per gallery) | not stated | not found |
| Airtable | productivity | remote MCP, streamable-http, `https://mcp.airtable.com/mcp` | OAuth, browser sign-in | — (no repository named) | vendor (per gallery) | not stated | not found |
| Atlassian Rovo | productivity | remote MCP, streamable-http, `https://mcp.atlassian.com/v2/mcp` | OAuth, browser sign-in | Apache-2.0 (atlassian/atlassian-mcp-server) | vendor (per gallery) | not stated | not found |
| Attio | crm | remote MCP, streamable-http, `https://mcp.attio.com/mcp` | OAuth, browser sign-in | — (no repository named) | vendor (per gallery) | not stated | not found |
| Box | productivity | remote MCP, streamable-http, `https://mcp.box.com` | OAuth, browser sign-in; **admin** | — (no repository named) | vendor (per gallery) | not stated | not found |
| Cal.com | productivity | remote MCP, streamable-http, `https://mcp.cal.com/mcp` | OAuth, browser sign-in | — (no repository named) | vendor (per gallery) | not stated | not found |
| Calendly | productivity | remote MCP, streamable-http, `https://mcp.calendly.com` | OAuth, browser sign-in | — (no repository named) | vendor (per gallery) | not stated | not found |
| Canva | design | remote MCP, streamable-http, `https://mcp.canva.com/mcp` | OAuth, browser sign-in; **approved-clients** | — (no repository named) | vendor (per gallery) | not stated | not found |
| ClickUp | productivity | remote MCP, streamable-http, `https://mcp.clickup.com/mcp` | OAuth, browser sign-in | — (no repository named) | vendor (per gallery) | not stated | not found |
| Cloudflare API | developer | remote MCP, streamable-http, `https://mcp.cloudflare.com/mcp` | OAuth, browser sign-in | Apache-2.0 (cloudflare/mcp-server-cloudflare) | vendor (per gallery) | not stated | not found |
| Cloudflare Docs | docs | remote MCP, streamable-http, `https://docs.mcp.cloudflare.com/mcp` | none | Apache-2.0 (cloudflare/mcp-server-cloudflare) | vendor (per gallery) | not stated | not found |
| DeepWiki | docs | remote MCP, streamable-http, `https://mcp.deepwiki.com/mcp` | none | — (no repository named) | vendor (per gallery) | not stated | not found |
| Dropbox | productivity | remote MCP, streamable-http, `https://mcp.dropbox.com/mcp` | OAuth, browser sign-in; **approved-clients** | — (no repository named) | vendor (per gallery) | not stated | not found |
| Meta Ads | marketing | remote MCP, streamable-http, `https://mcp.facebook.com/ads` | OAuth, browser sign-in; **byo-oauth** | — (no repository named) | vendor (per gallery) | not stated | not found |
| GitLab | developer | remote MCP, streamable-http, `https://gitlab.com/api/v4/mcp` | OAuth, browser sign-in | — (no repository named) | vendor (per gallery) | not stated | not found |
| Google Calendar | productivity | remote MCP, streamable-http, `https://calendarmcp.googleapis.com/mcp/v1` | OAuth, browser sign-in; **byo-oauth** | — (no repository named) | vendor (per gallery) | not stated | not found |
| Google Docs | productivity | remote MCP, streamable-http, `https://docsmcp.googleapis.com/mcp/v1` | OAuth, browser sign-in; **byo-oauth** | — (no repository named) | vendor (per gallery) | not stated | not found |
| Google Drive | productivity | remote MCP, streamable-http, `https://drivemcp.googleapis.com/mcp/v1` | OAuth, browser sign-in; **byo-oauth** | — (no repository named) | vendor (per gallery) | not stated | not found |
| Gmail | productivity | remote MCP, streamable-http, `https://gmailmcp.googleapis.com/mcp/v1` | OAuth, browser sign-in; **byo-oauth** | — (no repository named) | vendor (per gallery) | not stated | not found |
| Google Sheets | productivity | remote MCP, streamable-http, `https://sheetsmcp.googleapis.com/mcp/v1` | OAuth, browser sign-in; **byo-oauth** | — (no repository named) | vendor (per gallery) | not stated | not found |
| Google Stitch | design | remote MCP, streamable-http, `https://stitch.googleapis.com/mcp` | API key or token in a header | — (no repository named) | vendor (per gallery) | not stated | not found |
| HubSpot | crm | remote MCP, streamable-http, `https://mcp.hubspot.com` | OAuth, browser sign-in; **byo-oauth** | — (no repository named) | vendor (per gallery) | not stated | not found |
| Intercom | support | remote MCP, streamable-http, `https://mcp.intercom.com/mcp` | OAuth, browser sign-in | — (no repository named) | vendor (per gallery) | not stated | not found |
| Klaviyo | marketing | remote MCP, streamable-http, `https://mcp.klaviyo.com/mcp` | OAuth, browser sign-in | — (no repository named) | vendor (per gallery) | not stated | not found |
| Mailchimp Transactional | marketing | remote MCP, streamable-http, `https://mandrillapp.com/mcp` | API key or token in a header | — (no repository named) | vendor (per gallery) | not stated | not found |
| Microsoft Learn | docs | remote MCP, streamable-http, `https://learn.microsoft.com/api/mcp` | none | — (no repository named) | vendor (per gallery) | not stated | not found |
| Microsoft 365 | productivity | remote MCP, streamable-http, `https://agent365.svc.cloud.microsoft/agents/tenants/{tenantId}/servers/mcp_MailTools` | OAuth, browser sign-in; **admin** | — (no repository named) | vendor (per gallery) | not stated | not found |
| monday.com | productivity | remote MCP, streamable-http, `https://mcp.monday.com/mcp` | OAuth, browser sign-in | MIT (mondaycom/mcp) | vendor (per gallery) | not stated | yes: `--read-only` flag |
| Neon | data | remote MCP, streamable-http, `https://mcp.neon.tech/mcp` | OAuth, browser sign-in | MIT (neondatabase/mcp-server-neon) | vendor (per gallery) | not stated | yes: `readonly` URL parameter or scopes |
| Netlify | developer | remote MCP, streamable-http, `https://netlify-mcp.netlify.app/mcp` | OAuth, browser sign-in | — (no repository named) | vendor (per gallery) | not stated | not found |
| Notion | productivity | remote MCP, streamable-http, `https://mcp.notion.com/mcp` | OAuth, browser sign-in | — (no repository named) | vendor (per gallery) | not stated | not found |
| PayPal | payments | remote MCP, streamable-http, `https://mcp.paypal.com/mcp` | OAuth, browser sign-in | — (no repository named) | vendor (per gallery) | not stated | not found |
| Pipedrive | crm | remote MCP, streamable-http, `https://mcp.pipedrive.ai/mcp` | OAuth, browser sign-in | — (no repository named) | vendor (per gallery) | not stated | not found |
| Postman | developer | remote MCP, streamable-http, `https://mcp.postman.com/mcp` | OAuth, browser sign-in | Apache-2.0 (postmanlabs/postman-mcp-server) | vendor (per gallery) | not stated | not found |
| Salesforce | crm | remote MCP, streamable-http, `https://api.salesforce.com/platform/mcp/v1/platform/headless-360` | OAuth, browser sign-in; **admin** | — (no repository named) | vendor (per gallery) | not stated | not found |
| Slack | productivity | remote MCP, streamable-http, `https://mcp.slack.com/mcp` | OAuth, browser sign-in; **approved-clients** | — (no repository named) | vendor (per gallery) | not stated | not found |
| Slashy | productivity | remote MCP, streamable-http, `https://slashy.ctrlcenter.ai/mcp` | OAuth, browser sign-in | — (no repository named) | vendor (per gallery) | not stated | not found |
| Square | payments | remote MCP, streamable-http, `https://mcp.squareup.com/mcp` | OAuth, browser sign-in | — (no repository named) | vendor (per gallery) | not stated | not found |
| Stripe | payments | remote MCP, streamable-http, `https://mcp.stripe.com` | OAuth, browser sign-in | MIT (stripe/agent-toolkit) | vendor (per gallery) | not stated | not found |
| Supabase | data | remote MCP, streamable-http, `https://mcp.supabase.com/mcp` | OAuth, browser sign-in | Apache-2.0 (supabase/mcp) | vendor (per gallery) | not stated | yes: `read_only=true` URL parameter |
| Superhuman Mail | productivity | remote MCP, streamable-http, `https://mcp.mail.superhuman.com/mcp` | OAuth, browser sign-in | — (no repository named) | vendor (per gallery) | not stated | not found |
| Vercel | developer | remote MCP, streamable-http, `https://mcp.vercel.com` | OAuth, browser sign-in | — (no repository named) | vendor (per gallery) | not stated | not found |
| Webflow | design | remote MCP, streamable-http, `https://mcp.webflow.com/mcp` | OAuth, browser sign-in | MIT (webflow/mcp-server, being archived) | vendor (per gallery) | not stated | not found |
| Wix | design | remote MCP, streamable-http, `https://mcp.wix.com/mcp` | OAuth, browser sign-in | not verified (named repo not found) | vendor (per gallery) | not stated | not found |
| Zapier | automation | remote MCP, streamable-http, `https://mcp.zapier.com/api/v1/connect` | OAuth, browser sign-in | MIT (zapier/zapier-mcp) | vendor (per gallery) | not stated | not found |
| Composio Connect | automation | remote MCP, streamable-http, `https://connect.composio.dev/mcp` | OAuth, browser sign-in | — (no repository named) | vendor (per gallery) | not stated | not found |
| Shopify Dev | developer | stdio, npm `@shopify/dev-mcp` | none | not verified (named repo not found) | vendor (per gallery) | not stated | not found |
| PostHog | analytics | remote MCP, streamable-http, `https://mcp.posthog.com/mcp` | OAuth, browser sign-in | — (no repository named) | vendor (per gallery) | not stated | not found |
| GitHub | developer | remote MCP, streamable-http, `https://api.githubcopilot.com/mcp/` | API key or token in a header | MIT (github/github-mcp-server) | vendor (per gallery) | not stated | yes: `/readonly` URL suffix |
| Mapbox | developer | remote MCP, streamable-http, `https://mcp.mapbox.com/mcp` | OAuth, browser sign-in | — (no repository named) | vendor (per gallery) | not stated | not found |
| Playwright | developer | stdio, npm `@playwright/mcp` | none | Apache-2.0 (microsoft/playwright-mcp) | vendor (per gallery) | not stated | not found |
| Miro | productivity | remote MCP, streamable-http, `https://mcp.miro.com/` | OAuth, browser sign-in | — (no repository named) | vendor (per gallery) | not stated | not found |
| Filesystem (reference) | developer | stdio, npm `@modelcontextprotocol/server-filesystem` | none | not classified (modelcontextprotocol/servers) | vendor (per gallery) | not stated | not found |
| MongoDB | data | stdio, npm `mongodb-mcp-server` | API key or token in a header | Apache-2.0 (mongodb-js/mongodb-mcp-server) | vendor (per gallery) | not stated | yes: `--readOnly` flag |
| Context7 | docs | remote MCP, streamable-http, `https://mcp.context7.com/mcp` | none | MIT (upstash/context7) | vendor (per gallery) | not stated | not found |
| Gleap | support | remote MCP, streamable-http, `https://mcp.gleap.io/mcp` | OAuth, browser sign-in | — (no repository named) | vendor (per gallery) | not stated | not found |
| Prisma Postgres | data | remote MCP, streamable-http, `https://mcp.prisma.io/mcp` | OAuth, browser sign-in | not verified (named repo not found) | vendor (per gallery) | not stated | not found |
| Sentry | developer | remote MCP, streamable-http, `https://mcp.sentry.dev/mcp` | OAuth, browser sign-in | not classified by GitHub (getsentry/sentry-mcp) | vendor (per gallery) | not stated | not found |
| Todoist | productivity | remote MCP, streamable-http, `https://ai.todoist.net/mcp` | OAuth, browser sign-in | MIT (Doist/todoist-ai) | vendor (per gallery) | not stated | not found |
| Amie | productivity | remote MCP, streamable-http, `https://mcp.amie.so` | OAuth, browser sign-in | — (no repository named) | vendor (per gallery) | not stated | not found |
| Zoom | productivity | remote MCP, streamable-http, `https://mcp.zoom.us/mcp/zoom/streamable` | OAuth, browser sign-in; **byo-oauth** | — (no repository named) | vendor (per gallery) | not stated | not found |
| Cloudflare Workers Bindings | developer | remote MCP, `https://bindings.mcp.cloudflare.com/mcp` | OAuth, browser sign-in | — (no repository named) | Cloudflare (official, per curated list) | not stated | not found |
| Cloudflare Observability | developer | remote MCP, `https://observability.mcp.cloudflare.com/mcp` | OAuth, browser sign-in | — (no repository named) | Cloudflare (official, per curated list) | not stated | not found |
| DigitalOcean | developer | stdio, npm `@digitalocean/mcp` | API key in an environment variable | MIT (digitalocean-labs/mcp-digitalocean) | DigitalOcean (official, per curated list) | not stated | not found |
| Asana | productivity | remote MCP, `https://mcp.asana.com/v2/mcp` | OAuth, browser sign-in | — (no repository named) | Asana (official, per curated list) | not stated | not found |
| Jam | developer | remote MCP, `https://mcp.jam.dev/mcp` | OAuth, browser sign-in | — (no repository named) | Jam (official, per curated list) | not stated | not found |
| Figma | design | remote MCP, `https://mcp.figma.com/mcp` | OAuth, browser sign-in | — (no repository named) | Figma (official, per curated list) | not stated | not found |
| HeroUI Pro | design | remote MCP, `https://mcp.heroui.pro/mcp` | API key in a header | — (no repository named) | HeroUI (official, per curated list) | not stated | not found |
| Relume Library | design | remote MCP, `https://relume-library-mcp.relume.io/mcp` | OAuth, browser sign-in | — (no repository named) | Relume (official, per curated list) | not stated | not found |
| Intercom (EU) | support | remote MCP, `https://mcp.eu.intercom.com/mcp` | OAuth, browser sign-in | — (no repository named) | Intercom (official, per curated list) | not stated | not found |
| Customer.io (US) | marketing | remote MCP, `https://mcp.customer.io/mcp` | OAuth, browser sign-in | — (no repository named) | Customer.io (official, per curated list) | not stated | not found |
| Customer.io (EU) | marketing | remote MCP, `https://mcp-eu.customer.io/mcp` | OAuth, browser sign-in | — (no repository named) | Customer.io (official, per curated list) | not stated | not found |
| JustCall | support | remote MCP, `https://mcp.justcall.host/mcp` | API key in a header | — (no repository named) | JustCall (official, per curated list) | not stated | not found |

## What Outlore can reuse

- **Curated endpoint metadata (`itsjustanks/mcp-gallery`, MIT):** Outlore can reuse the verified vendor URLs, authentication kinds and setup-blocker taxonomy (`byo-oauth`, `approved-clients`, `admin`, `per-org`) as input to its own static `catalogEntries.ts`, while still inspecting each server's real `tools/list` to classify every tool as `Read` or `Write` by exact name.
- **One generic MCP OAuth client in the host service:** 44 of the 81 endpoints answer an unauthenticated `initialize` with HTTP 401 and a `WWW-Authenticate: Bearer` challenge pointing to OAuth protected-resource metadata (`resource_metadata`), so one standard MCP OAuth flow (browser sign-in on the vendor's own page, loopback callback, refresh and access tokens stored in the Vault) unlocks dozens of official connectors without building any connector-specific sign-in screen.
- **Vault-secret-to-env for stdio backends:** `CatalogBackend` `Stdio` today passes static `env` values (`catalog.ts:29`) and no Vault secret (`blueprint.md:60`); adding a secret-to-environment mapping (matching `yuruiz/secrets` and `DigitalOcean` / `MongoDB` stdio servers) unlocks official open-source stdio servers without exposing keys to the model or harness.
- **Exact-name tool preapproval and read-only server modes:** Paseo's `preapproved: [{ kind: "mcp", server, tool }]` and Hub's explicit Read/Write action groups confirm Outlore's exact-name classification model, and vendor read-only URL modes (GitHub `/readonly`, Supabase `read_only=true`, Neon `readonly`) can serve as an extra defence-in-depth layer where available.
- **What not to reuse:** T3 Code's per-service native adapters and custom Settings forms (conflict with Outlore's no-connector-specific-sign-in-screens rule), Paseo's unsandboxed daemon plugins and credential-file reading (conflict with the Vault and host-security rules), and `paseo-mcp`'s direct editing of Claude/Codex config files (conflicts with Outlore's single per-thread gateway and approval path).

## Ranked shortlist of 30 connectors for Outlore

Ranked against Outlore's constraints: no connector-specific sign-in screens (sign-in on the service's own page or a single API key/token in the Vault), secrets kept in the Vault and never shown to the model, every tool classified `Read` or `Write` by exact name after reading `tools/list`, and permissive OSI licences preferred.
Composio and Apple apps are omitted because Outlore already ships them.

### Tier 1: usable with Outlore's current backends (no OAuth client needed; 1–11 work on today's HTTP or stdio backend, 12–13 need Vault-secret-to-env on stdio)

| Rank | Service | Category | Delivery | Auth | Licence | Why it ranks here |
|---|---|---|---|---|---|---|
| 1 | **GitHub** | developer | remote HTTP `https://api.githubcopilot.com/mcp/` | API key/PAT in header (also OAuth) | MIT (`github/github-mcp-server`) | Highest developer utility; works today with a Vault PAT header, open-source MIT server, and offers a `/readonly` URL suffix. |
| 2 | **Context7** | docs | remote HTTP `https://mcp.context7.com/mcp` | none (keyless) | MIT (`upstash/context7`) | Live, version-accurate library documentation; zero auth setup, MIT, pure read-only value for every coding quest. |
| 3 | **Cloudflare Docs** | docs | remote HTTP `https://docs.mcp.cloudflare.com/mcp` | none (keyless) | Apache-2.0 (`cloudflare/mcp-server-cloudflare`) | Keyless, Apache-2.0, pure read-only documentation lookup; verified HTTP 200 on unauthenticated `initialize`. |
| 4 | **AWS Knowledge** | docs | remote HTTP `https://knowledge-mcp.global.api.aws` | none (keyless) | Apache-2.0 (`awslabs/mcp`) | Official keyless AWS docs and guidance; Apache-2.0, pure read-only, verified HTTP 200. |
| 5 | **Microsoft Learn** | docs | remote HTTP `https://learn.microsoft.com/api/mcp` | none (keyless) | hosted vendor service | Official keyless Azure/.NET/Microsoft docs; verified HTTP 200, zero auth friction. |
| 6 | **DeepWiki** | docs | remote HTTP `https://mcp.deepwiki.com/mcp` | none (keyless) | hosted vendor service | Keyless architecture and repo Q&A for public GitHub repositories; verified HTTP 200. |
| 7 | **Playwright** | developer | stdio npm `@playwright/mcp` | none | Apache-2.0 (`microsoft/playwright-mcp`) | Official Apache-2.0 browser automation; fits Outlore's existing vendored stdio backend with no secrets. |
| 8 | **Google Stitch** | design | remote HTTP `https://stitch.googleapis.com/mcp` | API key in header | hosted vendor service | Works on today's HTTP backend with a Vault API key. |
| 9 | **Mailchimp Transactional** | marketing | remote HTTP `https://mandrillapp.com/mcp` | API key in header | hosted vendor service | Works on today's HTTP backend with a Vault API key. |
| 10 | **HeroUI Pro** | design | remote HTTP `https://mcp.heroui.pro/mcp` | API key in header | hosted vendor service | Works on today's HTTP backend with a Vault API key; confirmed 401 header-key challenge. |
| 11 | **JustCall** | support | remote HTTP `https://mcp.justcall.host/mcp` | API key in header | hosted vendor service | Works on today's HTTP backend with a Vault API key; confirmed 401 header-key challenge. |
| 12 | **MongoDB** | data | stdio npm `mongodb-mcp-server` | connection string / key in env | Apache-2.0 (`mongodb-js/mongodb-mcp-server`) | Official Apache-2.0 database server with `--readOnly`; needs Vault-secret-to-env support in `stdioMcp.ts`. |
| 13 | **DigitalOcean** | developer | stdio npm `@digitalocean/mcp` | API key in env | MIT (`digitalocean-labs/mcp-digitalocean`) | Official MIT cloud infrastructure server; needs Vault-secret-to-env support in `stdioMcp.ts`. |

### Tier 2: unlocked by one generic MCP OAuth client (standard browser sign-in with `resource_metadata`, token in Vault)

| Rank | Service | Category | Delivery | Auth | Licence | Why it ranks here |
|---|---|---|---|---|---|---|
| 14 | **Linear** | productivity | remote HTTP `https://mcp.linear.app/mcp` | OAuth (`resource_metadata`) | hosted vendor service | Top issue tracker for software teams; standard OAuth discovery verified (also has an API-key GraphQL path outside MCP). |
| 15 | **Atlassian Rovo** | productivity | remote HTTP `https://mcp.atlassian.com/v2/mcp` | OAuth (`resource_metadata`) | Apache-2.0 (`atlassian/atlassian-mcp-server`) | Covers Jira and Confluence in one official Apache-2.0 server; standard OAuth discovery verified. |
| 16 | **Supabase** | data | remote HTTP `https://mcp.supabase.com/mcp` | OAuth (`resource_metadata`) | Apache-2.0 (`supabase/mcp`) | Official Apache-2.0 server with `read_only=true` URL parameter; standard OAuth discovery verified. |
| 17 | **Neon** | data | remote HTTP `https://mcp.neon.tech/mcp` | OAuth (`resource_metadata`) | MIT (`neondatabase/mcp-server-neon`) | Official MIT Postgres server with `readonly` URL parameter; standard OAuth discovery verified. |
| 18 | **Stripe** | payments | remote HTTP `https://mcp.stripe.com` | OAuth (`resource_metadata`) | MIT (`stripe/agent-toolkit`) | Official MIT payments server; standard OAuth discovery verified; writes naturally gated by Outlore's approval flow. |
| 19 | **Cloudflare API** | developer | remote HTTP `https://mcp.cloudflare.com/mcp` | OAuth (`resource_metadata`) | Apache-2.0 (`cloudflare/mcp-server-cloudflare`) | Official Apache-2.0 control plane (plus Workers Bindings and Observability endpoints); standard OAuth discovery verified. |
| 20 | **Notion** | productivity | remote HTTP `https://mcp.notion.com/mcp` | OAuth (`resource_metadata`) | hosted vendor service | Core knowledge base and docs store; standard OAuth discovery verified. |
| 21 | **Sentry** | developer | remote HTTP `https://mcp.sentry.dev/mcp` | OAuth (`resource_metadata`) | check before shipping (`getsentry/sentry-mcp` unclassified on GitHub) | High debugging value for error triage; standard OAuth discovery verified; verify server licence before adding. |
| 22 | **GitLab** | developer | remote HTTP `https://gitlab.com/api/v4/mcp` | OAuth (`resource_metadata`) | hosted vendor service | Primary GitHub alternative for repositories, issues and merge requests; standard OAuth discovery verified. |
| 23 | **Figma** | design | remote HTTP `https://mcp.figma.com/mcp` | OAuth (`resource_metadata`) | hosted vendor service | High-value design-to-code context; standard OAuth discovery verified. |
| 24 | **Vercel** | developer | remote HTTP `https://mcp.vercel.com` | OAuth (`resource_metadata`) | hosted vendor service | Deployments, logs and project management; standard OAuth discovery verified. |
| 25 | **Postman** | developer | remote HTTP `https://mcp.postman.com/mcp` | OAuth (`resource_metadata`) | Apache-2.0 (`postmanlabs/postman-mcp-server`) | Official Apache-2.0 API collections and testing; standard OAuth discovery verified. |
| 26 | **Todoist** | productivity | remote HTTP `https://ai.todoist.net/mcp` | OAuth (`resource_metadata`) | MIT (`Doist/todoist-ai`) | Official MIT personal task manager; standard OAuth discovery verified (note: `mcp.todoist.com` returned 502; use `ai.todoist.net`). |
| 27 | **monday.com** | productivity | remote HTTP `https://mcp.monday.com/mcp` | OAuth (`resource_metadata`) | MIT (`mondaycom/mcp`) | Official MIT work-management server with `--read-only` support; standard OAuth discovery verified. |
| 28 | **PostHog** | analytics | remote HTTP `https://mcp.posthog.com/mcp` | OAuth (`resource_metadata`) | hosted vendor service | Product analytics, feature flags and errors; standard OAuth discovery verified. |
| 29 | **Asana** | productivity | remote HTTP `https://mcp.asana.com/v2/mcp` | OAuth (`resource_metadata`) | hosted vendor service | Widely used project tracking; standard OAuth discovery verified. |
| 30 | **Airtable** | productivity | remote HTTP `https://mcp.airtable.com/mcp` | OAuth (`resource_metadata`) | hosted vendor service | Structured tables and lightweight databases; standard OAuth discovery verified. |

### Notable exclusions from the shortlist

- **Vendor OAuth gates (`approved-clients`, `byo-oauth`, `admin`):** Slack, Dropbox and Canva (`approved-clients`) reject unapproved OAuth clients; Gmail, Google Calendar, Google Drive, Google Docs, Google Sheets, HubSpot, Zoom and Meta Ads (`byo-oauth`) require the owner to register their own OAuth app; Box, Microsoft 365 and Salesforce (`admin`) require tenant administrator enablement.
  None of these can be added as one-click Outlore connectors without either vendor client registration or a separate BYO-OAuth flow; Composio remains the current bridge for them.
- **Redundant or unverified entries:** `@modelcontextprotocol/server-filesystem` duplicates harnesses' built-in file tools outside workspace sandboxes; `Shopify Dev` and `Prisma Postgres` had unverified repository URLs; `Webflow`'s repo is marked as being archived; `Zapier` overlaps Composio's meta-aggregator role.

## What I did not check

- Actual `tools/list` responses, tool counts and exact tool schemas for any of the 81 endpoints (no account was signed in and no tool was called).
- Whether any OAuth endpoint supports RFC 7591 dynamic client registration versus requiring a pre-registered client ID beyond the `resource_metadata` challenge and `mcp-gallery`'s own `setup` tags.
- Paseo Hub's own source code (`getpaseo/hub`) beyond its licence and the public docs inside `getpaseo/paseo`.
- The individual source code of the other 634 community plugins in Paseo's plugin registry beyond their index descriptions and the five plugin repositories named under Method and sources.
