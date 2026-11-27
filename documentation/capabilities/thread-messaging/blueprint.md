# Thread messaging blueprint

Status: proposed technical design under the [first slice design](../../first-slice-design.md). Retaining messages in Stopped threads until explicit resume is agreed. No acceptance check has run.

## Modules and data

Messaging exposes `send`, `reportResult`, `interrupt`, and `readConversation`. It persists messages, sender identity, sequence, requested delivery mode, delivery status, reply relationship, and result status. Threads owns lifecycle and scheduling; Messaging never starts a second turn beside an existing one.

Bind MCP calls to their sending thread. Permit its parent and direct descendants. A later reference resolver will issue validated target references for cross-tree and cross-mission messages; plain text that claims a `#` reference grants no access. Replies use the persisted originating message's authorized return target. Before reference support exists, refuse unsupported targets explicitly rather than accepting arbitrary thread identifiers.

An owner message can request Steer or Queue; Queue is the default, with no setting (CHG-0523). Execution returns whether it accepted mid-turn delivery. When unsupported, queue for the next turn and expose that outcome. Waiting, Idle, and Done receivers wake; Stopped receivers retain messages without waking. A failed receiver retains delivery for explicit recovery rather than retrying a broken process indefinitely.

Track the chatter count per unordered pair of threads. Reset it on a user message to either participant or a result in their exchange. At the configured threshold, default 20, Threads pauses both in Attention and admits no further automatic turn between them until the owner decides. Keep all triggering messages. Tests must exercise simultaneous sends at the threshold.

Interruption requires the owner or the direct parent, ends the active turn, and becomes Resting. Pending messages may then schedule another turn; Stop prevents that until resume. An interruption does not delete messages or approve actions. Lifecycle changes reject stale events by generation as defined in the shared design.

## Seams

- Execution delivery: verified Claude Code and deterministic fake adapters; the fake supports both mid-turn and next-turn modes.
- Persistence: production SQLite and temporary SQLite databases in tests. Exercise commit/retry/recovery behavior through Messaging commands, without replacing transaction semantics with a map.

## Acceptance

| Specification check | Module and test interface; stage |
| --- | --- |
| Parent/direct descendants allowed; siblings/farther refused unless referenced | Messaging `send` via bound MCP identity; basic reach included, validated references staged. |
| Cross-mission referenced target and direct reply | Reference resolver plus Messaging `send` and reply-to; staged. |
| Running-turn and next-turn delivery | Messaging `send`, fake Execution capability modes and event observations; included. Claude Code behavior needs conformance evidence. |
| Owner Steer/Queue and default setting | Messaging `send` and persisted defaults; included. |
| Wake Waiting/Resting/Fulfilled and mutually waiting threads | Messaging `send` plus Threads state and Execution observation; included. |
| Retain messages for Stopped | Messaging `send`, `readConversation`, Threads `resume`; included, including sends racing with Stop. |
| Owner and parent interruptions | Messaging `interrupt`, fake Execution cancellation; included, with refusal for other thread callers. |
| Chatter guard pauses both at limit | Messaging concurrent sends and Threads states with adjustable threshold; included. |
| Human walkthrough: steer, queue, subagent asks parent and receives answer | Desktop app with full threads through Messaging; included after live-launch gates. Phone and mirrored-subagent walkthroughs remain staged. |

## Requirements

| Requirement | Design |
| --- | --- |
| Approval per action | Messages store text and provenance, never approval grants. Only the authenticated owner's approval command may answer an approval question. |
| Local data | Messages and delivery records remain in host SQLite; future device transport follows the encrypted pairing design. |
| Future multiplayer | Sender thread, human actor, and execution host are separate identities; conversation projections exclude resource settings and credentials. |

## Open

Review the proposed delivery records, recovery behavior, and chatter reset interpretation before implementation. Cross-mission reference resolution remains staged with mission-coordination.

## Mentioning a Companion with @

Status: proposed (CHG-0777, 2026-11-27); no production code written. Serves the [Companion mention](specifications.md#mentioning-a-companion-with-) behavior: a model chosen with `@` answers one message in the same conversation while the main Companion carries on and sees both as context.

**What the code does today, and why it decides the design.** A thread has one running turn at a time, one kept harness process, and one session id, keyed by its thread id in three places that cannot be split cheaply: the router's `running` map (`core/execution.ts`, which routes interrupt and steer), each adapter's process pool (`harness/harnessProcesses.ts`, keyed by `request.threadId` and restarted when the model, effort, folder, account, or access changes), and the tool server's address and approvals, which take the thread id and its foreign keys. A second model run on the same thread id would therefore restart the main Companion's process, overwrite its interrupt route, and share its session. Running it as a synthetic id would break the foreign keys on messages, turns, and approvals.

**Recommended design: a companion thread in a hidden one-thread quest.** A message that holds a Companion mention opens, once per model and conversation, a **companion thread**: a real thread, so turns, approvals, the tool server, budgets, and process pooling apply unchanged and none of the three thread-id keys above is shared. It is the top thread of its own hidden quest (`missions.is_companion = 1`), not a child of the conversation, so it is not an errand (no errand of an errand), it never counts in the quest's tree, state, or limits, and it is found through a table `companion_threads(parent_thread_id, harness, account_id, model, thread_id, last_seen_message_id)`, which also gives the owner's rule of one resumed session per model per conversation. It takes the parent thread's workspace and permission mode, and the chosen harness, account, model, and effort.

**Measured cost of hiding it** (2026-11-27, by search): 31 service files hold 57 `is_guildmaster` conditions, about 35 of them the `is_guildmaster = 0` exclusions that keep Chronicler's quest out of lists (summaries, Chronicle, mentions, matching, realm lifecycle, inactivity, hall, usage); a new `is_companion` flag must join each of those, as a single shared SQL fragment, and every other query that lists missions by another route must be found by tests. Elsewhere 180 queries in 78 files read `threads`, which is why the companion thread is a quest of its own and not a hidden child: a child would have to be excluded from the tree, counts, rollups, deletion, and limits in all of them.

**Rejected: a second harness run on the conversation's own thread.** The router's `running` map, each adapter's process pool, the tool server's address, and the runner's per-thread state (`active`, `approvals.endTurn`, `connectorGateway.endTurn`, the thread's stored session id) are all keyed by thread id. Giving the side run its own process key fixes the pool but leaves the rest sharing state silently: the side run's end would clear the main turn's once-allowed approvals and connector snapshot and overwrite its session id.

| Part | Interface | Test seam |
| --- | --- | --- |
| Token | `@companion:<harness>:<account or ->:<model, percent-encoded>` word, `companionTokensOf(text)` in contracts beside `referenceTokensOf`; characters limited to letters, digits, `_`, `-`, `%` so a sentence's closing punctuation never joins it | contracts unit test of the token and the plain-text cases |
| Menu | `ListCompanions` request: every signed-in account's models, one row per account with its harness and account in the description, read from `harnessCatalog` and `accounts`; the Companion category and the mixed search in `mentionMenu.ts` | app test on `composerListOf` with an `@` trigger |
| Opening | `answerCompanionMentions(messageId)` in `work/`, called once the owner's message is stored: finds or makes the hidden quest and thread, then delivers one message holding the owner's words and the conversation since `last_seen_message_id` (clipped), so the companion needs no tool to read it | service test with the fake harness: a mention opens one companion thread on the named model, a second mention resumes it |
| Main thread | the message is delivered to the main thread as a context-only item that does not wake it (a flag on the message read by `listThreadsWithPending`), and, once answered, so is the answer | service test: the main thread's turn count is unchanged |
| Answering | when a companion thread's turn completes, its reply is copied into the conversation as an agent message carrying the model and account, anchored to the owner's message (the `parentEcho` path) | service test: the reply appears once, beneath the message, with its label |
| Refusals | a signed-out account, a reached budget, a reported usage limit, or a failed turn becomes the reply, in plain words with the cause and reset time when the adapter reports one | service test per cause |
| Deleting | deleting the conversation's quest deletes its hidden quests and `companion_threads` rows | service test |

Limits to state when built: the companion's cost counts to its account and to usage reports under the quest's name, but not to the quest's own budget; a hidden quest is invisible to the owner, so a failure shows only as the reply above.

Open: at most five Companions per message; a Companion's reply label `Model · Account`; no reply-to-a-reply.
