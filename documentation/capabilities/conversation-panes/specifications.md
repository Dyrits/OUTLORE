# Conversation panes

## Problem and outcome

Outlore's window shows one conversation at a time, with a sidebar of every realm and quest, a right-hand column of details, and Chronicler in a separate dock. The owner does not see how a quest or an errand came out of a message, and moving between them replaces the screen.

The owner asked for a Slack-like window (2026-11-19): a conversation that everything unfolds from, where a quest or an errand appears in the conversation it came from and opens beside it as a nested conversation, with the sidebar kept but out of the way until needed, and realms as channels.

Status: **desktop design agreed on 2026-11-20**, including agent-authored anchors, three conversation panes, Chronicle as a separate destination, and the quest’s Errands tab (CHG-0565 to CHG-0567). See the [blueprint](blueprint.md) and [verification](../../verification/2026-11-19-conversation-panes.md). The release goal is Pre-Alpha.

## Agreed behavior

### The window

- The window holds, side by side: the sidebar (below), up to three **panes**, and the **details panel**. A pane is one conversation column; the first pane is the realm or Borderlands chat. The owner agreed to this desktop layout on 2026-11-20.
- The details panel keeps its place, a dedicated column on the right with the Quest and Companions tabs, and its rules, for now (the owner: "they should still be in a dedicated sidebar for now"; [thread-panel](../thread-panel/specifications.md)). It does not count among the three panes.
- Pane management is expected to change as the owner uses it ("we'll iterate on that").

### The Workshop

The Workshop (Settings) is not a pane and not a sheet: it is the page that takes over the whole content area, every pane included (the owner, 2026-11-19: "the workshop should take over the full panel but the icon should be on the top right, where chronicler is actually", CHG-0563).

- Its icon, the gear, stands at the far right of the top bar, where the Chronicler button was. It shows as selected while the Workshop is open.
- Pressed, it opens the Workshop over the whole content area, sidebar kept. Pressed again, the Workshop closes and the owner is where they were, with the pane chain exactly as left: the folds, the shares, the pane in focus, the details panel, the drafts, and a pinned sidebar. The panes wait mounted beneath the Workshop, out of sight.
- The sidebar's foot has no Workshop row on a desktop window; the phone's full-screen menu, which has no top bar, keeps it.
- The Workshop screen itself is unchanged. No keyboard shortcut for it yet.

### Main conversations and channels

- **The Chronicle** opens from one desktop sidebar item with an unread badge. Its default feed groups unread replies and results, open Summons, failures, and reminders by conversation across realms and the Borderlands. It offers **Unread** and **Needs attention** filters. Opening an entry takes the owner to the relevant message or request in its existing pane. Reading an approval request clears its unread indicator, and the request stays in **Needs attention** until answered or withdrawn.
- The Chronicle's **History** tab shows routine events such as quest openings and moves. General requests go to Chronicler in the realm or Borderlands chat. The existing phone access remains while phone navigation is deferred.
- **A realm is a channel**: it has its own main conversation, opened from the sidebar, in which the realm's quests unfold. The Borderlands is one more channel, for the quests in no realm. In a channel the owner talks to Chronicler, scoped to that channel: it has the memory of the realm (its lore); in the Borderlands it has the global memories only. As elsewhere in Outlore, the owner chooses its Companion, so the model is settable for each channel.
- `#` to name a channel is not built. `@` keeps naming a quest, an errand, a realm or a file as context; telling a citation from a channel reference waits for multiplayer (the owner).

### The three levels

The pane chain is **channel → quest → errand**. The desktop sidebar opens the channel or a quest. A quest defaults to its **Missives** tab (its messages, where anchored Reply lines open errands; formerly Messages, CHG-0571). Its Errands tab lists the quest’s errands with their state and attention indicators and opens the same third pane. A realm's channel has a Missives tab (its conversation) and a **Quests** tab that lists the realm's quests in the same pane, not a pane of its own (the owner, 2026-11-20); the Borderlands has both tabs over the quests in no realm. The sidebar shows attention at quest level. The existing phone sidebar keeps its errand rows. Narrow desktop windows can fold earlier panes to strips.

The quest title in the conversation header switches to another non-archived quest across realms and the Borderlands.
The errand title switches to another errand in the same quest, including existing sub-errands.
The New errand title also opens this picker when the quest has two or more errands.
The switchers also appear in the narrow header when another conversation of the same kind is available.

### Reply and Comment

- A message offers two actions. **Comment** is the existing one: a note held for the owner's next message ([thread-messaging](../thread-messaging/specifications.md#comments-on-messages)). **Reply** is new: it starts a thread of work from the message, whose conversation opens in the next pane.
- A Reply on a message of a channel starts a **quest**, which stays in that channel. The reply's composer offers the Companion, which the owner may change for that reply; the quest is placed in the channel's realm.
- A Reply on a message of a quest's conversation starts an **errand** beneath the quest, with the replied message as context. An errand's pane offers no Reply: the owner starts errands only from a quest, and steers an errand by writing in it (CHG-0558).
- A message has at most one reply (one reply is one quest or errand). Replying again to a message that already has one opens that conversation.

### Quests in a main conversation

- A quest with an originating channel message appears as a **reply line** under that message:
  - A quest Chronicler proposes hangs under Chronicler's proposal message, itself a reply to the owner's message that led to it; the quest's reply line sits under that reply (the owner, 2026-11-20). The confirmation is a simple menu: the realm, and the Companion preset. Nothing starts until the owner confirms, as [today](../mission-coordination/specifications.md#chronicler-the-assistant-chg-0173).
  - When the owner supplies an opening request as part of creating the quest, the request appears in the channel with the reply line under it.
  - A quest started by a Reply hangs under the message replied to.
  - When the owner creates an empty quest, messages they later send from its composer appear only in the quest.
  - The opening of an empty quest still appears in Chronicle History.
  - Moving a quest to another realm moves the message it came from with it, into that realm's channel, under the existing [move confirmation](../mission-tracking/specifications.md#quest-placement-and-moves).
  - A quest's results, Summons, and failures arrive as replies in that thread, in place of the buttons beside Chronicler's replies.
- The reply line shows the quest's title, its state, and its latest activity. Pressing it opens the quest's conversation in the next pane.
- A reply line, and each quest in the Quests tab, is a **block** that quotes a sample of the last exchange, as a Slack thread quotes its last reply: the owner's latest message ("You") and the companion's latest reply ("Companion"), each cut to 160 characters. Errands' reply lines quote their own last exchange the same way (CHG-0571).

### Errands as replies

- An errand is a fork of its parent's conversation. It has an **anchor** message in that conversation, which carries its reply line (title, state, what is new); pressing the reply line opens the errand's conversation in the next pane, as a thread opens in Slack. The errand's result lands in that thread.
- **Opened by the owner:** by a Reply, the anchor is the message replied to; the reply's text starts the errand.
- **Started in the Errand pane:** when a desktop quest opens without a selected errand, its third pane holds a composer for a new errand. Sending there starts the errand from the quest's current context using the usual starting-context limits, and opens the new conversation in that pane. The selected errand's New errand button brings the composer back.
- The Open errand button in the quest's message box is available in the single-conversation layout, which has no Errand pane.
- **Opened by an agent:** the agent replies, in its own words, to the message that led to the errand, and that reply is the anchor — there is no system card (the owner, 2026-11-20). Outlore writes the reply from the open_thread call itself, so it costs no extra agent turn and looks the same on every harness, but it is attributed to the agent and carries the brief. It is placed as a reply to the message the call names, or to the conversation's latest message when it names none, and the errand's reply line hangs from it. Three errands opened in one turn give three replies, in order, each carrying one; the agent may write ordinary text around them. The anchor only positions the reply line: the tree parent stays the conversation, so anchoring never creates a sub-errand. Pressing the reply line, or replying to the reply, opens the errand's pane, where the brief is the first message (until the pane-identity work restyles it).
- Opening a reply line from a pane replaces every pane to the right of it.
- **Follow-up work from an errand:** the agent can post an attributed message about the work in the quest conversation. The owner can Reply to start a quest-level errand from that message. Posting the message starts no errand.
- New errands open directly beneath the quest. Existing phone access to older errands continues.
- **Existing sub-errands** retain their original parents and histories. Opening one reuses the errand pane and offers a return to its parent.

### Panes

- At most three panes are shown at once. A window too narrow for three shows fewer; each pane has a minimum width.
- When the window is too narrow for the whole chain, the last panes are shown and the earlier ones are folded to strips, so the deepest conversation left open keeps its space and each strip is one press away. On a narrow window the channel folds first.
- By default the panes share the width equally: one third each with three.
- A pane can be **folded** to a slim strip and **unfolded**, which is how a pane gives room to its neighbour: the neighbour extends over the space and the folded pane stays one press away (the owner: better than closing is extending a panel over another, "just folding it").
- Folded panes that sit next to each other are **one strip** of the same width, split in equal parts stacked from top to bottom, each part with its state and title along it and one press from open again (the owner: collapsed elements are "merged into one split in two parts"). Strips that an open pane separates stay two strips.
- The desktop headers offer a **Fold** button with a pane-and-arrow icon, separated from the Quest panel icon by a divider. The quest and errand can fold even when they are the deepest conversation. Folding the last open conversation brings another pane into view.
- On a phone (a narrow window) one pane shows at a time with a Back chevron, as the [phone view](../mission-tracking/specifications.md#simplified-left-navigation) does today.
- Panes are resized by dragging their edges; the widths are remembered.
- **Equal widths** sits above the conversation row and gives the open panes the same share again (a third each with three) and forgets the dragged shares; folded panes stay folded.
- The **Expand pane** button in each header gives its conversation the available width and folds the other conversation panes to strips. **Restore pane layout** returns to the previous folds and widths. Opening a strip exits the expanded layout and reveals that pane.
- When only one pane is visible, its header shows **Restore pane layout** automatically.
  If the owner folded the panes without using Expand, Restore clears those folds and keeps the pane widths, subject to the space available.

### The sidebar

- The sidebar uses the conversation pane background and aligns the Chronicle entry with the pane headers.
- Fold controls sit before their row labels, and quest highlights are inset within the list.
- An empty realm starts collapsed and shows **No quests yet** when expanded.
- The desktop sidebar shows Chronicle, the realms and Borderlands, their quests, and the existing creation and footer controls. A realm’s chevron expands or collapses its quest rows in place. The realm name opens its chat and a quest row opens its conversation directly.
- By default it is an **overlay**: it floats over the panes without moving them, appears when the pointer reaches the edge of the window it is set to, and hides when the pointer leaves, when the owner chooses something in it, or on Escape. A short delay before opening keeps a stray pointer from opening it, a button and a keyboard shortcut open it for touch and keyboard users, and it stays open while a quest is dragged (the owner: "like the sidebar in some browsers like Arc … exactly").
- It can be set to the **left** or the **right** edge.
- The top bar's sidebar button **pins** the sidebar and unpins it (the owner: "should pin or unpin it, not just make it appear until we unfocus it"; ⌘B does the same). Pinned, the sidebar takes its place in the frame and pushes the panes, on the edge it is set to, and does not close on a pointer leave, a press outside or Escape; unpinned, it is the overlay again. The pin is remembered (CHG-0562).
- A **docked** mode keeps today's behavior: the sidebar stays in the window and pushes the panes, like a sidebar pinned all the time.

## Edge cases

- An archived errand keeps its card, and opens read-only as [today](../thread-tree/specifications.md#archiving-an-errand).
- The details panel shows the pane in focus; moving focus follows the [panel ownership rule](../thread-panel/specifications.md#panel-ownership-across-navigation).

## Acceptance and validation

- Verify separate channel histories and Companions, realm lore for the matching channel, and global lore in the Borderlands.
- Open an errand from its channel and quest, then open a legacy sub-errand and return to its parent within the same pane.
- Check persisted Reply anchors, including proposal messages, duplicate Replies and the errand brief. An errand agent's follow-up appears in the quest, and only the owner's Reply starts it.
- Open the Chronicle from the sidebar and verify that the attention feed is the default and routine events appear under History. Open an unread approval request from the feed, check that its unread indicator clears and it remains in Needs attention, then answer it and check that it leaves the filter. Check that reminders are deduplicated. Move a quest and check that the other channel receives its originating message.
- Check sidebar pinning and Workshop return in a desktop window. Preserve phone access until the phone batch.

## Requirements

No new obligation beyond the [system-wide requirements](../../requirements.md); every conversation keeps its existing behavior inside a pane.

## Dependencies

[mission-coordination](../mission-coordination/specifications.md) (Chronicler's conversation and proposal), [mission-tracking](../mission-tracking/specifications.md) (the sidebar's content, realms), [thread-tree](../thread-tree/specifications.md) (errands, depth), [thread-messaging](../thread-messaging/specifications.md) (results as messages), [thread-panel](../thread-panel/specifications.md) (the details panel), [scoped-intel](../scoped-intel/specifications.md) (the lore a channel's Chronicler has).

## Supersedes, once built

The desktop Chronicle pane and the earlier Chronicler dock, the fixed sidebar, and the desktop sidebar’s nested errand rows. The existing phone menu still exposes its errand rows. Those sections get a pointer here when the work is built, not before.

## Exclusions

The `#` tag, multiplayer, and anything else in the [draft](draft.md).
