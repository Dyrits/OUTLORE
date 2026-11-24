# Thread messaging

Technical design: [proposed blueprint](blueprint.md), including the first slice's staged acceptance.

## Problem and outcome

Subagents in today's harnesses report once at the end and cannot be asked or redirected along the way. Threads in a mission talk in both directions while they work, and the user can write to any of them, so work can be asked about, corrected, and coordinated as it happens.

## Agreed behavior

### Who can message whom

- A thread can message its parent and the threads directly beneath it. Siblings reach each other through their parent.
- When the owner mentions a quest or errand with `@` in a message, the thread that receives it may, for the turn that message reaches, read that quest's journal (`read_journal` with `mission`) and message the quest's top thread, or the errand itself (CHG-0181). The receiving thread decides from the owner's words whether to do either. The quest that receives such a message may answer its sender in the turn the message reaches, so the reply comes straight back (see [mission-coordination](../mission-coordination/specifications.md#references-between-quests)).
- Without a mention, a thread reaches another quest only through Chronicler (formerly Guildmaster). A thread cannot widen its own reach by writing an `@` reference: only the owner's messages count.
- A Ritual's run instruction is a service-made message, not a live owner message; its mentions grant no reach.
- The user can write to any open thread, including a subagent's (for mirrored subagents, see [thread-tree](../thread-tree/specifications.md#subagents)).
- Every message shows its sender: the user, or the sending thread.

### Mentions with @

Agreed 2026-11-11 (CHG-0181); built in CHG-0182.

- In any message box (a quest's, an errand's, Outlore's), a bare `@` lists three categories with their icons: Quests, Realms, and Files & Directories, the last only when the message box has a linked folder. Arrow keys and Enter open a category; Backspace right after the `@` returns to the categories. As soon as text follows the `@`, the list mixes the matches of every category, each under its heading. The `/` skills list is unchanged.
- Quests lists every quest not archived and, beneath each, its errands shown as `Quest › Errand`; Chronicler's own conversation is never offered. Realms lists every realm, tied to a folder or not. Archived quests and their errands are left out entirely.
- A chosen quest, errand, or realm becomes a chip with its icon (a pennant for a quest or errand, a keep for a realm) and its name, in the message box and in the sent message. The message holds a one-word token with the id: `@quest:<quest id>`, `@side-quest:<thread id>`, or `@realm:<realm id>`. File and folder paths keep their `@path` form. A token naming a quest since archived or deleted shows as "quest no longer open".
- A mention is context only. The owner's text reaches the thread unchanged, followed by a block the service adds as it delivers the message, one line per mention with its ids, for example `Quest "Fix login" (id …, state Running, realm Outlore, top thread id …)` and `Realm "Outlore" (id …, folder …)`. The receiving thread decides from the owner's words whether to read the quest's journal, write to it, or neither.
- The widened reach (above) holds only for quests and errands the owner named, only in the turn the message reaches, and never for an archived quest. A realm mention opens nothing: it only says which realm is meant.
- On the phone and other builds that cannot draw chips inside the text, the chosen token is written into the text as typed; the categories still show.

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
  - messages to the parent and to threads beneath, and the refusal for siblings and threads farther away unless the owner mentioned them with `@` in the current turn;
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
- A thread's own `@` reference in a message to another thread: it opens nothing (CHG-0181).
- Attachments other than text between threads. The owner's images are in [message-attachments](../message-attachments/specifications.md).
- Editing or deleting a sent message.
