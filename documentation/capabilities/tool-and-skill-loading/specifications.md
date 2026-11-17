# Tool and skill loading

## Implementation status · 2026-11-15

This capability is partially implemented. The agreed management and loading behavior below is not a description of everything the current app does.

- The service lists skills in the workspace and the owner's home, from `.agents/skills` and `.claude/skills`. Workspace entries win over global entries; within either scope `.agents/skills` currently wins regardless of the chosen harness. Unreadable entries are omitted rather than putting the thread in Attention ([skills.ts](../../../packages/service/src/work/skills.ts#L9-L50)).
- When an owner's message names a discovered `/skill`, the service appends its path and an instruction to read it. This is a file-reading instruction, not a dedicated Skill tool or automatic loading of every enabled skill's body. The list in the picker or panel does not prove the harness has loaded those instructions ([skills.ts](../../../packages/service/src/work/skills.ts#L53-L62), [messaging.ts](../../../packages/service/src/work/messaging.ts#L103-L120)).
- Outlore's own thread tools are implemented through the local MCP server. Outlore-managed external MCP configuration, per-thread server/skill selections, thread-scoped skill installation, conflict dialogs, and the complete cross-harness loading policy below are not built. Existing configuration a harness may load itself is not equivalent to this management feature ([threadTools.ts](../../../packages/service/src/work/threadTools.ts#L8-L11), [Claude Code configuration](../../../packages/service/src/harness/claudeArgs.ts#L194-L219), [Codex configuration](../../../packages/service/src/harness/codex.ts#L72-L86), [OpenCode configuration](../../../packages/service/src/harness/opencode.ts#L152-L165)).

These findings are from source inspection, not a new live-harness check. The acceptance list below still describes the complete target.

**Connectors replace its MCP-server rules (CHG-0321, 2026-11-16).** For the connectors the owner installs, scope is global with a choice per realm, the Borderlands and quest (side-quests follow their quest), not workspace and thread; installation, enabling, approval and secrets are agreed in [connectors](../connectors/specifications.md). The MCP-server rules below (workspace-scoped servers, a per-thread disable inherited by threads beneath, conflicting global and workspace names) now apply only to custom MCP servers the owner would add, which stay deferred. Skills are unchanged. The rule that a failed external server warns and the turn goes on, and the rule that thread tools stay enabled, still hold.

## Problem and outcome

A thread needs the tools and instructions in scope for its work, even when its harness changes. Outlore gives each harness the selected skills, external MCP servers, and its own thread tools. The user can see what a thread receives and where it came from.

## Agreed behavior

### Build scope and future hosted access

- Version 1 serves the installation's owner. The sources, management views, and selections below describe that single-user build.
- Future hosted missions follow the [shared resource access agreement](../../architecture.md#future-multiplayer-open-architecture-questions) (CHG-0018). The sharing toggle applies to agents regardless of who triggers a turn. It retains the host's selected MCP connections, skills, and intel by default; with it off, all turns use only resources explicitly selected by the host.
- Guests see mission conversations and results, while resource settings, credentials, and unshared intel stay hidden. Enabled resources may contribute information to agent replies. Guest permission to trigger agents grants no approval or budget authority.
- Collaboration across installations remains future design work; this capability defines no resource import or synchronization between installations.

### Sources and management

- Workshop lists global skills and MCP servers, replacing their management location in the Workshop under the [left navigation agreement](../mission-tracking/specifications.md#left-navigation-structure) (CHG-0134, specification only).
  Each workspace lists its own.
  Each thread shows its effective list, sources, disabled entries, and which copy won a name conflict.
- Global skills come from the existing skill folders, including `~/.agents/skills` and `~/.claude/skills`. Workspace skills come from its `.agents/skills`, `.claude/skills`, and equivalent supported harness folders.
- Global skills are available to every thread. Workspace skills apply to threads attached to that workspace. Skills installed in a thread apply to it and the threads beneath it, as defined in the [glossary](../../glossary.md).
- Version 1 manages MCP configuration specifically in Outlore, at global and workspace scope. It does not import existing harness MCP configuration. This replaces the earlier proposal to read each harness's configuration.
- The same configured MCP servers are available regardless of the chosen harness.
- Installation of skills through the app is deferred. Existing skill folders supply skills in version 1.

### Name conflicts

- For the same skill name, the narrower scope wins: the thread, then its nearest ancestor with that skill, then its workspace, then global.
- Within one scope, prefer the chosen harness's folder, then `.agents/skills`, then a skill found only in another harness's folder. Claude Code prefers `.claude/skills`; Codex uses `.agents/skills`.
- A handover resolves names again for the new harness. The thread's effective list shows the selected copy.
- If different copies still tie after these rules, the thread asks the user to choose and remembers the choice for that thread.
- If global and workspace MCP servers share a name, the thread asks the user which to use. A workspace server does not automatically replace a global one.

### Selecting and loading skills

- The user can disable individual skills before a thread starts and change the selection later. Threads opened beneath it inherit that selection.
- At the start of a turn, the harness receives each enabled skill's name, description, and location. It reads the full instructions when the user requests the skill or the agent chooses to use it, and reads supporting files as needed.
- Skill file edits and selection changes take effect on the next turn. The current turn keeps the instructions it started with.
- A harness that does not discover skills itself receives the enabled skill names, descriptions, and locations in its starting context. Workspace instructions from `AGENTS.md` and `CLAUDE.md` follow [workspace attachment](../workspace-attachment/specifications.md#what-a-workspace-gives-its-threads).
- An unreadable or invalid skill entry, or a requested skill whose instructions cannot load, puts the thread in Attention. The user can fix or disable it and retry. Unused skill bodies do not consume the starting context.

### Selecting and loading MCP servers

- The user can disable external MCP servers per thread. Threads opened beneath it inherit that selection.
- MCP configuration changes take effect on the next turn; a current turn keeps its starting configuration.
- A failed external MCP server is reported in the thread as a warning. The other servers load and the turn continues.
- Outlore's own thread tools stay enabled. If they fail to load, the turn fails, with the reason, and the thread offers **Retry** (a Failed thread, which counts among those needing the owner). Claude Code reports the server's status in its start-up event and Codex in a start-up status notification, and both are read; OpenCode's is not yet read (CHG-0377).
- The local service enforces thread-tool access, regardless of what instructions a harness received. See [0005](../../architecture-decision-record/0005-thread-tools-over-mcp.md).

### Another workspace

- A thread opened in another workspace gets that workspace's skills and MCP servers, plus global entries.
- It inherits its parent's thread-scoped skills and disabled-skill choices, and its external MCP server selection. Its parent's workspace entries do not follow it.
- A thread with no workspace has global and thread-scoped skills and global MCP servers, subject to its inherited selection.

## External contract

- Every supported harness receives the effective skills and MCP servers through its adapter.
- Outlore's thread tools remain available over its local MCP server. Their individual contracts belong to the capabilities that define them.
- This capability adds no new thread tool contract in version 1.

## Acceptance and validation

- **Automated, with fake harnesses and temporary configuration folders**:
  - global entries reach threads with and without a workspace; workspace entries reach only threads attached to that workspace;
  - skills with the same name resolve by scope, then harness folder preference, and resolve again after a handover;
  - unresolved skill ties ask the user and remember the choice for the thread; conflicting global and workspace MCP names ask the user;
  - enabled skill names, descriptions, and locations reach the harness at turn start; full instructions load only when a skill is requested or selected, and supporting files load as needed; disabled skills are excluded;
  - invalid or unreadable skill entries and failures to load requested instructions put the thread in Attention until fixed or disabled and retried;
  - a thread opened beneath another inherits its selections; choosing another workspace replaces workspace entries while preserving global and thread-scoped entries;
  - configuration and skill edits affect the next turn without changing the current turn;
  - a failed external server produces a warning and allows the turn to continue; failed Outlore thread tools produce Attention with Retry;
  - thread-tool access stays enforced by the local service;
  - Outlore uses its own MCP configuration without changing or importing existing harness configuration.
- **Human acceptance**: inspect a thread's effective list from desktop and phone; disable a skill and an external MCP server; start a turn and check the selection; invoke a skill and check that its instructions load then; edit a skill and check its use on the following turn; change harness and check the preferred skill copy; fail an external server and then Outlore's thread tools and check the different outcomes.

The user accepted the scope, validation plan, and agent additions on 2026-11-05 (CHG-0022). These are the full agreed acceptance criteria, not a record that they all pass. The partial implementation above has focused tests in [skills.test.ts](../../../packages/service/test/work/skills.test.ts); the complete management and loading acceptance remains outstanding.

## Requirements

- [Local data](../../requirements.md): skill sources and MCP configuration remain on the computer, except what the harness or connected service needs for the work; paired-device access uses the encrypted connection.
- [Approval per action](../../requirements.md): loading a tool or skill does not grant permission for risky actions. [Action approval](../action-approval/specifications.md) still applies.
- [Bring your own provider and comply with provider terms](../../requirements.md): provider sign-in remains with each harness.

## Dependencies

- [workspace-attachment](../workspace-attachment/specifications.md): workspace sources and instructions.
- [thread-tree](../thread-tree/specifications.md): scope inheritance and Attention.
- **thread-handover**: resolving sources for a new harness.
- [action-approval](../action-approval/specifications.md): permissions on actions performed with loaded tools.
- **device-pairing**: the same management views from the phone.

## Exclusions

- Importing existing harness MCP configuration in version 1.
- Installing skills through the app in version 1.
- Disabling Outlore's own thread tools.
- Changing a running turn's tools or instructions.
