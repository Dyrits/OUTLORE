# Handoff: connectors specification (Charter, Vault, Code Mode), nothing built

Supersedes: none
Workspace: ISKIOS repository (Outlore), branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Specify connectors for Outlore: tools of outside services and apps (first Composio and Apple apps) that the owner installs once and switches on or off per realm, per quest and per tool, with secrets kept in a Vault on the host and Code Mode as an experimental setting. Done for this stage means the specification is agreed and recorded; building has not been authorized.

## State

- **Verified by reading the files on 2026-11-16**: the capability is written in `documentation/capabilities/connectors/specifications.md` (agreed behavior, acceptance, exclusions, technical notes) and `draft.md` (open items only); agreements are CHG-0321 to CHG-0327 in `documentation/changelog/0.1.6-Prototype.md`. CHG-0327 was renumbered from a second CHG-0323 that another thread used for computer use; the connectors files cite 0327.
- **Verified**: also written for this capability: the requirement *Connector secrets stay on the host* (`requirements.md`), glossary terms Charter, Connector and The Vault, the outline line, a supersession note in `tool-and-skill-loading` (its MCP-server rules now apply only to deferred custom servers), the Charter row in `mission-tracking`, a Tools line in `thread-panel`, backlog items, and a work-in-progress entry.
- **Verified by reading source**: Outlore passes harnesses only its own MCP server (`claudeArgs.ts` `--strict-mcp-config`; `codex.ts:216` declines other servers); the Charter is a sidebar placeholder (`apps/app/src/shell/placeCatalog.ts`); Outlore's 24 thread tools are about 19,400 characters.
- **Verified from the local binary and schema, no harness run**: Claude Code 2.1.322's init message carries `tools`; Codex 0.169.0's app-server schema lists MCP tools (`mcpServerStatus/list`) but no built-in tool listing. OpenCode's `GET /experimental/tool/ids` is from its documentation only; over `acp` it is unchecked.
- **Not built**: no connector, Vault, switch, Charter page or setting exists in code. Nothing was run against Composio, Apple apps or any connector server.
- Research for this lives in `documentation/research/code-mode-autonomy-connectors-2026-11-16.md` (Code Mode, Prime Agent, Unharnessed, Composio, Apple servers, OpenBot).
- Git: the files were committed on `main` with this handoff; a push was requested by the owner and needed their approval. Check `git status -sb` and `git log origin/main..main` for whether it happened.

## Decisions

- Connectors live in the Charter, a marketplace-like sidebar place that holds only connectors and The Vault (CHG-0321, CHG-0326).
- Installed means global and enabled once connected; a global master switch; an Inherit, On, Off choice per realm, the Borderlands and quest; side-quests follow their quest; Chronicler follows the global switch alone; switching off applies at once, on at the next turn (CHG-0321).
- Read-only tools (as classified by Outlore's catalog, not the server's hints) run unasked; every other tool asks, Always allow per tool; a tool that cannot be classified (Composio's execute) asks every time (CHG-0321).
- Each connector's card lists its tools with a global switch per tool; the thread panel lists effective tools; no per-realm tool switch, no reclassification (CHG-0325).
- Composio is in the first slice with an install notice (its service stores the connected apps' sign-ins); Apple apps is Mac-only, apps chosen at install, macOS permission requested only from the host's window (CHG-0321).
- Apple server: `mcp-icloud` pinned, because it has separate read and write tools; `macos-mcp` hides them behind an `action` argument (CHG-0322, owner delegated).
- The Vault: a Charter section; encrypted records, key in the OS secret store where reachable, else an owner-only key file shown plainly (CHG-0327). Details need a blueprint and an ADR.
- Code Mode for connectors: one global setting at the top of the Charter's Connectors section, off by default, experimental, built after native connectors, connector tools only (CHG-0324, CHG-0325).
- Tools line and the Borderlands' choice are in the right sidebar (CHG-0326).
- Sources of reasoning: Anthropic's legal page says Claude subscription OAuth is for Claude Code and native apps; so Prime or Unharnessed as a backend should use API keys only (research note, Part 1).

## Next

1. Confirm with the owner whether to start the blueprint for connectors: the connector gateway (serving tools through the per-thread MCP endpoint with approval through `askOwner`), the Vault, how tools are classified, and making the Vault unreadable from inside harness sandboxes (their file reads are broad by default). Write ADR 0022 or the next free number for the Vault. Do not build before they authorize it.
2. Then a first slice: Charter page with a connector list, install, the global, realm, Borderlands and quest switches, approval by tool, then Composio and Apple apps.
3. Later: Code Mode after an executor is chosen (a local sandbox for generated code; none evaluated), and a measurement of its gains.

## Open questions

- Which group of the thread panel holds the tools line (owner).
- Whether The Vault holds other secrets later (owner).
- How `mcp-icloud` behaves on the owner's Mac: speed on a real inbox, reading Messages (needs `imsg` and Full Disk Access), a headless host, permission prompts (a check once built).
- Whether Composio's session can be narrowed to classified actions so some of its calls could run unasked (read its docs on restricting toolkits).
- Whether an OpenCode `acp` process can answer `/experimental/tool/ids` (needed only if built-in tools are listed).
- The Vault library or tool per platform and its behavior on a headless Linux host (blueprint).

## Sources

- `documentation/capabilities/connectors/specifications.md`, `documentation/capabilities/connectors/draft.md`
- `documentation/changelog/0.1.6-Prototype.md` (CHG-0321 to CHG-0327)
- `documentation/research/code-mode-autonomy-connectors-2026-11-16.md`
- `documentation/requirements.md`, `documentation/glossary.md`, `documentation/backlog.md`, `documentation/work-in-progress.md`
- `documentation/capabilities/tool-and-skill-loading/specifications.md`, `documentation/capabilities/mission-tracking/specifications.md`, `documentation/capabilities/thread-panel/specifications.md`, `documentation/capabilities/action-approval/specifications.md`
- `packages/service/src/work/mcp.ts`, `threadTools.ts`, `harness/claudeArgs.ts`, `harness/codex.ts`
- External, read 2026-11-16: Composio (`ComposioHQ/composio` f19794c), OpenBot (`nightly-labs/openbot` dfb9d81), `MrGo2/icloud-mcp` 2.2.2, `krmj22/macos-mcp` 4.1.0, `cloudflare/agents` 9b73399, Anthropic's [legal and compliance page](https://code.claude.com/docs/en/legal-and-compliance)
