# Connectors

## Implementation status · 2026-11-16

Specified, not built, except Code Mode's core (CHG-0441, 2026-11-17): its executor, its tool and its global setting exist in the service, proven against a fake gateway; with no gateway yet, no thread is offered it. Agreed with the owner on 2026-11-16 (CHG-0321). The Charter place exists (CHG-0444, `apps/app/src/charter/`) with only its Connectors section holding the Code Mode switch, which reads and writes `shouldUseCodeMode`; no connector, no Vault, no per-quest or per-realm switch exists in the service or the app. Which community server serves the Apple connector is not chosen (see Exclusions). Research: [code-mode-autonomy-connectors-2026-11-16.md](../../research/code-mode-autonomy-connectors-2026-11-16.md). Design: [blueprint](blueprint.md) and [ADR 0022](../../architecture-decision-record/0022-the-vault-encrypts-secrets-and-hides-its-folder-from-sandboxes.md), both proposed (CHG-0328).

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
- A side-quest follows its quest and has no choice of its own. A Ritual's quest follows its realm and its own choices like any other quest.
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

- **One global setting at the top of the Charter's Connectors section**, **Code Mode for connectors**, off by default and marked experimental (CHG-0324; placed in the Charter, not the Workshop, by CHG-0325). On, a thread reaches its usable connectors' tools by writing a short piece of code that calls them, instead of having each tool listed and called one by one. The aim is fewer calls, fewer tool definitions in the thread's context and less intermediate data in it; these gains are not yet measured.
- It changes only how connector tools are shown and called. Which connectors a thread can use, the switches, the questions and standing permissions, the Vault and the warnings behave as above: a write made by the code asks the owner while the code runs, the thread waits in Attention, and a denied or switched-off call comes back to the code as an error. It never governs a harness's own Bash, file or editing tools, and Outlore's own thread tools stay as they are.
- There is no per-quest or per-connector option at first; the Inherit, On, Off choice above can carry one later if trials show a need. A change of the setting applies from a thread's next turn.
- It was agreed to come after the native connectors; on 2026-11-17 the owner chose to build its core first (CHG-0441), with the code run in QuickJS inside the host ([ADR 0023](../../architecture-decision-record/0023-code-mode-runs-in-quickjs-inside-the-host.md)). Its switch is in the Charter, which holds nothing else yet (CHG-0444); the rest of the Charter comes with the connectors.

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

## External contract

- No new thread tool is added by this capability. A usable connector adds tools to the thread under its own name; the tool server of Outlore's thread tools is unchanged.
- A connector's tools are classified by its catalog entry, never by the server's own labels.

## Acceptance and validation

- **Automated, with a fake connector server and fake harnesses**:
  - installing makes a connector enabled for every quest, realm and Chronicler, once connected; not connected, no thread gets its tools;
  - the global switch off hides it everywhere, even where a quest says On;
  - Inherit, On, Off and Reset resolve as above for a quest, a side-quest, a realm, the Borderlands and a Ritual's quest; a moved quest keeps its choices; a deleted quest forgets them;
  - switching off stops a call in a turn underway at once; switching on applies at the next turn;
  - a tool switched off is absent from the thread's tools, the connector's Tools list shows it off, a call to it stops at once in a turn underway, and it is absent from generated code; the thread's panel lists tools with the off ones marked;
  - a read-only tool runs unasked and leaves a Steps line; an unclassified tool and a write tool ask once per call; Always allow covers that tool only, in the right scope; a tool that cannot be classified asks every time;
  - a failing connector warns, is marked Needs connecting, and the turn goes on; the same connector on Claude Code, Codex and OpenCode;
  - a secret, once entered, appears in no conversation, journal, lore, log, tool result, paired-device reply or relay message, and is gone when its connector is removed;
  - Apple apps refused on a host that is not a Mac, and its permission requested only from the host's window;
  - with Code Mode on, the same connector gives the same results and the same questions as without, a write asks while the code runs, a switched-off connector's call fails inside the code, and nothing outside connector tools is reachable from it; with it off, tools are listed as before.
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
- [thread-tree](../thread-tree/specifications.md): side-quests follow their quest.
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
