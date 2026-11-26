# Conversation panes

## Problem and outcome

Outlore's window shows one conversation at a time, with a sidebar of every realm and quest, a right-hand column of details, and Chronicler in a separate dock. The owner does not see how a quest or an errand came out of a message, and moving between them replaces the screen.

The owner asked for a Slack-like window (2026-11-19): a conversation that everything unfolds from, where a quest or an errand appears in the conversation it came from and opens beside it as a nested conversation, with the sidebar kept but out of the way until needed, and realms as channels.

Status: **desktop design agreed on 2026-11-20**, including agent-authored anchors, three conversation panes, Chronicle as a separate destination, and the quest’s Errands tab (CHG-0565 to CHG-0567). See the [blueprint](blueprint.md) and [verification](../../verification/2026-11-19-conversation-panes.md). The release goal is Pre-Alpha.

## Agreed behavior

### The window

- The desktop conversation window holds the navigation sidebar and up to three conversation panes.
- A channel has **Missives**, **Quests**, and **Companions**; a quest has **Missives**, **Quest**, **Errands**, and **Companions**; an errand has **Missives**, **Errand**, and **Companions**.
- The **Quest** tab holds the [thread details](../thread-panel/specifications.md), and **Companions** edits the pane’s own conversation or the draft errand in the new-errand pane.
- The model button in the conversation composer opens its own pane’s **Companions** tab.
- Tab switches preserve drafts, and each pane selects its own tab independently.
- A quest opened from the sidebar starts with only its conversation pane open: the realm's channel pane is folded behind its notch, and one press brings it back (the owner, 2026-11-21; CHG-0613). When the realm's channel is already open, as its own screen or as a pane beside the previous quest, opening a quest, an existing one or a new one, leaves it open instead of folding it (the owner, 2026-11-24; CHG-0678).
- Pane management is expected to change as the owner uses it ("we'll iterate on that").
- **Islands** is the desktop window's default layout, in every theme (the owner, 2026-11-23; CHG-0672): the sidebar, each open conversation pane (the realm's, the quest's or Ritual's, and the errand's), and the content of a screen without panes, such as the Workshop, each float as a rounded card with a hairline and a soft shadow on a canvas drawn from the theme's own colors, with the same gap between them. The Workshop's Look card offers **Layout** with Islands and **Flat**, the frame the app had before, and, while it is Islands, **Canvas**, **Gap**, **Radius**, and **Lift**, which apply at once. A folded pane's notch, the pane header's buttons, focus, dragging the edge between panes, and the sidebar's overlay and pinned modes work as in the flat layout; the notch between two open panes sits across the gap, and a notch on a pane's outer edge takes the island's own color with no border on its edge side, so it reads as cut into the pane. A phone, a narrow window, and the Android app keep the flat layout.

### Find in conversation

- **Find** opens a search field above the current conversation. It matches literal text in the conversation's messages, ignoring case and whitespace at the ends of the query.
- A query selects the newest matching message, even if it is offscreen. The feed keeps the surrounding messages in place and marks the selected match. Previous and next wrap through the matching messages, and the search shows the current position or **No matches**.
- Closing Find clears the query and marker and leaves the feed at its current position.

### The Workshop

The Workshop (Settings) is not a pane and not a sheet: it is the page that takes over the whole content area, every pane included (the owner, 2026-11-19: "the workshop should take over the full panel but the icon should be on the top right, where chronicler is actually", CHG-0563).

- Its icon, the gear, stands at the far right of the top bar, where the Chronicler button was. It shows as selected while the Workshop is open.
- Pressed, it opens the Workshop over the whole content area, sidebar kept. Pressed again, the Workshop closes and the owner is where they were, with the pane chain exactly as left: the folds, the shares, the pane in focus, the selected tabs, the drafts, and a pinned sidebar. The panes wait mounted beneath the Workshop, out of sight.
- The sidebar's foot has no Workshop row on a desktop window; the phone's Menu lists Settings, which is the Workshop (CHG-0761).
- The Workshop screen itself is unchanged. No keyboard shortcut for it yet.

### Main conversations and channels

- **The Chronicle** opens from one desktop sidebar item with an unread badge. Its default feed groups unread replies and results, open Attention requests, failures, and reminders by conversation across realms and the Borderlands. It offers **Unread** and **Needs attention** filters. Opening an entry takes the owner to the message or request it names in its existing pane. A quest-level entry opens the conversation at its latest message. Reading an approval clears the unread indicator, and the request stays in **Needs attention** until the owner answers it or it is withdrawn. Allowing or denying the request clears it from **Needs attention**.
- The Chronicle's **History** tab shows routine events such as quest openings and moves. General requests go to Chronicler in the realm or Borderlands chat. The existing phone access remains while phone navigation is deferred.
- Chronicle puts **Quest**, **Errand**, or **Realm** before the source title in Attention and History.
- **A realm is a channel**: it has its own main conversation, opened from the sidebar, in which the realm's quests unfold. The Borderlands is one more channel, for the quests in no realm. In a channel the owner talks to Chronicler, scoped to that channel: it has the memory of the realm (its lore); in the Borderlands it has the global memories only. As elsewhere in Outlore, the owner chooses its Companion, so the model is settable for each channel.
- `#` to name a channel is not built. `@` keeps naming a quest, an errand, a realm or a file as context; telling a citation from a channel reference waits for multiplayer (the owner).

### The three levels

The pane chain is **channel → quest → errand**. The desktop sidebar opens the channel or a quest. A quest defaults to its **Missives** tab (its messages, where anchored Reply lines open errands; formerly Messages, CHG-0571). Its Errands tab lists the quest’s errands with their state and attention indicators and opens the same third pane. A realm's channel has a Missives tab (its conversation), a **Quests** tab that lists the realm's quests in the same pane, not a pane of its own (the owner, 2026-11-20), and a **History** tab with every quest of the realm by recency, grouped Today, Yesterday, and by month, with each quest's errands, foldable; it replaces the realm's quest-list page (the owner, 2026-11-24, CHG-0686). The History tab follows Rituals on the desktop and phone tab rows alike; the Borderlands has the Missives, Quests, Rituals, and History tabs over the quests in no realm. The sidebar shows attention at quest level. The existing phone sidebar keeps its errand rows. Narrow desktop windows can fold earlier panes to notches.

The quest title in the conversation header switches to another non-archived quest in the current realm or, for a Borderlands quest, in the Borderlands.
The errand title switches to another errand in the same quest, including existing sub-errands.
The New errand title also opens this picker when the quest has two or more errands.
The switchers also appear in the narrow header when another conversation of the same kind is available.

### Reply and Comment

- A message offers two actions. **Comment** is the existing one: a note held for the owner's next message ([thread-messaging](../thread-messaging/specifications.md#comments-on-messages)). **Reply** starts or opens a thread of work from the message, whose conversation opens in the next pane.
- A Reply on a message of a channel starts a **quest** in that channel's realm, inheriting the channel's current Companion configuration directly (no inline Companion pickers).
- A Reply on a message of a quest's conversation opens an empty **errand** anchored to that message at once and opens its pane, inheriting the quest's Companion configuration (editable via its **Companions** tab); its own composer takes the first message, which wakes it. An errand's pane offers no Reply: the owner starts errands only from a quest, and steers an errand by writing in it (CHG-0558, CHG-0746).
- A message has at most one reply (one reply is one quest or errand). Replying again to a message that already has one opens that conversation directly.
- **Also send to parent**: in a quest (whose parent is its realm or Borderlands channel) and an errand (whose parent is its quest), the composer offers an unchecked-by-default **Also send to \<parent\>** checkbox with a **This message** vs. **Full context** toggle. Sending with it checked posts the message in the child conversation and echoes it into the parent feed (delivering it to the parent quest's Companion when sent from an errand, and posting conversation-only to the channel feed when sent from a quest), then resets the checkbox to unchecked.
- **One-message child reporting**: when an errand calls `report_result`, Outlore posts the result as the errand's own reply and echoes it directly to the parent quest in one step (optionally with `includeContext: true` to attach the errand's prior conversation context).
- **Parent-echoed notices and replies**: quest/errand notices (such as inactivity warnings) are recorded inside the quest and echoed to its parent channel, and parent-echoed notices and child replies omit the **Reply** action so clicking them opens the originating quest or errand instead of starting a duplicate.

### Quests in a main conversation

Quests with errands show their fold chevron even when collapsed and the pointer is elsewhere. Press it to collapse the errands or expand a quest in the desktop sidebar to preview up to two unfolded errand rows, including nested errands. Each errand opens its conversation. If more than two rows would appear, **Show N errands** opens the quest's **Errands** tab. The number counts the unfolded rows before applying the limit. On a narrow screen, the same action opens the quest with its errand list expanded.

- A quest with an originating channel message appears as a **reply line** under that message:
  - In a realm or Borderlands channel, casual chat receives an in-channel reply with no quest; when a message calls for a quest and no existing quest matches, the channel's Companion directly opens the quest anchored to the owner's message using the channel's current Companion configuration (no second proposal bubble, no confirmation card), and the quest pane opens beside the channel.
  - In the global Chronicler conversation, a quest Chronicler proposes still hangs under Chronicler's proposal message with its confirmation card, as [today](../mission-coordination/specifications.md#chronicler-the-assistant-chg-0173).
  - When the owner supplies an opening request as part of creating the quest, the request appears in the channel with the reply line under it.
  - A Reply on a message of the Chronicle opens an empty quest at once, hung under the message replied to, and opens its pane; its own composer takes the first message and no box opens at the bottom of the Chronicle.
  - When the owner creates an empty quest, the first message they send from its composer is also copied to the channel, where it becomes the quest's anchor and shows the reply line. The copy is conversation only: it wakes and tells no one, and only the quest answers. Later messages stay in the quest.
  - The opening of an empty quest still appears in Chronicle History.
  - Moving a quest to another realm moves the message it came from with it, into that realm's channel, under the existing [move confirmation](../mission-tracking/specifications.md#quest-placement-and-moves).
  - A quest's results, Attention requests, and failures arrive as replies in that thread, in place of the buttons beside Chronicler's replies.
- The in-feed reply line is a compact one-line bar under the anchor message showing the state dot, reply count (`1 reply`, `N replies`, or `Opening…`), title, waiting or attention indicator, and last activity time; pressing it opens the quest or errand in the next pane.
- Each quest in the **Quests** tab and each errand in the **Errands** tab keeps the fuller **block** that quotes a sample of the last exchange: the owner's latest message ("You") and the companion's latest reply ("Companion"), each cut to 160 characters (CHG-0571).

The Errands tab starts with a **New errand** block which opens the existing errand composer in the next pane.
The Quests tab starts with a **New quest** block which creates and opens an empty quest in the current realm or in the Borderlands.

Quest and errand cards in these tabs use the conversation header archive box and **Mark as done** checkbox. Pressing a checked box reopens that quest or errand. An empty quest shows the trash icon in the list and in its header because the archive action deletes it. Quest cards keep the existing confirmation when ending a quest stops running threads. The action buttons operate independently of the card’s **Open** action.

The blocks appear whether or not the lists already have entries.

### Errands as replies

- An errand is a fork of its parent's conversation. It has an **anchor** message in that conversation, which carries its reply line (title, state, what is new); pressing the reply line opens the errand's conversation in the next pane, as a thread opens in Slack. The errand's result lands in that thread.
- **Opened by the owner:** by a Reply, the anchor is the message replied to. The Reply opens an empty errand at once, in every layout, and its pane; its own composer takes the first message, which wakes it. No box opens at the bottom of the quest. An empty errand is kept and can be deleted, as an empty quest is. While it is empty, its pane shows the starting-context warning of [thread tree](../thread-tree/specifications.md#opening-a-thread) when its context takes more than 25% of its model's window (CHG-0751).
- **Started in the Errand pane:** when a desktop quest opens without a selected errand, its third pane holds a composer for a new errand. Sending there starts the errand from the quest's current context using the usual starting-context limits, and opens the new conversation in that pane. Its first message is also copied to the quest, as the quest's own first message is to its channel: conversation only, waking and telling no one, and it becomes the errand's anchor, so the errand's own pane pins it as its root and the first reply is the agent's. The selected errand's New errand button brings the composer back.
- The Open errand button in the quest's message box is available in the single-conversation layout, which has no Errand pane.
- **Opened by an agent:** a single errand opened with `open_thread` anchors directly to the triggering message (`replyToMessageId`, or the conversation's latest message) with no extra brief bubble, inheriting the quest's Companion configuration by default. When an agent opens multiple errands on the same triggering message in one turn, Outlore posts one attributed agent brief reply per errand tied to that triggering message so each errand hangs from its own message and none is asymmetrically tied to an umbrella prompt. The anchor only positions the reply line: the tree parent stays the conversation, so anchoring never creates a sub-errand. Pressing the reply line, or replying to the anchor message, opens the errand's pane, where the brief is the first message.
- **The root and the reply count:** as in Slack's thread panel, the anchor message is the thread's **root**. A thread's pane pins its root at the top, above the thread's own messages: a quiet read-only card with its sender and time, then a rule reading `N replies`. The root takes no Reply or Comment. A thread with no anchor, or one whose opening message repeats its anchor (a quest started from the dashboard, or an errand started from the errand pane, leaves a copy of its text in its parent conversation), pins its own first message as its root so the first reply is the agent's. The Chronicle (Chronicler, realm channels, and Borderlands) is a channel rather than a thread, so it pins no root. The reply count counts the thread's own messages other than system notices and the questions it asked the owner, all of them when the root lives in the parent conversation (an errand's first message is a reply, not the root), and all but the first when the thread is its own root.
- Opening a reply line from a pane replaces every pane to the right of it.
- **Follow-up work from an errand:** the agent can post an attributed message about the work in the quest conversation. The owner can Reply to start a quest-level errand from that message. Posting the message starts no errand.
- New errands open directly beneath the quest. Existing phone access to older errands continues.
- **Existing sub-errands** retain their original parents and histories. Opening one reuses the errand pane and offers a return to its parent.

### Panes

- At most three panes are shown at once. A window too narrow for three shows fewer; each pane has a minimum width.
- When the window is too narrow for the whole chain, the last panes are shown and the earlier ones are folded to notches, so the deepest conversation left open keeps its space and each folded parent is one press away. On a narrow window the channel folds first.
- By default the panes share the width equally: one third each with three.
- Folding a pane gives its space to a neighbour. A folded parent is one press away on the left edge of the next open pane. Its icon and state dot identify the realm, quest or errand, and its name shows on hover or keyboard focus (CHG-0630).
- When the last open desktop pane is a realm channel or the Borderlands, its right edge has **New quest** and **Quests**. When it is an ordinary quest, the edge has **New errand** and **Errands**. A Ritual offers **Errands** for its runs. The create notch has a plus on its icon and starts a quest or opens the errand starter.
- The list notch opens its tab in the same pane, even when the list is empty. It shows the most urgent active child's state and provides the route to open a folded child from the list. Rituals remain available from the channel's Rituals tab.
- When multiple conversation panes are visible, each desktop pane header offers a **Fold** button with a pane-and-arrow icon. The quest and errand can fold even when they are the deepest conversation.
- On a phone (a narrow window) one pane shows at a time with a Back chevron, as the [phone view](../mission-tracking/specifications.md#simplified-left-navigation) does today.

#### Phone channels

- Tap a realm name or **Borderlands** on the phone's Quests tab to open its channel. Tap a realm's **Show all** shortcut to open its Quests tab.
- The channel shows one view at a time. Its tab row scrolls horizontally when needed. It offers Missives, Quests, Rituals, and Companions. A realm also offers its Realm tab.
- Back in the channel opens the Quests tab. Back in a quest opened from the channel returns to the same channel and tab. This includes quests opened from a linked Missive. A quest picked directly from the Quests tab returns there, and one opened from Chronicler returns to Chronicler.
- The Quests tab and a quest's own header offer Mark as done, Mark as not done, and Archive or Delete. They use the same quest ending rules as desktop, including confirmation when required.
- Panes are resized by dragging their edges; the widths are remembered.
- **Equal widths** sits above the conversation row and gives the open panes the same share again (a third each with three) and forgets the dragged shares; folded panes stay folded.
- When multiple conversation panes are visible, the **Expand pane** button uses outward arrows and gives its pane the available width. Folded parents become left-edge notches, and child conversations are available from the tabs. A full-width pane omits the layout buttons.

#### The phone's Chronicle

- The phone's first tab is the **Chronicle**, carrying its unread count as a badge, as the desktop sidebar's row does.
- The floating pill, which holds the tabs, shows on every phone screen but a quest or errand, so the count shows without opening anything.
- The Chronicle's Attention filters wrap on a narrow screen, and every row and conversation heading is a touch target.
- Back in a quest or errand opened from the Chronicle returns to the Chronicle, as a channel quest returns to its channel; a quest picked directly from the menu returns there.

Realm and Borderlands channels omit the Chronicler, harness, and model line on both Missives and Quests.

### The sidebar

- The sidebar uses the conversation pane background and aligns the Chronicle entry with the pane headers.
- A single one-pixel rule separates the desktop sidebar from the content, and the section divider appears between Chronicle and Realms.
- Fold controls sit before their row labels, and quest highlights are inset within the list.
- An empty realm starts collapsed and shows **No quests yet** when expanded.
- The desktop sidebar shows Chronicle, the realms and Borderlands, their quests, and the existing creation and footer controls. A realm’s chevron expands or collapses its quest rows in place. The realm name opens its chat and a quest row opens its conversation directly.
- By default it is an **overlay**: it floats over the panes without moving them, appears when the pointer reaches the edge of the window it is set to, and hides when the pointer leaves, when the owner chooses something in it, or on Escape. A short delay before opening keeps a stray pointer from opening it, a button and a keyboard shortcut open it for touch and keyboard users, and it stays open while a quest is dragged (the owner: "like the sidebar in some browsers like Arc … exactly").
- It can be set to the **left** or the **right** edge.
- The top bar's sidebar button **pins** the sidebar and unpins it (the owner: "should pin or unpin it, not just make it appear until we unfocus it"; ⌘B does the same). Pinned, the sidebar takes its place in the frame and pushes the panes, on the edge it is set to, and does not close on a pointer leave, a press outside or Escape; unpinned, it is the overlay again. The pin is remembered (CHG-0562).
- A **docked** mode keeps today's behavior: the sidebar stays in the window and pushes the panes, like a sidebar pinned all the time.

## Edge cases

- An archived errand keeps its card, and opens read-only as [today](../thread-tree/specifications.md#archiving-an-errand).
- Journal, lore, and budget pages opened from a pane replace that pane’s contents until Back.

## Acceptance and validation

- Verify separate channel histories and Companions, realm lore for the matching channel, and global lore in the Borderlands.
- Open an errand from its channel and quest, then open a legacy sub-errand and return to its parent within the same pane.
- Check persisted Reply anchors, including proposal messages, duplicate Replies and the errand brief. An errand agent's follow-up appears in the quest, and only the owner's Reply starts it.
- Open the Chronicle from the sidebar and verify that the attention feed is the default and routine events appear under History. Open an unread approval request from the feed, check that its unread indicator clears and it remains in Needs attention, then answer it and check that it leaves the filter. Check that reminders are deduplicated. Move a quest and check that the other channel receives its originating message.
- On a paired phone, open the Chronicle tab, follow an unread request into its quest or errand, answer it, and press Back to return to the Chronicle; check that the tab's badge clears with the read.
- Check the in-pane tabs and composer model buttons with a channel, quest, and errand open together.
- Check draft preservation, pane-local Journal, Lore, and Budget, sidebar pinning, and return from the Workshop in a desktop window.
- Preserve phone access until the phone batch.

## Requirements

No new obligation beyond the [system-wide requirements](../../requirements.md); every conversation keeps its existing behavior inside a pane.

## Dependencies

[mission-coordination](../mission-coordination/specifications.md) (Chronicler's conversation and proposal), [mission-tracking](../mission-tracking/specifications.md) (the sidebar's content, realms), [thread-tree](../thread-tree/specifications.md) (errands, depth), [thread-messaging](../thread-messaging/specifications.md) (results as messages), [thread-panel](../thread-panel/specifications.md) (the details panel), [scoped-intel](../scoped-intel/specifications.md) (the lore a channel's Chronicler has).

## Supersedes, once built

The desktop Chronicle pane and the earlier Chronicler dock, the fixed sidebar, and the desktop sidebar’s nested errand rows. The existing phone menu still exposes its errand rows. Those sections get a pointer here when the work is built, not before.

## Exclusions

The `#` tag, multiplayer, and anything else in the [draft](draft.md).
