# Thread messaging

Technical design: [proposed blueprint](blueprint.md), including the first slice's staged acceptance.

## Problem and outcome

Subagents in today's harnesses report once at the end and cannot be asked or redirected along the way. Threads in a mission talk in both directions while they work, and the user can write to any of them, so work can be asked about, corrected, and coordinated as it happens.

## Agreed behavior

### Who can message whom

- A thread can message its parent and the threads directly beneath it. Siblings reach each other through their parent.
- When the owner mentions a quest or errand with `#` in a message, the thread that receives it may, for the turn that message reaches, read that quest's journal (`read_journal` with `mission`) and message the quest's top thread, or the errand itself (CHG-0181). The receiving thread decides from the owner's words whether to do either. The quest that receives such a message may answer its sender in the turn the message reaches, so the reply comes straight back (see [mission-coordination](../mission-coordination/specifications.md#references-between-quests)).
- Without a mention, a thread reaches another quest only through Chronicler (formerly Guildmaster). A thread cannot widen its own reach by writing a `#` reference: only the owner's messages count.
- A Ritual's run instruction is a service-made message, not a live owner message; its mentions grant no reach.
- The user can write to any open thread, including a subagent's (for mirrored subagents, see [thread-tree](../thread-tree/specifications.md#subagents)).
- Every message shows its sender: the user, or the sending thread.

### Mentions with #

Agreed 2026-11-11 (CHG-0181, with `@`; built in CHG-0182); moved to `#` on 2026-11-27 (CHG-0777), when `@` was kept for Companions (below), `+` for files and `$` for skills.

- In any message box (a quest's, an errand's, Outlore's), a bare `#` lists three categories with their icons: Realms (a keep), Quests (a sword), and Errands (a branch). Arrow keys and Enter open a category; Backspace right after the `#` returns to the categories. As soon as text follows the `#`, the list mixes the matches of every category, each under its heading. `#` is offered wherever the message box can offer a mention, with or without a linked folder.
- Realms lists every realm, tied to a folder or not. Quests lists every quest not archived; Errands lists the errands of those quests, shown as `Quest › Errand`. Chronicler's own conversation is never offered. Archived quests and their errands are left out entirely.
- A chosen realm, quest, or errand becomes a chip with its icon and its name, in the message box and in the sent message. The message holds a one-word token with the id: `#realm:<realm id>`, `#quest:<quest id>`, or `#side-quest:<thread id>`. A token naming a quest since archived or deleted shows as "quest no longer open".
- A mention is context only. The owner's text reaches the thread unchanged, followed by a block the service adds as it delivers the message, one line per mention with its ids, for example `Quest "Fix login" (id …, state Running, realm Outlore, top thread id …)` and `Realm "Outlore" (id …, folder …)`. The receiving thread decides from the owner's words whether to read the quest's journal, write to it, or neither.
- The widened reach (above) holds only for quests and errands the owner named, only in the turn the message reaches, and never for an archived quest. A realm mention opens nothing: it only says which realm is meant.
- **Old words are plain text** (owner, 2026-11-27): a message stored before CHG-0777 with `@quest:<id>`, `@side-quest:<id>`, `@realm:<id>`, or an `@path` shows those words as typed and grants no reach; only `#` words are read. A thread's own `#` word in a message it writes (a suggestion's text, for one) loses its `#`, as its `@` did.
- On the phone and other builds that cannot draw chips inside the text, the chosen token is written into the text as typed; the categories still show.

### Files with + and skills with $

Agreed 2026-11-27 (CHG-0777). The `+` list was `@`'s files category, and the `$` list was the `/` skills list; their behavior is otherwise unchanged ([workspace-attachment](../workspace-attachment/specifications.md#naming-files-and-folders-with-), [tool-and-skill-loading](../tool-and-skill-loading/specifications.md)).

- Typing `+` at the start of a word lists the files and folders of the message's linked folder; with no linked folder it offers nothing. A chosen path is written `+<path>` and shows as a chip; `./` was tried first and replaced the same day because root files such as `.gitignore` read badly after it (owner, 2026-11-27). A `/` at the start of a word no longer opens anything, so a path such as `/Users/me` is plain text, and the slash is free for commands.
- Typing `$` at the start of a word lists the skills; a chosen skill is written `$name`, shows as a chip with a puzzle piece, and the service appends its path and an instruction to read it. A `$` word that names no skill (`$5`) is plain text. A message stored with `/name` is plain text and appends nothing.

### Mentioning a Companion with @

Agreed in outline 2026-11-27 (CHG-0777); built 2026-11-27 (CHG-0781, see the [blueprint](blueprint.md#mentioning-a-companion-with-)). Checked with a fake harness; not yet in a desktop window, on the phone, or on a live harness.

- Typing `@` at the start of a word in a quest's or errand's message box shows a **Companions** category; opening it lists the models of every signed-in account, one row per account and model, each naming the model and, in its description, its harness and account, narrowed by what follows (`@gpt`, `@work` search the model, harness and account). Text after `@` shows the matching models at once under a Companions heading. Chronicler's message box, an errand's opening message and a Ritual's conversation offer nothing after `@`, and a word written there stays plain text.
- A chosen model is a chip (a head and shoulders) in the message, written `@companion:<harness>:<account or ->:<model>` with the model's identifier percent-encoded. When the message is sent, **that model answers it, in the same conversation** (owner, 2026-11-27; not as an errand: an errand does not open an errand). The reply is a message from the mentioned Companion under the owner's message, labelled `Model · Account`, and anchored to it as any reply is.
- **The answer sits in a frame with its message** (owner, 2026-11-27, CHG-0785): the owner's message and the answer of each Companion it names are drawn together in one softly rounded, bordered frame, the owner's message first (right-aligned as ever) and each answer under it, whatever other messages, steps or replies came since; several mentions in one message give several answers in the frame, oldest first. An answer inside a frame has no "Replying to" line, which the frame says; it keeps its `Model · Account` label, Copy, comments, usage and the reply lines hung from it. When the message it answers is not drawn (the message a thread hangs from is pinned above, apart from the replies), the answer stands alone just after that message's time, with its "Replying to" line showing the owner's words without the Companion's `@` token. The host marks which messages are Companion answers (`isCompanionAnswer`); an agent reply that only anchors to a message, such as an errand an agent opened, is not one and is drawn as before. Search and Chronicle links find a message inside a frame.
- **Follow-ups inside the frame, opt-in context, and jump list** (owner, 2026-11-27, CHG-0786): each frame offers an inline **Follow up** box at its foot that addresses the Companion(s) already in the frame by default without re-typing `@`, while still letting the owner `@`-mention another Companion to bring it into the same frame; follow-ups and their answers append chronologically inside the frame (`companionFrameId`). Framed exchanges stay out of the main Companion's context by default (reversing automatic context injection); clicking **Add to context** shares the frame's answered exchanges as passive context for the main Companion's next turn without waking it (`ShareCompanionFrame`), showing **In context**, and offering **Update context** when later follow-ups add unshared answers (`companionFrameContext`: `"None" | "Shared" | "Outdated"`). When a conversation has at least one framed side conversation, a compact **N side chat(s)** jump menu appears beside **Find** in the conversation bar to list frames and scroll directly to any of them.
- **Only that message.** The owner's message is shown as sent, delivered to no one, and waits in no tray. The main Companion neither changes nor answers it: it keeps operating the other messages, with its own harness, model, and effort, and its turn, state and session are not touched. **The main Companion sees a frame only when the owner clicks Add to context** (owner, 2026-11-27, CHG-0786): the next turn it runs for another reason carries one line per newly shared answered question, headed by the sentence that says each Companion answered itself and that it is not asked; the line never starts a turn and is told once.
- A message that mentions several models is answered by each, up to **five** (a sixth and a repeat stay plain text), each answering as it finishes.
- **Settled by the owner, 2026-11-27:** the mentioned model works in the thread's folder (its own copy too, when it has one) with the thread's permission mode, taken as they are at each question; its asks go through the same approval flow and show in the conversation it was asked in, where the owner answers them. **One hidden session per model per conversation** is kept and resumed, so a second `@gpt` remembers the first, and a resumed session lets the provider's prompt cache serve the earlier conversation while it is warm (its lifetime is the provider's, minutes to an hour), where a fresh session each time would send the whole history again. Each question carries what the conversation said since that Companion last looked, newest kept up to about 12,000 characters.
- **A model that cannot answer says so, clearly** (owner, 2026-11-27): when the account is gone or signed out, a budget is reached, the plan reports a limit used up, or the turn fails, the reply is that Companion's own answer in the conversation, in plain words with the cause and, when the plan says, when it resets, for example "Cannot answer: its usage limit is reached (resets at 14:00)" under the label "Claude Opus 5.5 · Work". The message is not given to the main Companion to answer; it is context for it only, as any Companion mention is. The owner sends it again, or chooses another model.
  A used-up limit of the plan refuses only the models it covers (owner, 2026-11-27): Antigravity names a group ("Gemini · Weekly", "Others · Weekly"), so a used-up "Others" window does not refuse a Gemini model, and the other harnesses' windows cover every model of the account.
  When several windows that cover the model are used up, the reply gives the latest reset, because only then can it answer.
- **The answer is the Companion's last message of its turn.** A turn that wrote nothing, or was interrupted, says so instead. A Companion that was asked and had not answered when Outlore restarted answers "Outlore restarted before it answered".
- **A Companion has no Outlore tools** beyond the two that ask the owner (`request_approval`, `answer_prompt`): it opens no thread, messages no other thread, changes no setting, names no quest.
- **Cost:** a Companion's spend counts to its account and appears in the usage page under the quest it answered in, but not to that quest's own budget; a budget of its account or the global one that is reached refuses it with the line above, and a budget it reaches during a turn stops it as for any thread.
- **Deleting** the conversation deletes its Companions' hidden quests with it; they never show in the tree, the lists, the counts or the Chronicle.
- Still recommended, not yet settled: the owner replies to a Companion's answer by mentioning again, not by replying to it; a Companion's approval question does not mark the quest as needing the owner in the sidebar or the Chronicle (it shows in the conversation and the open-questions list).

### Comments on messages

Agreed 2026-11-11 (CHG-0195); built in CHG-0196.

- In a quest's or errand's conversation (not Outlore's), the owner can comment on any message, theirs, the Companion's, or another quest's. A small Comment button shows on the message's card while the pointer is on it or it has focus; selecting text inside one message shows a Comment on selection button beside it. Either opens a field under the card: Enter saves, Shift+Enter breaks the line, Escape cancels.
- A comment waits. Each thread keeps its own in the browser's storage until they are sent or removed, so a reload or leaving the thread loses none. They show in a tray above the message box ("2 comments · sent with your next message"), each with the passage it is about, and can be edited or removed there; a message with comments waiting says so under its card. A thread with comments can be sent with no typed text.
- Sending carries every waiting comment in the same message: after what the owner typed, a `<comments>` block with one `<comment on=… part=…>` per comment holding its quote (the selected passage, or the first 300 characters of the whole message) and the owner's note. The harness reads it as part of the message; the conversation draws it back as quoted passages under the typed text. Comments leave the tray only once the service has taken the message.
- A comment is a note in the next message: it is context, not a command, and it opens no reach beyond what the message's words and mentions already do.
- On the phone and other builds without a pointer or text selection, messages draw as they are and no comment can be written; a message that carries comments is still drawn with them.

### Delivery

- **Thread messages**, results included, are delivered into the receiving thread's current turn where its harness allows it; otherwise at its next turn. They are delivered whatever the receiving thread is doing.
- Chronicler uses the same delivery controls as quest threads: while it works, Send queues and a queued message offers Steer or Interrupt (CHG-0316, CHG-0519). Comments remain quest-only.
- **The user's messages** either steer the current turn or are queued for the next turn. Sending while a thread runs queues the message; there is no setting for it, and Steer or Interrupt is chosen after sending (CHG-0519, CHG-0523).
- **Pending owner messages** sit in a collapsible stacked tray above the composer, numbered in delivery order, instead of appearing as faded bubbles in the conversation feed (CHG-0691).
  The header shows the pending count and a **Clear all** action that removes every queued (non-steered) message.
  Once a turn takes a message in, it leaves the tray and joins the conversation history.
- **Edit** changes a queued message's text in place and keeps its attachments.
  **Remove** withdraws the message and its attachments.
  Both actions are available only while Outlore holds the message in its queue and are disabled while the message is steered.
  **Steer** toggles whether the message may join the running turn (`SteerQueuedMessage` to steer, `UnsteerQueuedMessage` to return it to the queue before the turn takes it in), and **Interrupt** ends the running turn so the next one starts with the pending messages.
  A turn can take a queued or steered message while an editor is open or before an unsteer arrives; the service checks delivery state again and refuses if already taken in.
- **Messages held while no turn runs** still appear in the tray and offer Edit, Remove, and Clear all.
  The Steer toggle and Interrupt apply only during a running turn.
- **A background command's end** can wake a Claude Code thread that stopped its turn to wait for it. Outlore runs the work Claude Code then does as a turn of the thread: its replies and steps are recorded, a line says which command ended, and the thread reads Running while it works (CHG-0595). A Stopped thread, or one held for a budget or a missing folder, does not run it. A thread with a background command pending keeps its harness process for an hour instead of the idle timeout.
- A thread that is Waiting, Resting, or Fulfilled is woken by any message addressed to it, so two threads waiting on each other never stay stuck.
- A Stopped thread keeps its messages and is not woken (see [thread-tree](../thread-tree/specifications.md#stopping)).

### Position in a conversation

When the owner opens a quest, an errand, or Chronicler's conversation, the latest messages are visible immediately at the bottom (CHG-0442). New replies and questions appear there. The view follows them while the owner is at the bottom, keeps the message being read in place when the owner scrolls up, and returns to the latest message when the owner sends.

### Interruptions

- The user can interrupt any thread.
- A thread can interrupt the threads directly beneath it.
- An interrupted thread ends its current turn and becomes Resting, or Waiting while threads beneath it are Underway or Waiting (CHG-0039). Messages that had not yet reached the turn stay undelivered and start its next turn.
- A continuing Codex session receives the stored messages and attached images from interrupted turns since its last completed turn. Outlore supplies these as earlier context for the next message, because Codex can abort before it records the earlier input.

### Chatter guard

- When two threads exchange 20 messages with no message from the user and no result, both pause in the Attention state, and the user decides how they continue.
- The number is adjustable in settings.

## External contract

Threads use these thread tools (see [0005](../../architecture-decision-record/0005-thread-tools-over-mcp.md)):

| Tool | Purpose | Arguments | Answer |
| --- | --- | --- | --- |
| `send_thread_message` | Send a message | Receiving thread (a parent, a thread directly beneath, Chronicler, the top thread of a quest or an errand the owner mentioned in this turn, or a thread that wrote to the caller in this turn), text | Sent, or a refusal and its reason when the target is outside its reach |
| `report_result` | Report the thread's result to its parent | The result | — |
| `interrupt_thread` | Interrupt a thread directly beneath the caller | The thread | Done, or a refusal and its reason when the thread is not directly beneath the caller or is not running |

## Acceptance and validation

- **Automated, with a fake harness**:
  - messages to the parent and to threads beneath, and the refusal for siblings and threads farther away unless the owner mentioned them with `#` in the current turn;
  - a mentioned quest in another mission receiving a message and replying directly; the access ending with the turn; no access for an archived quest (built, `packages/service/test/work/mentions.test.ts`);
  - delivery into a running turn and at the next turn, for harnesses with and without mid-turn input;
  - steering and queuing user messages;
  - waking Waiting, Resting, and Fulfilled threads, and two threads waiting on each other;
  - keeping messages for a Stopped thread;
  - interruptions by the user and by a parent;
  - the chatter guard pausing both threads at the limit.
- **Human acceptance**: during the [thread-tree](../thread-tree/specifications.md#acceptance-and-validation) check, the user steers one running thread, queues a message to another, and sees a subagent ask its parent a question and get an answer.
- **Conversation position**. The entry-order test checks that the inverted feed receives the newest entry first. In the desktop window and on an Android phone, open a long conversation, see the latest messages immediately, and watch a reply arrive while at the bottom. Scroll up during a streaming reply and verify that the message being read stays in place. Send a message and confirm the view returns to the bottom. Repeat for Chronicler's conversation. Device and window checks are pending.

## Requirements

- [Approval per action](../../requirements.md): a message never carries an approval.

## Dependencies

- [thread-tree](../thread-tree/specifications.md): defines threads, their states, and who is beneath whom.
- [action-approval](../action-approval/specifications.md): the Attention state for approvals.

## Exclusions

- Messages between threads in different missions without the owner's mention or Outlore.
- A thread's own `#` reference in a message to another thread: it opens nothing (CHG-0181).
- Attachments other than text between threads. The owner's images are in [message-attachments](../message-attachments/specifications.md).
- Editing or deleting a sent message.
