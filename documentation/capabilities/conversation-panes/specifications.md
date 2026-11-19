# Conversation panes

## Problem and outcome

Outlore's window shows one conversation at a time, with a sidebar of every realm and quest, a right-hand column of details, and Chronicler in a separate dock. The owner does not see how a quest or an errand came out of a message, and moving between them replaces the screen.

The owner asked for a Slack-like window (2026-11-19): a conversation that everything unfolds from, where a quest or an errand appears in the conversation it came from and opens beside it as a nested conversation, with the sidebar kept but out of the way until needed, and realms as channels.

Status: **agreed in the owner's answers and comments of 2026-11-19** (CHG-0553, CHG-0555 to CHG-0559 and CHG-0563); **built in part**: the overlay sidebar and the pane chain of a quest and its errands (CHG-0560, CHG-0561; the owner has looked at it, and asked for fixes and additions, CHG-0562), the Chronicle as the first pane and the Workshop over the panes (CHG-0563, CHG-0564), nothing else. The owner's goal for this change is the Pre-Alpha release ([backlog](../../backlog.md#conversation-panes-slack-like-layout-toward-pre-alpha)). What the owner has not settled is in the [draft](draft.md), not here. The technical design is the [blueprint](blueprint.md).

## Agreed behavior

### The window

- The window holds, side by side: the sidebar (below), up to four **panes**, and the **details panel**. A pane is one conversation column; the first pane is the Chronicle.
- The details panel keeps its place, a dedicated column on the right with the Quest and Companions tabs, and its rules, for now (the owner: "they should still be in a dedicated sidebar for now"; [thread-panel](../thread-panel/specifications.md)). It does not count among the four panes.
- Pane management is expected to change as the owner uses it ("we'll iterate on that").

### The Workshop

The Workshop (Settings) is not a pane and not a sheet: it is the page that takes over the whole content area, every pane included (the owner, 2026-11-19: "the workshop should take over the full panel but the icon should be on the top right, where chronicler is actually", CHG-0563).

- Its icon, the gear, stands at the far right of the top bar, where the Chronicler button was. It shows as selected while the Workshop is open.
- Pressed, it opens the Workshop over the whole content area, sidebar kept. Pressed again, the Workshop closes and the owner is where they were, with the pane chain exactly as left: the folds, the shares, the pane in focus, the details panel, the drafts, and a pinned sidebar. The panes wait mounted beneath the Workshop, out of sight.
- The sidebar's foot has no Workshop row on a desktop window; the phone's full-screen menu, which has no top bar, keeps it.
- The Workshop screen itself is unchanged. No keyboard shortcut for it yet.

### Main conversations and channels

- **The Chronicle** is Chronicler's permanent conversation, moved from its dock to the first pane. It is the overview of everything happening: it describes, as messages, what happens in Outlore (a realm opened, a quest opened, and so on; which events is [open](draft.md#what-the-chronicle-records)), and it reminds the owner of what waits ("An errand from yesterday is still waiting for an answer."). The owner talks to Chronicler in it, and it orchestrates across the realms.
- **A realm is a channel**: it has its own main conversation, opened from the sidebar, in which the realm's quests unfold. The Borderlands is one more channel, for the quests in no realm. In a channel the owner talks to Chronicler, scoped to that channel: it has the memory of the realm (its lore); in the Borderlands it has the global memories only. As elsewhere in Outlore, the owner chooses its Companion, so the model is settable for each channel.
- There is no second kind of assistant: the Chronicle and every channel are Chronicler.
- `#` to name a channel is not built. `@` keeps naming a quest, an errand, a realm or a file as context; telling a citation from a channel reference waits for multiplayer (the owner).

### The four levels

The panes follow the tree the owner works in, four levels (CHG-0558): the **Chronicle**, a **channel** (a realm's, or the Borderlands'), a **quest**, an **errand**. Four panes are the four levels, so a quest's chain always fits. A channel opens from the sidebar and from the Chronicle, where the message that says a realm opened carries a reply line to its channel.

### Reply and Comment

- A message offers two actions. **Comment** is the existing one: a note held for the owner's next message ([thread-messaging](../thread-messaging/specifications.md#comments-on-messages)). **Reply** is new: it starts a thread of work from the message, whose conversation opens in the next pane.
- A Reply on a message of a main conversation (the Chronicle or a channel) starts a **quest**, which stays in that channel. The reply's composer offers the Companion, which the owner may change for that reply; the quest is placed in the channel's realm (in the Chronicle, the confirmation's realm menu applies).
- A Reply on a message of a quest's conversation starts an **errand** beneath the quest, with the replied message as context. An errand's pane offers no Reply: the owner starts errands only from a quest, and steers an errand by writing in it (CHG-0558).
- A message has at most one reply (one reply is one quest or errand). Replying again to a message that already has one opens that conversation.

### Quests in a main conversation

- Every quest unfolds from a main conversation as a **reply line** under one message:
  - A quest Chronicler proposes hangs under Chronicler's message that carries the confirmation. The confirmation is a simple menu: the realm, and the Companion preset. Nothing starts until the owner confirms, as [today](../mission-coordination/specifications.md#chronicler-the-assistant-chg-0173).
  - A quest the owner starts directly appears with the owner's opening request as a message of the conversation, and the reply line under it. A quest started by a Reply hangs under the message replied to.
  - Moving a quest to another realm moves the message it came from with it, into that realm's channel, under the existing [move confirmation](../mission-tracking/specifications.md#quest-placement-and-moves).
  - A quest's results, Summons, and failures arrive as replies in that thread, in place of the buttons beside Chronicler's replies.
- The reply line shows the quest's title, its state, and its latest activity. Pressing it opens the quest's conversation in the next pane.

### Errands as replies

- An errand is a fork of its parent's conversation. It has an **anchor** message in that conversation, which carries its reply line (title, state, what is new); pressing the reply line opens the errand's conversation in the next pane, as a thread opens in Slack. The errand's result lands in that thread.
- **Opened by the owner:** by a Reply, the anchor is the message replied to; the reply's text starts the errand.
- **Opened by an agent:** Outlore posts one message of its own in the parent's conversation for each errand, at the point in the turn where the agent opened it, and that message is the errand's anchor. It is a system card showing the errand's title and the brief the agent gave, like the message that today says an errand was opened. Three errands opened in one turn give three cards, in order, each tied to one errand; the agent may write ordinary text around them. Pressing its reply line, or replying to the card, opens the errand's pane, where the brief is the first message.
- Opening a reply line from a pane replaces every pane to the right of it.
- **Sub-errands** are opened by agents only (an errand's own agent opens one beneath itself; the owner cannot). Each appears in its parent errand's conversation as a card like any agent-opened errand, and nothing opens on its own: the owner opens its pane from the card to watch it or to write in it, as a fifth pane, so the earliest panes fold to strips (below). The owner kept sub-errands over agents opening sibling errands beneath the quest (CHG-0559); the sibling model can be revisited after real use.
- Choosing a quest or an errand in the sidebar opens its whole chain from its channel or the Chronicle, so the panes always show where the item sits in the tree.

### Panes

- At most four panes are shown at once. A window too narrow for four shows fewer; each pane has a minimum width.
- When the chain is longer than the panes (a sub-errand the owner opened, or a window narrower than four panes), the last panes are shown and the earlier ones are folded to strips, so the deepest conversation always has a pane and each strip is one press away. On a narrow window the Chronicle and the channel fold first.
- By default the panes share the width equally: one quarter each with four.
- A pane can be **folded** to a slim strip and **unfolded**, which is how a pane gives room to its neighbour: the neighbour extends over the space and the folded pane stays one press away (the owner: better than closing is extending a panel over another, "just folding it").
- A pane can also be **closed**. Its parent's reply line opens it again, so a closed pane is always easy to bring back.
- On a phone (a narrow window) one pane shows at a time with a Back chevron, as the [phone view](../mission-tracking/specifications.md#simplified-left-navigation) does today.
- Panes are resized by dragging their edges; the widths are remembered.
- A button on the deepest pane's header, **Equal widths**, gives the open panes the same share again (a quarter each with four, a third with three) and forgets the dragged shares; folded panes stay folded (the owner, CHG-0562).

### The sidebar

- The sidebar keeps its content (realms, quests and errands, the two creation buttons, the foot).
- By default it is an **overlay**: it floats over the panes without moving them, appears when the pointer reaches the edge of the window it is set to, and hides when the pointer leaves, when the owner chooses something in it, or on Escape. A short delay before opening keeps a stray pointer from opening it, a button and a keyboard shortcut open it for touch and keyboard users, and it stays open while a quest is dragged (the owner: "like the sidebar in some browsers like Arc … exactly").
- It can be set to the **left** or the **right** edge.
- The top bar's sidebar button **pins** the sidebar and unpins it (the owner: "should pin or unpin it, not just make it appear until we unfocus it"; ⌘B does the same). Pinned, the sidebar takes its place in the frame and pushes the panes, on the edge it is set to, and does not close on a pointer leave, a press outside or Escape; unpinned, it is the overlay again. The pin is remembered (CHG-0562).
- A **docked** mode keeps today's behavior: the sidebar stays in the window and pushes the panes, like a sidebar pinned all the time.

## Edge cases

- An archived errand keeps its card, and opens read-only as [today](../thread-tree/specifications.md#archiving-an-errand).
- The details panel shows the pane in focus; moving focus follows the [panel ownership rule](../thread-panel/specifications.md#panel-ownership-across-navigation).

## Acceptance and validation

Nothing is built, so nothing is validated. Proposed, for when it is built (in a worktree, directly: the owner prefers building to a throwaway prototype):

- Agent checks: a quest proposed by Chronicler and one started directly each appear as a reply line under the right message; an errand opened by a thread and one opened by a Reply each show a reply line on their anchor; two errands opened together give two anchors; a Reply on a message of a channel starts a quest in that channel and a Reply in a quest starts an errand; a second Reply on the same message opens the existing conversation; moving a quest to another realm moves its origin message; pressing a reply line opens its conversation in the next pane and replaces the panes after it; choosing an errand in the sidebar opens its channel (or the Chronicle), its quest and the errand; a chain of five shows the last four and one strip; with four panes, each is a quarter wide and a narrower window shows fewer; folding, unfolding and closing a pane and reopening it from the reply line; the sidebar's overlay, delay, Escape, left and right edges, drag, and docked mode; a phone width shows one pane; a realm's channel gives Chronicler that realm's lore and the Borderlands' only the global lore.
- Human acceptance: the owner uses the layout in a window.

## Requirements

No new obligation beyond the [system-wide requirements](../../requirements.md); every conversation keeps its existing behavior inside a pane.

## Dependencies

[mission-coordination](../mission-coordination/specifications.md) (Chronicler's conversation and proposal), [mission-tracking](../mission-tracking/specifications.md) (the sidebar's content, realms), [thread-tree](../thread-tree/specifications.md) (errands, depth), [thread-messaging](../thread-messaging/specifications.md) (results as messages), [thread-panel](../thread-panel/specifications.md) (the details panel), [scoped-intel](../scoped-intel/specifications.md) (the lore a channel's Chronicler has).

## Supersedes, once built

Chronicler's dock and its expand button, the sidebar's fixed place, and the buttons beside Chronicler's reports in [mission-coordination](../mission-coordination/specifications.md#place); the nested errand rows in the sidebar remain. Those sections get a pointer here when the work is built, not before.

## Exclusions

The `#` tag, multiplayer, and anything else in the [draft](draft.md).
