# Outlore and T3Code

Compared 2026-11-15. This is a source comparison and documentation-accuracy review, not a decision to migrate or an acceptance test of either installed product.

## Conclusion

The owner's suspicion is supported. Current T3Code implements much of the host infrastructure Outlore still plans, and also implements app-owned delegation, thread messaging, portable conversation handoffs, and scheduled tasks. Delegation and harness switching alone do not distinguish Outlore from this version of T3Code.

Before implementing Outlore's independent host, browser access, host terminals, or service updates from scratch, evaluate adapting T3Code against preserving Outlore and borrowing specific implementations. Continuing both implementations independently needs a reason tied to requirements, not the assumption that T3Code is only a Codex chat UI.

T3Code is not a drop-in replacement for the agreed product. In particular, its managed access architecture does not establish Outlore's account-free, end-to-end encrypted relay guarantee. A migration must also account for Outlore's quest documents, scoped lore, provider accounts, budgets, and approval authority, rather than preserving only the chat screens.

## Sources and meaning of status

- Outlore starting revision: `1d664b370ae350aabbcd34aec6209a89b43e6a2c`. The review used current contracts, service operations, harness adapters, app code, capability agreements, and the README. Documentation corrected in this batch does not implement the missing behavior.
- T3Code: [`pingdotgg/t3code`](https://github.com/pingdotgg/t3code/tree/0de6ddb8235debee8c7119343e1a4da9cd8b5de8), commit `0de6ddb8235debee8c7119343e1a4da9cd8b5de8`, committed 2026-11-15; server and desktop package version 0.1.9. The [primary-source research note](t3code.md) owns the upstream file/line citations, implementation detail, beta labels, searches, and limitations behind the T3Code column below.
- "Implemented" here means a concrete source path was found. It does not mean this session ran the feature, verified the release artifact, or proved all failure cases.
- "Planned" means agreed behavior without its corresponding application implementation. An agent's ability to run a shell command is not an app-owned feature with its own state, controls, and lifecycle.

## Overlap that matters now

Every T3Code finding in this table is detailed and cited in the [upstream note](t3code.md). The Outlore links point to the current implementation or the agreed unbuilt design.

| Capability | Outlore now | T3Code at the inspected commit |
| --- | --- | --- |
| Host independent of the desktop window | Not built. Electron forks the utility process and kills it on quit ([main.ts](../../apps/desktop/src/main.ts#L49-L66)); [ADR 0018](../architecture-decision-record/0018-host-service-runs-on-its-own.md) is a plan. | Standalone `t3` host with a Node single-executable build. |
| OS-managed background service | Planned, including login start and crash recovery ([0018](../architecture-decision-record/0018-host-service-runs-on-its-own.md#L9-L15)). | Implemented service definitions for systemd, launchd, and Windows Task Scheduler. |
| Browser access to the host | Built as a first step (CHG-0286, CHG-0287): a plain browser pairs with a running desktop host over the end-to-end encrypted relay channel, checked against a local relay and locally served build. The shared relay now serves the web app (CHG-0287, deployed; [0019](../architecture-decision-record/0019-browsers-use-the-relay-served-web-app.md)), but a pairing from another network to a real Mac is not yet seen, and the host still lives and dies with the desktop app. | Browser/server architecture and managed connection code exist. This does not imply equivalent encryption or no account requirement. |
| Host-owned terminals | Not built. PTYs and their IPC handlers currently live in Electron ([main.ts](../../apps/desktop/src/main.ts#L154-L187)); moving them is [ADR 0020](../architecture-decision-record/0020-terminals-run-in-the-host.md). | Host-side `node-pty` manager, persisted terminal history, and multiple-viewer sizing rules. |
| Service-side update and recovery | Desktop updater built; unattended host updates remain planned ([0018](../architecture-decision-record/0018-host-service-runs-on-its-own.md#L14-L15)). | Staged service update prepare/commit and database rollback code exist. |
| App-owned delegated threads | Built. `open_thread` creates a persisted child with a selected harness/model/effort and backups; it inherits the parent's workspace ([tree.ts](../../packages/service/src/work/tree.ts#L42-L70)). | `delegate_task` creates app-owned child threads with independent model selections; these are distinct from provider-native child displays. |
| Messages to children and follow-up work | Built. Thread messages and results are persisted and delivered into turns ([messaging.ts](../../packages/service/src/work/messaging.ts#L80-L145), [thread tools](../../packages/service/src/work/threadTools.ts)). | `t3_thread_send` exposes queued, steered, and restarted delivery, including further work for completed app-owned children. |
| Cross-harness conversation handover | Built but bounded. Stored text messages are replayed; images are named, tool results omitted, oldest messages dropped beyond half the context window ([handover.ts](../../packages/service/src/work/handover.ts#L168-L219)). | Portable handoffs are implemented, also with a bounded history and explicit exclusions. This is not transfer of private reasoning or complete harness state. |
| Scheduled work | Rituals built, with fallback Companions; they need the local service running ([rituals.ts](../../packages/service/src/work/rituals.ts#L19-L25)). Webhook triggers and workflow graphs are not built. | Scheduled tasks implemented. Their retry, missed-run, and permission rules should not be assumed identical to Rituals. |
| Worktrees and Git workflow | Agents can use Git and the sandbox recognizes linked worktrees. No app-managed Own copy/create/merge flow was found in the contracts, thread tools, or UI ([workspace status](../capabilities/workspace-attachment/specifications.md)). | Dedicated Git/worktree implementations are covered in the upstream note. |
| Human collaboration and execution on another machine | Human guest access and cross-installation execution are future work; device pairing represents the owner, not a guest ([architecture](../architecture.md#future-multiplayer-open-architecture-questions)). | Guest links and linked peer-machine delegation have beta code/docs. This is not proof that they meet Outlore's guest permission and revocation rules. |
| Threads without a project | Borderlands quests work in a scratch folder Outlore keeps; their lore is the quest's own plus global. | Threads without a project work in a per-thread scratch folder, can be promoted to a project, and agents can start them. No lore layer. |
| Scoped memory (global, workspace, thread) | Built: scoped lore with fading and promotion, per-quest briefing and journal. | Not found in the docs, contracts or server file names read (see the [upstream note](t3code.md#projects-threads-without-a-project-and-memory)); an absence from a bounded reading. This is the strongest difference found. |
| Mobile | A browser client exists as a first step, with no phone layouts; native phone builds remain unbuilt ([architecture](../architecture.md)). | Native mobile source exists; this review does not establish store availability or successful mobile operation. |

## Requirements that a reuse decision must preserve

### The managed connection is a material difference

Outlore requires that a relay cannot read paired-device traffic, that users need no central account, and that reaching a host requires no additional VPN or tunnel tool ([requirements](../requirements.md#privacy-and-data), [access](../requirements.md#access)).

T3 Connect's inspected design explicitly uses a trusted broker with account authentication. The relay Worker does not proxy sessions; after bootstrap, clients reach the host through a managed tunnel hostname to its loopback HTTP origin, with credentials the relay issues. The source review did not find application-layer end-to-end encryption in that path. Transport encryption and authenticated clients are not the same guarantee as a relay that can only forward ciphertext. See the upstream note's connection findings and scope before generalizing this to every possible T3 deployment.

Using T3Code's managed access unchanged would not meet the current Outlore requirement. An extension would need to preserve Outlore's encrypted channel, supply another equivalent route, or ask the owner to change the requirement. Its local/self-hosted routes must be evaluated separately; a managed route is not proof that all local use needs a paid account.

### Product rules still need an explicit mapping

The [outline](../outline.md) includes quests with a shared journal and briefing, scoped lore, Chronicler's app-wide role, several sign-ins per harness, budget enforcement, ordered fallback Companions, and future guest authority. Similar thread and agent names do not establish those same rules.

Before choosing T3Code as the base, trace a representative quest through:

1. A parent and independently modeled child that both receive the same briefing and the correct lore.
2. A message from the child reaching the parent, and the owner steering the child.
3. A switch to another harness/account that preserves the expected conversation.
4. A budget limit stopping the appropriate work without broadening an approval.
5. Remote control from a browser through a connection satisfying the agreed privacy and account rules.
6. A host restart/update followed by reconnection without a person at the host.

These are proposed evaluation checks, not checks performed in this session. Avoid building a second competing orchestration service merely to retain Outlore vocabulary.

## Options

| Option | What it avoids | What still needs proof |
| --- | --- | --- |
| Use T3Code as it is | Maintaining another coding-agent workspace for ordinary use. | Whether its current behavior and remote-access choices are acceptable to the owner. It is not the complete agreed Outlore product by definition. |
| Extend or fork T3Code | Rebuilding its host, Git, terminals, updates, delegation, and client infrastructure. | Whether Outlore's quest/lore/budget/access rules fit its state model without maintaining a large divergent fork. Migration and release maintenance remain real work. |
| Keep Outlore and borrow selected implementations | Replacing Outlore's existing quest, lore, budget, and harness-account state. | Which upstream modules have boundaries that can be reused without also importing their entire runtime and persistence model. |
| Keep building all overlapping features independently | Adapting upstream architecture or tracking a fork. | A requirement-based justification for the duplicate implementation and its ongoing maintenance. Existing investment alone is not that justification. |

Recommendation: evaluate the extension/fork option against selective reuse before building the pending host/browser batch. Do not authorize a replacement from this source review alone, and do not dismiss it on the claim that delegation or handover is unique to Outlore.

T3Code's inspected license is MIT. Any later source reuse must preserve its copyright and permission notice and check the licenses of the particular dependencies/assets imported. Outlore's existing architectural decision allows selected earlier upstreams, not an automatic wholesale migration to this one. No T3Code code was copied in this batch.

## Documentation corrections from the comparison

The source review found both overstatements and obsolete "not built" labels:

- App-managed repository cloning and Own copy/one-button merge were advertised but their service and UI operations were not found.
- The architecture mixed agreed future workflows, webhook delivery, native-subagent mirroring, browser access, and handover summarization with implemented flows.
- The full external MCP/skill selection policy is unbuilt. Current skill discovery and `/skill` path instructions are a smaller implemented feature.
- Handover is not a lossless full harness transcript. Chronicler's handover and Ritual fallback are implemented despite older exclusions.
- The app's agent instructions described a phone web app as already running; it is planned.
- The original tabless panel description predates the implemented Companions tab.
- Chronicler's help text still claimed no updater and no paired-host folder picker, and advertised the unbuilt one-button worktree flow.

Corrections preserve the agreed future behavior and dated evidence. They do not silently reduce the requirements to match today's code. This was a focused audit of the comparison's claims and affected guidance, not an exhaustive verification of every capability or old working-state entry.

## Verification scope

Source inspection and the repository's checks are recorded with the completed documentation batch in the [changelog](../changelog/0.1.4-Prototype.md). Earlier verification records remain earlier evidence, not checks repeated here.

Neither T3Code nor Outlore was driven as an installed application for this comparison. No live provider, real pairing, guest access, mobile build, upstream test suite, or release/update workflow was exercised. Runtime quality, performance, operational cost, release maturity, and migration effort are not measured by this review.
