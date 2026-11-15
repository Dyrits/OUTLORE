# T3Code: primary-source notes

Researched 2026-11-15 from a clone of [`pingdotgg/t3code`](https://github.com/pingdotgg/t3code) at commit `0de6ddb8235debee8c7119343e1a4da9cd8b5de8` (committed 2026-11-15T06:31:01-08:00; server and desktop packages 0.1.9). License: MIT, "Copyright (c) 2026 T3 Tools Inc." (`LICENSE`). Paths below are relative to that commit.

This is a bounded reading of its own README, user documentation, internals notes and source file names. Nothing was installed or run: no upstream tests, no live provider, no release artifact. A statement that a source path exists does not show the feature works. [The comparison](outlore-t3code-comparison.md) uses these notes.

## What the project says it is

`README.md`: "The open-source control plane for coding agents." It "runs the coding agents on your machine and gives them one fast interface". Supported: Claude Code, Codex, Cursor, OpenCode, Grok Build, Antigravity, Kiro, Pi, Muse Code, fx, and any ACP agent. Listed features include "Change models in the middle of a thread. Let Claude hand a task to Codex", "Desktop, web, and phone", "Run agents on any machine. Connect over your local network, Tailscale, or T3 Connect", and "Each thread can work in its own worktree. Review the diff, then commit, push, and open a pull request with one button." The repository has `apps/desktop`, `apps/mobile`, `apps/server`, `apps/web`, and many `packages/provider-*` and `packages/source-control-*` packages. iOS and Android store links are in the README.

## Findings by topic

### Standalone host and background service

- `docs/user/background-service.md`: "On Linux, macOS, and Windows, T3 Code can run as a service for your user so you do not need to keep a terminal open." Commands: `t3 service install|status|restart|uninstall`, `t3 up`, `t3 status`, `t3 update`.
- `apps/server/src/serviceLauncher.ts` handles systemd units, launchd and Windows `schtasks` (it calls `schtasks /Create /XML ... /TN`). The Windows section of the user documentation says Task Scheduler starts the task again within a minute if it exits.
- The server is its own app (`apps/server`) rather than a child of the desktop window.

### Remote access and T3 Connect

- `docs/user/remote-access.md`: a machine can have several routes (LAN, Tailscale, another VPN, a public URL, SSH, T3 Connect). T3 Connect needs sign-in to a T3 Connect account; "Each T3 Connect account can link up to 3 machines." Tailscale HTTPS is a separate documented route that needs no T3 account.
- `docs/internals/t3-connect.md` (lines 4-10, 44): the relay Worker handles bootstrap, credentials and "managed tunnel allocations"; after bootstrap "clients send application traffic through the environment's tunnel hostname; the relay Worker does not proxy their HTTP or WebSocket sessions." The section "The relay is a trusted broker" says the relay vouches for identities, with an optional `requireConnectDeviceApproval` that makes the environment trust device keys (DPoP thumbprints) instead. Managed tunnels expose only a validated loopback HTTP origin.
- `infra/relay/README.md`: the relay is "the hosted control plane", linking environments to "a cloud account", provisioning "managed environment endpoints" and delivering mobile notifications. `docs/operations/connect-setup.md` names Clerk for authentication.
- No application-layer end-to-end encryption was found in the relay, docs or server paths searched (`grep` for "end-to-end"/"e2ee" over `infra`, `docs`, `apps/server/src` found nothing in the relevant design notes). Not found is not proof it is absent.

Consequence for Outlore: the managed route needs an account and a hosted control plane, and the tunnel path is not an encrypted channel through an untrusting relay. Outlore's requirement (a relay that cannot read traffic, no central account) is not shown by this route. The other routes (LAN, Tailscale, SSH, public URL) are separate and need their own comparison; Outlore's requirement of no extra VPN tool applies to those too.

### App-owned delegation and messaging

- `apps/server/src/server.ts:862` and `apps/server/src/orchestration-v2/` mention `delegate_task`, including delegation "to a linked environment" (`RemoteDelegatedTask.test.ts`, `DelegatedTaskQuestionReactor.ts`, `DelegatedCompletionDelivery.test.ts`). `ProviderRuntimeRecoveryService.ts:112` describes "A delegate_task child. Its own thread is reconciled and continued on its own", so a delegated child is its own persisted thread.
- Thread messaging with steering policies is in `orchestration-v2/CommandPolicy.ts:19` (`active_steering`, `interrupt_restart`) and queued messages appear in `CheckpointCaptureService.ts`. The `t3_thread_send` tool name appears in the server and web sources.
- `docs/user/providers-acp.md:124`: "Child-task presentation depends on what" the agent reports, so provider-native subagent display is a separate, adapter-dependent feature.

### Portable handoffs

`docs/user/portable-handoffs.md`: short conversations "transfer intact"; longer ones favor "recent requests and answers, the original request, and relevant activity such as command outcomes"; "A handoff does not copy the outgoing provider's reasoning, tool-call state, or attachments"; it is "a budgeted selection, not an agent-written summary"; omitted history stays retrievable through a thread-reading tool. Implementation: `orchestration-v2/ContextHandoffService.ts` and `ContextHandoffDelivery.ts`. Compared with Outlore's handover ([handover.ts](../../packages/service/src/work/handover.ts#L168-L219)), T3's selection is smarter (it keeps command outcomes and offers a retrieval tool); both replace messages, neither moves harness session state.

### Terminals, Git and worktrees

- Host-side terminals: `apps/server/src/terminal/` with `NodePtyAdapter`; `apps/server/package.json` depends on `node-pty`.
- Git: `packages/source-control-*` (GitHub, GitLab, Bitbucket, Azure DevOps, Forgejo and others); `docs/user/source-control.md` covers the workflow. The README says one button reviews the diff, commits, pushes and opens a pull request. Worktree creation per thread is claimed in the README; `apps/server/src/worktreesDirectory.ts` and `apps/server/src/git/` exist, but the worktree and merge logic itself was not read.

### Scheduled tasks, guests and linked machines

- Scheduled tasks: referenced in `docs/user/project-settings.md:81` ("Scheduled tasks on mobile"), `docs/user/managed-policy.md:191` and `:249` (`webhookTasks: false`: "scheduled tasks cannot use webhook triggers"), so scheduling and webhook triggers both exist. Retry and missed-run behavior was not read.
- Guests: `docs/user/guest-links.md`: "Guest links are a beta", enabled in Settings, Labs; a teammate follows one thread in a browser with no account, and "Each message they send waits until you send or dismiss it." They need T3 Connect, and the machine must stay online.
- Linked machines: `docs/user/devices.md` and the remote `delegate_task` code; labelled beta where the documents say so.

### Projects, threads without a project, and memory

Checked 2026-11-15 against the then-current HEAD `3e7f5ecc55c532ce60e6b1c48f210e17f3c8c9d1` (newer than the pinned `0de6ddb`; docs read only, not rerun on the pinned commit).

- Threads without a project exist: `docs/user/thread-sidebar.md#start-without-a-project`. Each works in its own folder under `~/.t3/scratch` (named by date, first words of the first message and a short id) that survives thread deletion; branch, worktree and diff controls are hidden because the folder is not a Git repository; "Turn into project" promotes the folder in place. `docs/orchestration-v2/orchestrator-mcp-server.md:350`: `scratch: true` launches without a project, so agents can start them too. This is comparable to Outlore's scratch folder for Borderlands quests, without a lore layer.
- Per-project state found: settings overrides (`docs/user/project-settings.md`), project scripts and scheduled tasks.
- Memory not found: searching `docs/user`, `docs/orchestration-v2` and `packages/contracts/src` for memory, lore, knowledge, journal and briefing found only RAM or in-memory-state hits. What exists is thread search (`apps/server/src/orchestration-v2/ThreadSearch.ts`), a thread-reading tool for history omitted from a handoff, and whatever instruction files the agent itself reads from the repository. No scoped (global, project, thread) knowledge injected into new threads was found. Absence in the files read, not proof.

### Policy and accounts

`docs/user/managed-policy.md` describes organization limits that apply to threads "that users start, agents start, and scheduled tasks start". A per-quest budget, scoped lore, or several sign-ins of one harness as separate choices, as Outlore specifies, were not found in the files read; `docs/user/usage.md` was only skimmed for budgets. These absences are unverified.

## Not checked

- Whether any feature works in the shipped build; the upstream test suite; performance.
- Retry, missed-run and permission rules of scheduled tasks.
- The worktree and merge logic, and the service update flow: `serviceLauncher.ts` and `server.ts` mention updates and rollback and `apps/server/src/desktopUpdate/` exists, but staged prepare/commit and database rollback behavior were not read.
- Mobile store availability and operation beyond the README's links.
- Any budget enforcement, lore scoping, or multiple accounts per harness.
- Licenses of individual dependencies and assets (`third-party-licenses/` exists).
