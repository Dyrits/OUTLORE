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

Status: built (CHG-0781, 2026-11-27) as the hidden one-thread quest below; tested with the fake harness, not on a live harness or in a window. Serves the [Companion mention](specifications.md#mentioning-a-companion-with-) behavior: a model chosen with `@` answers one message in the same conversation while the main Companion carries on and sees both as context.

**What the code did, and why it decided the design.** A thread has one running turn at a time, one kept harness process, and one session id, keyed by its thread id in the router's `running` map, each adapter's process pool, and the tool server's address and approvals. A second model run on the same thread id would restart the main Companion's process, overwrite its interrupt route, and share its session; running it as a synthetic id would break the foreign keys on messages, turns, and approvals. The turn scopes (CHG-0780) made a run of its own possible, but a side run would still have needed a per-run MCP endpoint token and a guarded failure path.

**Built: a companion thread in a hidden one-thread quest.** A message that holds a Companion mention opens, once per model and conversation, a **companion thread**: a real thread, the top thread of its own quest of kind `companion` (`missions.is_companion = 1`, migration `0082_companion_mentions`), found through `companion_threads(parent_thread_id, harness, account_key, model, thread_id, mission_id, last_seen_message_id)`. Its turns, approvals, tool server, budgets and process pooling are the ordinary ones; it has its own thread id, so no store of the conversation's own thread is shared, **the side-run scope and the per-run MCP token were not needed** and stay reserved (the failure path is therefore not scope-guarded: a Companion's failure is the ordinary `recordTurnFailure` of its own thread, which also writes the refusal line). It takes the conversation's workspace, own copy and permission mode each time it is asked, no backups, `effort default`. It is not an errand (no errand of an errand), never counts in the conversation's tree, state or limits, and is a quest of its own only for storage.

**Hiding it.** `questVisibility.ts` gives the `companion` kind its condition (`m.is_companion = 1`) and takes it out of the `owner` kind, so every list that asks the module leaves it out; its `kindConditions` table was the only place to change. Lists that read quests by another route were found by a test that calls the list requests (`ListMissions` with a search, `ListMentionables`, `ReadChronicle`, `ReadGuildmaster`, `ReadGuildHallRecap`, `ReadBudget`, `ReadPermissions`, `ListRituals`, `ReadAccountBudgets`, `ReadUsage`, and the conversation's own thread list) and asserts no hidden id appears. `ListOpenQuestions` is the one list that keeps showing a hidden quest's open question, on purpose: it must be answerable. The usage page reads a Companion's spend under the quest it answered in (`usageScope.ts`, `reportedMissionOf`), so no hidden quest is a row of its own, while budgets read the raw mission column and do not count it.

| Part | Interface | Test |
| --- | --- | --- |
| Token | `@companion:<harness>:<account or ->:<model, percent-encoded>`; `companionWordsOf` in `marks.ts`, and `companionTokenOf`, `companionReferenceOf`, `companionTokensOf` (at most five, each once), `withoutCompanionTokens` in `companionMentions.ts` of contracts; characters limited to letters, digits, `_`, `-`, `%` so a sentence's closing punctuation never joins it | `contracts/test/companionMentions.test.ts`, `marks.test.ts` |
| Menu | `ListCompanions` request (`companionChoicesOf` over the harness list): one row per model of every signed-in account of a harness that can run; the composer's `@` list (`composerList.ts`, `mentionMenu.ts`: Companions category, search by model, harness or account) offered only in a quest's or errand's box (`mentions.canAskCompanions`) | `apps/app/test/ui/composerList.test.ts`, `marks.test.ts`; `companionQuests.test.ts` |
| Asking | `insertOwnerMessage` (`companionAsking.ts`), in the send handler: a message with tokens, or a follow-up with `frameMessageId` (CHG-0786), is stored as the owner's, conversation-only (shown delivered, never admitted) and `askCompanions` finds or makes each Companion's thread (merging existing frame Companions with any new `@` tokens up to five), delivers it one owner message holding the words and the conversation since `last_seen_message_id` (clipped to 12,000 characters, without that Companion's own earlier exchanges), records an exchange under `frame_message_id`, and returns the Companions' threads to wake. Chronicler's conversation leaves the tokens as plain text | `companions.test.ts` |
| Main Companion | `companion_exchanges.is_context_shared` and `context_turn_id` (migration `0083`, CHG-0786): exchanges stay unshared (`0`) until the owner calls `ShareCompanionFrame`, which marks answered rows shared without waking the thread; `readCompanionContext` reads only `is_context_shared = 1 AND context_turn_id IS NULL` when the main thread's turn is admitted (`turnAdmission.ts`), headed by `messageMarks.companion.deliveryHeading`; it is never a pending message, so it cannot start a turn, and a failed turn gives it back | `companions.test.ts` (opt-in share, outdated after follow-up, told once) |
| Answering | when a Companion's turn completes (`completeTurn`), `answerExchanges` copies its last message since it was asked into the conversation as an agent message carrying its harness, model and account label (`senderTitle`), anchored to the owner's message (`reply_to_message_id`); the detail flags `isCompanionAnswer`, `companionFrameId`, and per-frame `companionFrameContext` (`"None" \| "Shared" \| "Outdated"`), and the app draws the frame with inline follow-up and context actions (`exchangeFrame.tsx`) plus a conditional jump list beside Find (`sideChats.ts`, `sideChatsMenu.tsx`); copied replies are left out of a handover's "conversation so far" | `companions.test.ts`, `companionAnswers.test.ts` |
| Refusals | `readCompanionRefusal` before delivery (account gone, harness not installed, signed out, budget reached through `reachedScopesOf`, plan window at 100% through `PlanLimits`), `refuseOverBudget` at admission (no hold in an invisible quest), `recordTurnFailure` for a failed turn, `refuseUnansweredExchanges` at start: each writes `Cannot answer: <cause>` as the reply and drops the questions the Companion's thread was given | `companions.test.ts`, one test per cause |
| Approvals | the conversation's `questions` include its Companions' (`listCompanionQuestions`), so the owner answers where the Companion was asked | `companionQuests.test.ts` |
| Tools | `readCallerRefusal` lets a companion thread call only `request_approval` and `answer_prompt` | `companionQuests.test.ts` |
| Context | `companionInstructionsOf` replaces the quest thread's instructions; no journal, no naming nudge; lore is the conversation's | startingContext tests unchanged |
| Deleting | `deleting.ts` marks, cancels and erases the companion threads of every deleted conversation, with their rows | `companionQuests.test.ts` |

Limits: a Companion's cost counts to its account and to usage reports under the quest's name, but not to the quest's own budget; a hidden quest is invisible to the owner, so a failure shows only as the reply above; an approval question of a Companion does not mark the quest as needing the owner outside its conversation.

Settled in the build, to redirect: the answer is the Companion's last message of the turn; several Companions answer as they finish, not in the order of their chips; a mention in Chronicler's conversation or a Ritual's run is plain text; the reply label is `Model · Account`; a second question that arrives while the Companion answers the first is steered into the running turn and the turn's one answer is copied under the latest; attachments are not forwarded to a Companion in this build.
