# Connectors

## Implementation status · 2026-11-19

The owner authorized the build on 2026-11-19. Built and proved on fakes (CHG-0538, [verification](../../verification/2026-11-19-connector-gateway.md)): the catalog entries, the stored choices (migration `0062_connectors`), who may use what, the gateway (listing, calls, asking, stopping at once, errors and secrecy), the owner's requests `ListConnectors`, `InstallConnector`, `RemoveConnector`, `SetConnectorSwitch`, `SetConnectorTool` and `ChooseAppleApps`, and the wiring into the tool server and the three harnesses, with a scripted fake backend. The Vault (CHG-0537, 2026-11-19: encrypted records and key custody in `packages/service/src/vault/`) is joined to the gateway behind its `VaultPort` and has its owner requests `ReadVault`, `PutSecret`, `ReplaceSecret`, `RemoveSecret` and `VerifyClaudeVaultDenial`, with Claude Code's denial kept as a stamp keyed to its version and sandbox settings (CHG-0539, [verification](../../verification/2026-11-19-vault-gateway-join.md)). The HTTP backend and Composio's tools are built (CHG-0540, [verification](../../verification/2026-11-19-http-mcp-composio.md), [research note on Composio's own docs and repo](../../research/composio-mcp-2026-11-19.md)): a Streamable-HTTP MCP client with the key in the entry's header, proved against a real local fake MCP server; the Composio entry names the seven meta-tools its Connect endpoint publishes, the two pure discovery tools classified `Read` and the five that execute, connect or run code `Write`. The stdio backend and the Apple apps are built and proved on a real stdio server (CHG-0541, [verification](../../verification/2026-11-19-stdio-apple-backend.md)): the stdio MCP backend over the shared line transport in `core/`, the 41 tools of the pinned `mcp-icloud@2.1.4` (vendored, run by a system Node) classified and offered by app, and the host-only `RequestApplePermission` request. The four were merged into one service wiring and proved together ([verification](../../verification/2026-11-19-connectors-merge.md)): the real Vault, an HTTP connector and a stdio connector both listed in one turn and both called. CHG-0543 adds the Charter connector and Vault sections, the realm and quest choices, and the read they use. CHG-0544 adds the thread panel's tools line, using each connector's last cached listing. CHG-0545 to CHG-0547 fix what independent reviews found: transport metadata and lifecycle safety, Apple app permission readiness and revocation, and, from the security review, redirects never followed so a key header cannot reach another origin, a Grep or Glob that would walk into the Vault's folder from above refused, and the denial probes asked afresh at every protection read so an install or upgrade counts at once. Not verified: the real Composio server (no key held), the real macOS Automation prompt (run on a Mac outside a sandbox), a live Claude Code denial probe. Code Mode (CHG-0441, 2026-11-17; CHG-0447, 2026-11-18): its executor, its tool `run_code` and its global setting exist in the service, proven against a fake gateway, and with Code Mode on a thread reaches Outlore's own tools by code even with no gateway yet. Agreed with the owner on 2026-11-16 (CHG-0321). The Charter includes the Code Mode switch (CHG-0444), connectors and the Vault (CHG-0543). Code Mode was widened on 2026-11-18 (CHG-0446, CHG-0447) to every tool a thread reaches through Outlore's own tool server, its own thread tools as well as the connectors', and works with no connector (see [Code Mode](#code-mode)). The Apple connector uses the pinned mcp-icloud 2.1.4 server (CHG-0322 and CHG-0541). Research: [code-mode-autonomy-connectors-2026-11-16.md](../../research/code-mode-autonomy-connectors-2026-11-16.md). Design: [blueprint](blueprint.md) and [ADR 0022](../../architecture-decision-record/0022-the-vault-encrypts-secrets-and-hides-its-folder-from-sandboxes.md), both proposed (CHG-0328).

## Problem and outcome

Threads can act only on the computer and on what their harness already reaches. The owner wants them to use outside services and apps (a mailbox, a calendar, hundreds of web services) without a harness-by-harness setup, without a question for every harmless read, and with a say over which quests may use what. A **Connector** gives threads the tools of one service or app; the owner installs it once, and chooses where it is available.

## Agreed behavior

### The Charter

- The Charter, the sidebar place after Reserves, holds the owner's **Connectors** and **The Vault**, and nothing else (CHG-0326). It works like a marketplace: it lists every connector Outlore offers, installed or not, with what each does, and the owner installs, connects, switches and removes them there.
- Connectors and the Vault are managed from the owner's host, from the host's window and from any paired device (the encrypted connection carries what is typed). The one exception is a macOS permission, which only the host's own window can request (Apple apps, below).

### Install, connect, enable

- Outlore lists the connectors it offers; the first are **Composio** and **Apple apps**. The owner **installs** one: it is then on this computer, global, and **enabled everywhere by default** (CHG-0321).
- **Connected** is a separate state: the owner has given the connector what it needs (a key kept in the Vault, a sign-in, a macOS permission). An installed connector that is not connected shows **Needs connecting** with what is missing, and no thread is given its tools.
- A connector is **usable** by a thread only when it is installed, connected, and enabled for the thread. Removing a connector forgets its choices, its secrets in the Vault, and its standing permissions.
- Each connector's card has a **global switch**, on once installed: the master switch. Off, the connector is unavailable everywhere, whatever any realm or quest says.

### Where a connector is available

- Each realm, the Borderlands, and each quest has a choice per installed connector: **Inherit** (the default), **On** or **Off**. The interface shows an ordinary switch with an "inherited" mark and a **Reset** that goes back to Inherit. A quest inherits from its realm or the Borderlands, a realm and the Borderlands from the global switch; an explicit choice beats the level above it, short of the global switch being off.
- An errand follows its quest and has no choice of its own. A Ritual's quest follows its realm and its own choices like any other quest.
- **Chronicler** follows the global switch alone: it is given every installed, connected connector whose global switch is on.
- A quest that moves to another placement keeps its own choices; what it inherits follows its new placement. Archiving and restoring a realm keeps its choices; deleting a quest deletes its choices.
- The realm's panel and the quest's panel each list the installed connectors with their switches. The connector's card in the Charter shows its global switch and the Borderlands' choice. The Borderlands' choice is in the right sidebar, in the Borderlands' panel (CHG-0326), whose contents are otherwise undecided; until it exists the choice is on the connector's card only.
- A change of harness (handover) keeps the same connectors: they do not belong to a harness.
- **When a change takes effect.** Switching a connector off, anywhere, stops its calls at once, including in a turn underway; switching it on, or Reset, takes effect at the thread's next turn. A call stopped this way tells the thread the connector is off for it.

### What a thread can do with a connector

- A thread sees a usable connector's tools that are switched on, under the connector's name, and calls them like its other tools. Outlore's own thread tools are not connectors and are never switched off by them.
- A connector that fails (unreachable, a rejected key, a refused macOS permission) puts a warning line in the thread, marks the connector **Needs connecting** with the reason, and lets the turn carry on without it.
- The same connectors work on every harness.

### A connector's tools

- Each connector's card in the Charter has a **Tools** list (CHG-0325): every tool of the connector (of the chosen apps, for Apple apps), with its name, what it does in plain words, whether it runs unasked (read-only) or asks, and a **switch**, on by default. The list is the same on every harness.
- A tool that is switched off is offered to no thread and cannot be called, in any quest, realm, the Borderlands, Chronicler or generated code. The switch is global: there is no per-realm or per-quest switch for a tool. Switching off stops its calls at once, switching on applies at a thread's next turn, as for a connector. A tool's switch does not change how it is classified, and the owner cannot reclassify a tool in this version.
- Each thread's panel lists its **tools**: Outlore's own thread tools and the tools of its usable connectors, with those switched off marked as off. A harness's own built-in tools are listed only where its adapter reports them, which none does yet; they differ by harness. This extends the effective list agreed in [tool and skill loading](../tool-and-skill-loading/specifications.md).

### Asking

- A tool the connector's catalog entry classifies as **read-only** runs without a question, and leaves a line in the thread's Steps like any other call. The server's own claims about its tools do not count: a tool the catalog entry does not classify asks.
- Every other tool asks the owner one question per call, with Allow, Always allow and Deny, as in [action approval](../action-approval/specifications.md): in plain words, details on request, answerable from any device, the thread waiting in Attention with no time limit, so a Ritual's run waits too.
- **Always allow** grants a standing permission for that tool of that connector, in the thread's workspace (or its quest when it has none), widenable to everywhere from the Permissions page and removable there. A permission for one tool never covers another.
- A connector whose single tool runs any action chosen inside the call (as Composio's session does) cannot be classified by its tools: every call asks, unless a standing permission covers that tool.
- Words never approve a connector call, as for any action. Chronicler's questions are asked in its own conversation.

### Code Mode

- **One global setting at the top of the Charter's Connectors section**, **Code Mode**, off by default and marked experimental (CHG-0324; placed in the Charter, not the Workshop, by CHG-0325; widened beyond connectors, and renamed from "Code Mode for connectors", by CHG-0446 and CHG-0447). On, a thread reaches the tools of its tool server by writing a short piece of code that calls them, instead of having each tool listed and called one by one: its usable connectors' tools and Outlore's own thread tools. The aim is fewer calls, fewer tool definitions in the thread's context and less intermediate data in it. Measured so far (2026-11-18, no connector): the listing a thread is given is 7% smaller (20,077 characters of JSON against 18,619), because the tools' descriptions stay in the code tool's declarations; the gain of chained calls and of results that never enter the context is not measured.
- **Widened by the owner's instruction, 2026-11-18** (CHG-0446). The owner pointed at [Cloudflare's Code Mode](https://blog.cloudflare.com/code-mode/), which turns the tools an agent is given, those of its MCP servers and those the application defines, into one typed API, gives the model a single tool that runs code against it, and lets it chain calls and read back only the result, said this is exactly what Code Mode is for and that it should do many things, and told Claude to implement it. The first reading of CHG-0324, which limited Code Mode to connector tools, is replaced. Outlore gives every thread exactly one such source of tools, its own tool server (one per thread, [ADR 0005](../../architecture-decision-record/0005-thread-tools-over-mcp.md)), which serves its usable connectors' tools and Outlore's own thread tools; Code Mode applies to that whole server.
- **What it covers.** With the setting on, a thread reaches by code every tool of its tool server except the four that stay direct (below): its usable connectors' tools, and Outlore's own thread tools such as `open_thread`, `save_intel`, `read_journal` or `send_thread_message`. One tool, `run_code`, runs the code; a covered tool is no longer listed and a direct call to one is refused ("Code Mode is on: call X from code, with run_code."). In the code, connector tools are `connectors.<connector>.<tool>(input)` and Outlore's own tools are `outlore.<tool>(input)`, each declared as TypeScript types in the tool's description.
- **What it never covers.** A harness's own Bash, file, editing and web tools: they are not MCP tools, they are listed and run by the harness, and they keep their own permission prompts and sandbox. The code reaches nothing but the tools above: no files, network, environment or process ([ADR 0023](../../architecture-decision-record/0023-code-mode-runs-in-quickjs-inside-the-host.md) is unchanged on this). MCP servers other than Outlore's own are not passed to a harness today, so none is covered; if the owner later adds some (see Exclusions), whether they join is for that decision.
- **Every call is as strict as a direct call.** Each call from code goes through the same checks as the same call made directly: the caller checks (the chatter guard, a thread that does not exist), the argument checks, the owner's questions and standing permissions, and each tool's own effects. A tool that asks the owner (a connector write, `create_ritual`, `act_on_mission`) asks while the code runs; the thread waits in Attention with no time limit, and a refusal or a denial comes back to the code as an error. Approvals never move into the code: nothing the code writes counts as the owner's words. Claude Code runs `run_code` unasked, only while Code Mode is on, because every tool it covers already runs unasked and asks in its own handler when it must.
- **Four tools stay direct**, listed and called as before, and are never reachable from code: `request_approval` and `answer_prompt` (Claude Code asks its own permission prompts through it) exist to put a question to the owner and be seen doing it; `report_result` ends the thread's turn; `suggest_mission` stops the thread until the owner chooses where a message goes.
- **Limits of a run.** The executor's stand: 5 s of running time with waiting not counted, 64 MB, an answer cut at 24,000 characters, 200 calls. Calls to tools that start or redirect other work (`open_thread`, `send_thread_message`, `interrupt_thread`) are counted apart: at most **5** a run, a call past the fifth, refused ones included, throws into the code ("Not done: one run may make at most 5 calls that start or redirect other work. Go on in another run."). Without Code Mode a thread can already open threads one call at a time; the count keeps one run from opening a flood. The number 5 is Claude's recommendation, taken on the owner's instruction, and the owner may change it.
- **The same on every harness.** Claude Code, Codex and OpenCode all receive Outlore's tool server, so Code Mode needs nothing of a harness beyond listing tools, calling one and waiting for its answer. A harness that could not reach the tool server would not be offered Code Mode, and its thread panel would say so; none exists today.
- **With no connector, it still works.** The code tool then declares Outlore's own tools alone, so the switch has an effect, and can be measured, before any connector exists.
- **When a change takes effect.** The setting is read once, when a thread's turn starts, and holds for that turn: the tool server answers under the setting the turn's harness listed its tools with. A change of it is part of each harness's restart key, so a harness that keeps its process between turns (all three do) restarts it and lists its tools again at the next turn. A thread's turn underway keeps its listing, and its calls keep the answers of it, when the setting is flipped.
- **The setting's name.** Its stored name, `shouldUseCodeMode`, is unchanged. The Charter's label is "Code Mode", marked Experimental, with a plain explanation: a thread reaches Outlore's tools and its connectors' tools by code, a tool that asks still asks, a thread's own commands and file edits are not affected, a change applies from the next turn.
- **How a run shows.** The harness reports a run as one tool call, shown in the thread's steps as "Run code that calls its tools"; the calls the code makes are not reported separately.
- There is no per-quest or per-connector option at first; the Inherit, On, Off choice above can carry one later if trials show a need.
- It was agreed to come after the native connectors; on 2026-11-17 the owner chose to build its core first (CHG-0441), with the code run in QuickJS inside the host (ADR 0023). Its switch is in the Charter, which holds nothing else yet (CHG-0444); the rest of the Charter comes with the connectors.

**Decisions taken on the owner's instruction "implement it properly" (2026-11-18), each as recommended; the owner can redirect any:** which of Outlore's tools are callable (all but the four); the cap of 5 work-starting calls a run; covered tools hidden from the listing, not listed as well; no harness left without it; `shouldUseCodeMode` kept, the label "Code Mode" and the tool `run_code`; the setting read once per turn; the measurement made first on what exists (the listing's size); the specification kept here, a capability of its own, `code-mode`, being a later and separate change.

### The Vault

- **The Vault** holds the secrets of connectors (a key, a token) on the host, and nowhere else. The owner enters a secret once, from the host's window or a paired device; it is then never shown again, only its connector, its kind (such as "API key") and when it was added. The owner can **Replace** or **Remove** it. Removing a connector removes its secrets.
- A secret is never given to a model, a harness, a thread, a paired device or the relay, and never written to a conversation, a journal, lore or a log. A thread never needs it: the service uses it when a connector's tool is called.
- The Vault is a section of the Charter, beside Connectors (CHG-0327). Whether it holds anything but connector secrets is not agreed.

### Composio

- Composio is an opt-in connector that needs the owner's own account at Composio and its key, kept in the Vault. Installing it shows a notice and needs the owner's confirmation: Composio's service stores the sign-ins of the apps connected through it, and sees what its tools return; Outlore holds none of those sign-ins.
- Connecting an app through Composio happens on Composio's own page, not in Outlore.

### Apple apps

- Apple apps works only when the host is a Mac; on another host it shows **Needs a Mac** and cannot be installed there.
- At install the owner chooses which apps: **Calendar**, **Reminders**, **Notes** and **Contacts** (on by default), and **Mail**, **Messages** and **Safari** (off by default, since they read private content and can reach other people). The choice can be changed later.
- The notice at install says that what the tools read, such as an email's text, goes to the model provider of the thread, and that macOS will ask for each chosen app.
- The host's own window asks macOS for each chosen app's permission at install, with a button to ask again. From a paired device the connector shows **Permission needed on the computer** and the toggles work, but the permission cannot be requested there. A refusal shows **Not allowed by macOS** with where to change it (System Settings, Privacy & Security, Automation).
- The Charter on either device shows the latest permission check for each chosen app. After a host service restart, check again on the computer before a thread can use Apple tools. Unchecked or refused apps are unavailable, and a checked app can still work while another chosen app needs permission. If a tool reports that macOS has refused access, Outlore marks that app as needing permission again and withdraws its tools from active turns. A later successful host check restores them for the next turn. Messages checks access through the vendored server's `imsg` helper and may need Full Disk Access.

## External contract

- No new thread tool is added by this capability. A usable connector adds tools to the thread under its own name; the tool server of Outlore's thread tools is unchanged. Code Mode adds one tool, `run_code`, in place of the connector tools and of the thread tools it covers (all but `request_approval`, `answer_prompt`, `report_result` and `suggest_mission`); the tool is listed only while Code Mode is on.
- A connector's tools are classified by its catalog entry, never by the server's own labels.

## Acceptance and validation

- **Automated, with a fake connector server and fake harnesses**:
  - installing makes a connector enabled for every quest, realm and Chronicler, once connected; not connected, no thread gets its tools;
  - the global switch off hides it everywhere, even where a quest says On;
  - Inherit, On, Off and Reset resolve as above for a quest, an errand, a realm, the Borderlands and a Ritual's quest; a moved quest keeps its choices; a deleted quest forgets them;
  - switching off stops a call in a turn underway at once; switching on applies at the next turn;
  - a tool switched off is absent from the thread's tools, the connector's Tools list shows it off, a call to it stops at once in a turn underway, and it is absent from generated code; the thread's panel lists tools with the off ones marked;
  - a read-only tool runs unasked and leaves a Steps line; an unclassified tool and a write tool ask once per call; Always allow covers that tool only, in the right scope; a tool that cannot be classified asks every time;
  - a failing connector warns, is marked Needs connecting, and the turn goes on; the same connector on Claude Code, Codex and OpenCode;
  - a secret, once entered, appears in no conversation, journal, lore, log, tool result, paired-device reply or relay message, and is gone when its connector is removed;
  - Apple apps refused on a host that is not a Mac, and its permission requested only from the host's window;
  - with Code Mode on, the same connector gives the same results and the same questions as without, a write asks while the code runs, a switched-off connector's call fails inside the code, and nothing outside the tools of Outlore's tool server is reachable from it; with it off, tools are listed as before.
  - **Outlore's own tools (CHG-0446, CHG-0447):** with Code Mode on, a thread's listing holds the code tool and the direct tools, and a direct call to a covered thread tool or connector tool is refused; a thread tool called from code gives the same answer, the same questions and the same refusals (the chatter guard, invalid arguments) as called directly; a tool that asks the owner asks while the code runs, the thread waits in Attention, and a denial reaches the code as an error; `request_approval`, `answer_prompt`, `report_result` and `suggest_mission` are absent from the code and still listed; the lower per-run count for tools that start work is enforced; with no connector the code tool still reaches the thread tools; a harness's own Bash, file and edit tools are untouched; a setting flipped during a turn changes nothing until the next turn, on a reused harness process too (the restart key; checked in code and in tests with the fake harness, not on a live Claude Code, Codex or OpenCode); the same on Claude Code, Codex and OpenCode (not checked live).
- **Human acceptance**: install Composio and Apple apps in the Charter; switch one off for a realm and on for one quest in it, and check what a thread there can use; read a calendar entry unasked and create one after a question; remove the connector and check its secret is gone from the Vault; do the same from a phone, and check that the macOS permission can only be requested at the Mac.
- The authorization of these agreements is in [CHG-0321](../../changelog/0.1.6-Prototype.md). Passing the checks above is delivery, not agreement.

## Requirements

- [Connector secrets stay on the host](../../requirements.md): the Vault.
- [Local data](../../requirements.md): what leaves the computer is only what a connected service needs for the work; Composio's and the model provider's reach is told at install.
- [Approval per action](../../requirements.md): connector writes ask, one action per question.
- [End-to-end encrypted phone traffic](../../requirements.md): a secret typed on a paired device crosses only the encrypted connection.
- [Nearly free to run](../../requirements.md): the project pays for no connector's service; each owner's account pays its own.
- [Fully open source](../../requirements.md): every component a connector needs, and any server Outlore offers, must be under an OSI-approved licence.

## Dependencies

- [action-approval](../action-approval/specifications.md): questions, standing permissions, Attention.
- [mission-tracking](../mission-tracking/specifications.md): realms, the Borderlands, quest moves, the Charter in the sidebar.
- [thread-tree](../thread-tree/specifications.md): errands follow their quest.
- [thread-panel](../thread-panel/specifications.md): each thread's effective tools.
- [tool-and-skill-loading](../tool-and-skill-loading/specifications.md): a failed server warns and the turn goes on; the connector rules here replace its MCP-server rules for installed connectors.
- [mission-coordination](../mission-coordination/specifications.md): Chronicler.
- [rituals](../rituals/specifications.md): a Ritual's quest.
- **device-pairing**: managing connectors and the Vault from a paired device.

## Exclusions

- Code Mode per quest or per connector, and which place runs the code (technical).
- Which server serves Apple apps: left to the technical notes (the owner delegated the choice on 2026-11-16, CHG-0322); a different server can replace it without changing this specification.
- Workspace-level or custom MCP servers added by the owner, per-realm or per-quest tool switches, reclassifying a tool, a Charter-wide list of every harness's built-in tools, importing a harness's own MCP configuration, and skills.
- A connector's own sign-in screens: sign-ins happen on the service's page or in macOS.
- Hosted multiplayer: only the host manages connectors and the Vault.
- Connectors that run for other people's quests in a hosted mission.

## Technical notes (not agreed behavior)

- **Which harness can report its own tools** (read 2026-11-16, for the thread panel's tools line): Claude Code 2.1.322's init message carries `tools`, its tool names (found in the local binary); Codex's app-server protocol (generated by `codex app-server generate-json-schema`, codex-cli 0.169.0) lists MCP servers' tools (`mcpServerStatus/list`) but has no method for its built-in tools; OpenCode documents `GET /experimental/tool/ids` on its HTTP server, and whether the `acp` process Outlore runs can answer it is not checked.
- **Code Mode's executor** (CHG-0441, [ADR 0023](../../architecture-decision-record/0023-code-mode-runs-in-quickjs-inside-the-host.md)): QuickJS compiled to WebAssembly (`quickjs-emscripten-core` 0.32.0, single-file synchronous build), a fresh runtime per run in the host service, with only the ECMAScript built-ins, `console` and `connectors.<connector>.<tool>(input)`; limits of 5 s of running time (waiting for a call does not count), 64 MB, 200 calls, and an answer cut at 24,000 characters. The thread sees one tool, `run_connector_code`, whose description declares the usable tools as TypeScript types, after `@cloudflare/codemode`'s design (MIT, read at 0.5.6, not a dependency). Each call in the code goes through `ConnectorGateway.call`, the same as a listed tool's. The setting is `shouldUseCodeMode` in the owner's settings; Claude Code runs the tool unasked, the gateway asking per write. With Code Mode on, a direct call to a connector tool is refused.

- A connector gateway inside the service serving each connector's tools through the per-thread MCP endpoint, with approval through `askOwner`, is the recommended design; a harness's own MCP configuration would not give one approval path (`codex.ts:216`; Claude Code runs with `--strict-mcp-config`).
- **Apple server** (chosen under the owner's delegation, CHG-0322): `MrGo2/icloud-mcp` (MIT), pinned to one version, in its local AppleScript mode. Reason: it has separate tools for reading and for writing (`list-*`, `search-*`, `delete-*`, `send-*`), which Outlore's per-tool classification needs; `krmj22/macos-mcp` puts read, create, update and delete behind one tool with an `action` argument (`src/tools/definitions.ts`), which cannot be classified by tool. It also covers all seven apps and was last committed 2026-11-15. Weaknesses, checked in its README only: Messages needs the `imsg` tool and Full Disk Access, and AppleScript reads of a large mailbox may be slow. Replaceable: the catalog entry names the server and version.
- **Vault storage** (direction agreed by the owner, CHG-0327; the details are proposed in the [blueprint](blueprint.md) and [ADR 0022](../../architecture-decision-record/0022-the-vault-encrypts-secrets-and-hides-its-folder-from-sandboxes.md), CHG-0328): encrypted records on the host, with the key held in the operating system's secret store when the host can reach one (macOS Keychain, Windows DPAPI or Credential Manager, a Linux Secret Service) and otherwise in a key file only the owner's user can read, with The Vault saying so. Electron's `safeStorage` does not fit alone: the host runs as its own Node program (ADR 0018), and on Linux without a secret store `safeStorage` falls back to a hardcoded password. A secret must also be unreadable from inside the harnesses' sandboxes, which read broadly by default.
