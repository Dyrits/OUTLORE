# Mission tracking

Technical design: [proposed blueprint](blueprint.md), including the first slice's staged acceptance.

## Problem and outcome

When work runs in many threads across harnesses, the user loses track of which missions exist, which need them, and what they cost. The dashboard shows every mission with one state, its threads, and its spending, starts new missions in one message, and ends finished ones, so the user always knows where their work stands.

## Agreed behavior

### Missions

- A mission is its top thread and every thread beneath it (see [thread-tree](../thread-tree/specifications.md#threads-and-missions)). Deleting the top thread deletes the mission.

### Starting a mission

- The user starts a mission from the dashboard with a first message, a harness, agent, model, effort, and workspace (or none).
- All but the message are prefilled, so a mission starts with one message and Enter: the Companion is always the Workshop's default Companion (harness, model, effort, on the computer's own sign-in; CHG-0257, replacing the last mission's choices), and the folder is the last mission's.
- A new mission's top thread starts as **Open as new mission** does in [thread-tree](../thread-tree/specifications.md#off-topic-requests): with global skills and intel, and nothing from another mission.
- The owner can create a quest directly from a Realm or the Borderlands without going through Guildmaster.
  The quest belongs to that realm and receives its lore; a Realm tied to a workspace also supplies its workspace.
- A new-quest button beside each Realm and in the Borderlands heading (the former Realmless section's control, renamed) creates an empty quest there. It uses the last quest's harness and model and is named "New quest" until its first message names it.

Direct realm creation was agreed on 2026-11-10 (CHG-0133) and implemented in `f21e768`; its appearance awaits the owner.

### Quest placement and moves

Agreed on 2026-11-10 (CHG-0130). On 2026-11-11 (CHG-0161) the placements were reduced to Realms and the Borderlands, and that change is built (CHG-0164; storage in [0015](../../architecture-decision-record/0015-realms-tied-or-not-and-one-borderlands.md)): creation in a Realm, with or without a workspace, and in the Borderlands is implemented; moving existing quests by dragging is built (CHG-0172).

- A quest belongs to a Realm, which may be tied to a workspace or not and shares lore across its quests, or to the Borderlands, which have no workspace and no shared lore.
- Lore access follows [lore scopes](../scoped-intel/specifications.md#scopes).
- The owner can move an existing quest between any of these placements, including correcting a quest started in the wrong workspace.
- The sidebar supports dragging a quest from its current Realm or the Borderlands onto another placement.
- Before changing placement, Outlore asks for confirmation naming the source and destination and explaining that the available realm lore will change.
  Confirm applies the move; Cancel leaves the quest and its tree in their original placement.
  This confirmation applies to every placement-changing move, including taking a quest out of its realm, whichever interface initiates it. See [Simplified left navigation](#simplified-left-navigation) for the change to the sidebar targets.
- A move includes the quest and every errand at every depth, including threads explicitly attached to another workspace; no branch stays behind.
- A move is refused while any thread in the quest tree is running; it does not stop running threads automatically.
  The running-thread check applies when the owner confirms, even if no thread was running when the drag began.
- Moving into a Realm tied to a workspace changes the workspace of every thread in the tree to that Realm's workspace.
- Moving into the Borderlands, or into a Realm tied to no workspace, removes workspace attachments throughout the tree; its threads then use the quest's scratch folder.
  Threads keep their harness sessions; the journal gets an entry saying the quest moved, which each turn's note carries (CHG-0172).
- The conversation, journal, and thread-scoped lore stay with the quest; shared lore access follows the destination, without copying lore between realms.
- Earlier conversation content can still refer to the former realm or workspace; a move does not rewrite that history.
- A quest is independent of the artifacts it produces or modifies; moving it does not move, copy, or delete files, edits, branches, or existing own copies.
- Existing own copies remain accessible at their original locations, which the interface shows after a move.
- A move does not merge old own copies into the destination workspace or use them as its working folder.
- Moving changes future turns' workspace context; relocating a workspace's folder is a separate operation in [workspace attachment](../workspace-attachment/specifications.md#missing-folder).

Sidebar drag-and-drop and confirmation were agreed on 2026-11-10 (CHG-0133) and built on 2026-11-11 for the web build (CHG-0172, [verification](../../verification/2026-11-11-quest-moves.md)); the owner's review of the look is pending.

### Title

- The top thread proposes a title on its first turn with `set_mission_title`.
- The user can rename a mission at any time. Once the user has renamed it, `set_mission_title` is refused.

### Mission state

- A non-archived quest is idle, running, or asking for the user (Summons).
- Done, Finished, and Fulfilled are no longer quest or errand statuses (CHG-0135 and CHG-0136, agreed on 2026-11-11; implementation pending).
  - Update, 2026-11-17 (owner decision in the codebase review): **Done stays**. A quest marked done ends as Done and Done is a thread state; the code, the dashboard's Mark as done, and CHG-0304 and CHG-0308 keep those paths. Fulfilled and Finished stay retired. The two statements above and the "marking a quest Done is removed" line under Ending a mission record the 2026-11-11 agreement and are kept for history.
- Reporting a result does not finish or archive a quest, and there is no "Mark as done?" prompt.
- A quest whose work is complete remains available until the owner archives it.
- A quest shows Summons if any thread needs the owner; otherwise it shows running while any thread has a turn in progress, and idle otherwise.
- A failure requiring owner intervention produces Summons with its reason.
  Waiting and stopped remain visible thread details, and stopped threads require explicit resume.
- Reporting an errand's result still informs its parent, then leaves it idle unless it has more work or needs the owner.
- No migration of existing Done quests or errands is required: the product is unshipped, and the owner accepts resetting development data instead (CHG-0137).
  This specification does not perform a reset.

### Ending a mission

- The user archives a quest when it is no longer needed in the active list; marking a quest Done is removed.
- After 14 days without activity, the dashboard asks whether to archive the quest; it no longer offers Mark as done.
  The question is not sent as a phone notification.
- Activity is any turn or message in any of the mission's threads, by the user or by an agent. A dismissed question comes back after another 14 days without activity.
- Archiving a quest that used no tokens, holds no message, and is not a Ritual's, deletes it instead (as [deleting a mission](../thread-tree/specifications.md#deleting) does): it carries nothing, so it does not appear in the Archived view. Archiving a realm still archives its empty quests, so Restore brings them back.
- Archiving a mission with running threads asks one confirmation that names them, for example "2 threads are still running. Stop them and archive?", then stops them.
- The previous auto-archive rule based on time since Done no longer applies; no replacement automatic archiving rule is agreed.
- The inactivity duration is adjustable in settings.
- An archived mission leaves the main list and appears in the Archived view, from which the user can reopen it.
- Writing in a thread of an archived mission brings the mission back to the active list and the state worked out from its threads.
- Archiving a mission adds an entry to its journal (see [mission-journal](../mission-journal/specifications.md#when-a-mission-ends)), and `find_missions` still matches archived missions.
- After the owner's quest-archive action succeeds, the interface returns to that quest's realm overview, or the Borderlands for a quest with no realm. Cancel and failure leave the current view unchanged.

### Creating a realm

- Creating checks and writes in one host transaction (CHG-0317). The result is Created, ArchivedMatch for the chosen folder, or NameTaken for an active name requiring acknowledgement. Recovery takes precedence; no realm is created or restored before the owner chooses.
- Earlier apps receive null and retain error-based duplicate-name handling. The new app accepts null from an earlier host; recovery on that host still requires its existing flow or an upgrade.

### Archiving and restoring a realm

Agreed on 2026-11-13 (CHG-0271), built; the quest and Ritual choices below were agreed on 2026-11-14 (CHG-0270). This replaces the older Hide and Delete permanently proposal for realm removal in [workspace attachment](../workspace-attachment/specifications.md#hiding-and-deleting-a-workspace).

- The owner removes a realm from active use by archiving it, not by permanently deleting it. This applies to realms tied to a folder and to realms tied to none.
- **Archive realm…** is available in the realm's panel and through the same top-right archive button used for quests, acting on the realm when its overview is shown. Right-click actions are deferred.
- Every realm archive asks for confirmation naming the realm and counting its quests. Nothing changes before confirmation; Cancel leaves the realm unchanged.
- The confirmation also counts running threads across its quests, including nested errands. When any are running, the confirming action says **Stop and archive realm** and stops them as part of archiving.
- Archiving hides the realm and all its quests from active lists and the sidebar. Its identity, name, crest, lore, conversations, journals, and folder association are preserved. It never deletes the workspace folder.
- Archived realms appear in the Archive with a Restore action. Restore brings back the realm and the quests that were active when it was archived; quests already individually archived stay archived.
- After a successful realm archive, the interface goes to the home screen. Cancel or failure leaves the current view unchanged.
- **Quests that stay active** (agreed 2026-11-14, CHG-0270): the confirmation lists the realm's active quests, each with a checkbox, all unchecked. A checked quest moves with its whole tree to the Borderlands instead of being archived; every other quest is archived with the realm. A moved quest keeps its conversation, journal, and its own lore, but loses access to the realm's lore, and a later restore of the realm does not bring it back. A quest at work cannot be checked: a move never stops threads, so it is stopped and archived like the rest unless the owner stops it first. A Ritual's quest is not listed here.
- **Rituals** (agreed 2026-11-14, CHG-0270): the confirmation names the realm's Rituals and says they will be switched off. Archiving switches them off, stops a run underway, and keeps each Ritual and its quest in the Rituals place with its instruction and history, marked **Realm archived**. While the realm is archived a Ritual cannot be switched on or run. Restore and Start afresh leave the Rituals off until the owner switches them on. Moving a Ritual to the Borderlands is not offered.

### Reusing an archived realm's folder

Agreed on 2026-11-13 (CHG-0271); not implemented.

- One resolved folder belongs to one realm, including while that realm is archived. Choosing its folder during new-realm creation must not silently reuse a hidden realm or create a second realm for the same folder.
- The owner chooses the folder and fills the new-realm form. If the folder belongs to an archived realm, the flow then offers **Restore**, **Start afresh**, and **Cancel**, showing the archived realm's name, archive date, and quest count. A realm tied to no folder has no folder match.
- Restore keeps the realm's lore and brings its previously active quests back as described above.
- Start afresh reactivates the same realm id with no realm-level lore in use. All its previous quests stay archived, attached to that realm and findable in the Archive, with their own lore, conversations, and journals unchanged. Global lore is unchanged.
- Starting afresh deletes the realm-level lore through the existing recoverable [lore deletion and history](../scoped-intel/specifications.md#history-and-undo), not a permanent purge. The owner can recover those entries through the lore panel's Deleted filter.
- For both Restore and Start afresh, a two-column comparison then shows the archived realm's name and crest beside the proposed name and crest. The owner chooses the name and crest independently, so either combination is possible. (Crests are removed by CHG-0449, see [Simplified left navigation](#simplified-left-navigation): the comparison covers the name only.)
- Each comparison row is omitted when its two values are exactly the same; if neither row remains, the comparison popup is skipped. Restore defaults to the archived values, and Start afresh to the proposed values.
- A blank name in the form resolves to the folder's name and is treated as the proposed name for comparison. The form starts with a randomly shuffled crest, which is a proposed value, not an absent choice. These rules supersede the earlier proposal to treat blank fields as no choice.
- Start afresh has a final confirmation after the comparison, naming the realm and counting the realm-level lore entries to delete. Its actions are **Wipe lore and start afresh** and **Cancel**, and it explains recovery through the Deleted filter.
- Cancelling any step makes no change to the stored realm, its quests, or its lore. Neither path creates a new realm id or changes files in the workspace folder.

### Realm names

Agreed on 2026-11-13 (CHG-0271); implemented in 0.1.3-Prototype, with the quest-proposal realm picker completed in CHG-0280.

- Realm names are labels, not identities, and duplicate names are allowed. Realms have distinct ids; folder-tied realms are also distinguished by their resolved folders.
- Creating or renaming a realm to a name shared by another active realm warns the owner and lets them confirm rather than blocking. Archived realms do not count as collisions.
- Where active names collide, folder-tied realms show a parent-folder hint alongside their name in the sidebar and realm pickers, for example `app · client-a`.
- A colliding realm tied to no folder has no folder hint; the warning still asks for confirmation.

### Dashboard

- Each mission row shows its title, state, workspace, thread count with how many are running, spending with its budget rings when it has a budget, and last activity.
- Missions that need the user come first; the rest follow by latest activity.
- The user can filter by state and workspace, and search titles and briefings.
- Archived missions have their own view.
- The dashboard is a list, not a board.
- The phone web app shows the same dashboard, with the same filters and actions.

### Realms overview

Agreed on 2026-11-13 (CHG-0271); removed by CHG-0463 (the sidebar lists every realm and quest, and the app opens on a plain home screen).

- The Realms destination becomes a compact quest-list overview grouped by active realm, using the existing overview's row presentation rather than a new card layout.
- Each realm group has its name (and, until CHG-0449 is built, its crest), links to that realm's overview, and lists its active quests with state, Companion, latest activity, and foldable nested errands.
- Realm grouping takes precedence over day grouping. Include empty active realms with a New quest action; leave archived realms out.
- With CHG-0449, quests in no realm appear as plain rows after the realm groups. See [Simplified left navigation](#simplified-left-navigation).

### Spending

- A mission's spending is the total of its threads' spending, in each provider's own unit: a cost for API-key turns, tokens for subscription turns, chosen by each turn's billing kind. What counts toward a limit, and the one case where an estimate does, is agreed in [budget-control](../budget-control/specifications.md#budgets).
- Beside them, every turn whose model has a price carries an estimated cost, shown as `≈ $1.20` on the mission's card, row, and information, and on each errand's. Estimates, billing kinds, and the price table are agreed in [budget-control](../budget-control/specifications.md#estimated-cost) (CHG-0126).

### Compact left navigation

- The owner agreed on 2026-11-10 to a narrower main left menu with smaller icons, tighter rows, readable labels, and the existing collapse and resize controls.
- The original compact proportions used a width around 220 px and 15 px labels. The sidebar's minimum width is 284 px: the Borderlands heading with its fold arrow and its two hover buttons measured 274 px in the web build, and the rest is room for wider system fonts; no heading title truncates at the minimum (CHG-0163).
- The owner can drag the sidebar up to one quarter of the window's width; on a window too narrow for its quarter to reach the minimum, the minimum wins. A remembered width is held to the quarter again whenever the window changes size or reopens (CHG-0163).
- The owner judges the final proportions in the running app.
- The quest tree lives within the main sidebar, following [quest tree visibility](../thread-tree/specifications.md#quest-tree-visibility).
- Agent validation checks navigation, collapse, resizing, and readable access to long labels at the reduced width; human acceptance checks the proportions in the running app.

### Simplified left navigation

Agreed on 2026-11-18 (CHG-0449). Crest removal is CHG-0452. The sidebar, footer menu, retired destinations, Gild removal and Connectors in Settings are CHG-0457, with the phone layout in CHG-0454. The Realms overview and quest panel's Realm row are CHG-0458. The errand rename is CHG-0456. Compact creation rows are CHG-0459.

- The **Realms** and **Borderlands** labels use the height and text size of the sidebar's other rows (CHG-0490), and the two creation rows (**Visit a realm**, **Start a quest**) read as buttons by a thin rounded border, with no fill at rest, no italics, and a soft fill on hover (CHG-0481; CHG-0476's italics and CHG-0478's resting fill were dropped).
- A quest's or errand's state dot stands before its title, after the fold mark (CHG-0473), not at the end of the row.
- Pressing the **Realms** or **Borderlands** label folds or unfolds its section (a small chevron stands before it; CHG-0472). Folding hides the section's realms or quests and the **Show all** link; the section's action row stays. Each realm still folds by pressing its own heading. Starting a quest unfolds the section and realm it lands in. Folds are not remembered across restarts.
- The **Realms** section is one list: realms tied to a folder and realms tied to none are not separated, and the folder icon alone marks the difference (CHG-0480, which retires the thin line of CHG-0471 and CHG-0170).
- The Realms overview page is removed (CHG-0463) and the sidebar's **Realms** title no longer opens anything; the owner asked on 2026-11-18 to bring back quiet group labels instead (CHG-0464): a small muted **Realms** label above the realms, and **Borderlands** above the quests in no realm, below the separator. Neither label has an action. The app opens on a plain home screen with one **Start a quest** button, and Back leads there. The sidebar lists every realm with its quests.
- Each realm is a group of quests with a title and a fold control. A small folder icon precedes the title of a folder-backed realm in the sidebar. Each quest can show its nested errands. Quests in no realm appear after the realm groups, flush with the realms and below a horizontal line. Each list shows five quests and the quests that are running; **Show all** appears whenever quests are hidden and reveals the rest. The separate Borderlands page is removed.
- Two action rows, each with an icon at the right of its label, open their sections (CHG-0466, CHG-0477, CHG-0479). **Visit a realm**, marked with a plain "+" (CHG-0483; a castle with a plus, then a compass, came before), stands directly under the **Realms** label, with the realms listed below it, and opens the realm creation flow, titled **Visit a new realm**, whose confirming button reads **Visit the realm** (not "Create"). A horizontal line then separates the realms from **Borderlands**, which opens with **Start a quest** (CHG-0477), marked with a sword and plus, directly under its label, and lists the quests in no realm below it. The button creates an empty quest in no realm, including when the current view is a realm. Both sections always show their label and action.
- The sword and plus in each realm header creates an empty quest in that realm.
- On a quest row, hovering or focusing the row (on desktop) shows an archive icon at the right end of the row (a place is kept for it; CHG-0473); on a quest that is empty (no message, no tokens, not a Ritual's) it is a delete icon instead. Both use the existing ending flow: archiving an empty quest deletes it, and a quest with running threads asks first. The quest panel's own actions are unchanged, and the phone has no hover marks (CHG-0465).
- The sidebar's separators (between **Realms** and **Borderlands**, and the two of the foot) are drawn as before CHG-0453: a hairline with a small diamond at its middle (CHG-0489).
- The sidebar's foot is, from the list down: a line, the plan-limit rings (and a global budget's meters, when it has limits; hovering a ring opens its card above it), a second line, and one **Workshop** row with the gear icon (CHG-0488). When no plan reports a limit and no global budget is set, only the first line and the Workshop row show. There is no menu of other places and no gear in the top bar: the Workshop is the only place the foot opens, and a narrow window's full-screen sidebar has the same foot.
- **Reserves** (usage and budgets) and the former Charter (devices and relays, now **Remote access**) are sections of the Workshop, not places of their own; the Workshop's **Reserves** section holds the usage report (CHG-0488).
- The **Workshop** row opens **Settings** directly (CHG-0470). While the Workshop is shown the row stays selected, and pressing it again closes the Workshop and goes back to where the owner was before (the open quest or screen; the home screen when the Workshop was opened otherwise; CHG-0485). Going to another quest or place from the Workshop forgets the way back. the owner wants no menu of other places for now, so **Rituals**, **Lore**, **Archive** and **Reserves** have no entry in the sidebar until a place is chosen for them (`menuPlaces` keeps the list). On a phone (a narrow window), a quest's header, drawn in the app's own look (no rounded bubbles; CHG-0494), is a back chevron on the left, which opens the main menu (the sidebar as a full screen, no longer the realm's quest list; CHG-0491), the title followed by its state's colored dot (no state word; CHG-0493) centered in the middle, and the plain archive icon on the right (CHG-0492; an empty place where the quest cannot be archived, as for an errand or a Ritual's quest). The phone has a simple view: one screen with the sidebar (the realms, quests and errands, the two buttons and the same icon), and the conversation screen; the owner asked for this on 2026-11-18 (CHG-0454). The Charter becomes the **Connectors** section of Settings. The Craft and Library placeholders are removed. [Connectors specification](../connectors/specifications.md)
- The Guild Hall hub is removed for now. Chronicler remains available from its top-bar button and opens in its own right-hand panel. [Quest coordination](../mission-coordination/specifications.md#place)
- Realms can be reordered by dragging a realm's heading onto any other realm: it lands before that realm when dropped on its upper half and after it on its lower half, and a line at that edge of the realm shows where (not the ring that shows a quest dropped on a realm); the dragged heading dims while it is carried (CHG-0484). The order is saved (`ReorderRealms`), so the phone shows it too; realms never placed are listed by name and a new realm comes last. Dragging needs the web build, as for quests (CHG-0468).
- Quests can still be dragged onto a realm. The sidebar has no dedicated drop zone for taking a quest out of a realm; instead the quest panel has a **Realm** row (a plain quest, not an errand or a Ritual) that lists the other realms and "No realm", on a phone as well (CHG-0458, my choice, to redirect). Any placement change requires the existing confirmation and running-thread check. [Quest placement and moves](#quest-placement-and-moves)
- Rows use text, a state dot where applicable, and a folder mark for folder-tied realms. Folds use plain chevrons. The menu button uses a standard glyph. Crests are removed from the interface and realm tools. New-realm and recovery forms drop crest choice, and the recovery comparison covers the name alone. Existing crest data stays stored and the app ignores it.
- The interface, Chronicler's guide, and thread tool text use **errand**. Code retains identifiers such as `thread` and `guildmaster`.
- Remove **Gild** from the available themes. **One** and **Iskios** remain available in their light and dark looks.

**Agent acceptance.** In light and dark looks and at narrow widths, each of the two creation buttons opens its own flow, and every menu item opens its destination on desktop and phone. Quests with no realm appear after grouped quests in both views, including when there are no realm groups. Dragging displays no dedicated target for ungrouped quests. Dropping on a realm still requires confirmation. Chronicler and its conversation are accessible after removing the hub. A database with saved crests opens and shows realm names without crests. The interface, guide, and tool text use the new terms. The theme picker offers One and Iskios only.

**Owner acceptance.** Review the sidebar in a window and on a phone.

### Left navigation structure

Agreed on 2026-11-11 (CHG-0134). Partly superseded on 2026-11-18 by [Simplified left navigation](#simplified-left-navigation) (CHG-0449). The owner then asked for the sidebar to be built (CHG-0143); direct creation is built (`f21e768`); confirmed quest moves and lifecycle changes remain to build.
This navigation scope is specified; [related capability work](draft.md) is deferred to the relevant capability's implementation preparation.

The expanded left sidebar uses this order:

| Position | Entry | Contents or destination |
| --- | --- | --- |
| 1 | Guild Hall | The place where the owner talks with Guildmaster |
| 2 | Realms | Realms, tied to a workspace or not, each containing its quests and their nested errands |
| 3 | Borderlands | Autonomous quests with no workspace and no shared lore, each with its nested errands |
| 4 | Rituals | Routines |
| 5 | Craft | Workflows |
| 6 | The Keep | Library, Lore, Archive, in that order |
| 7 | Reserves | Compact usage summary leading to a detailed usage page |
| 8 | Charter | The Connectors and The Vault ([connectors](../connectors/specifications.md), CHG-0321); a marketplace-like place for connectors, nothing else; unbuilt placeholder today |
| 9 | Workshop | Application settings, accounts, permissions, and defaults (the former Charter; CHG-0146) |

The separate Workshop for MCP servers, connectors, and skills (position 8 of CHG-0134) was withdrawn on 2026-11-11. On 2026-11-16 the owner asked for connectors in the Charter, which now holds them and The Vault (CHG-0321); skills and custom MCP servers have no place yet.

- The Realms, Borderlands, and The Keep headings fold and unfold their contents the same way: pressing the heading or its fold arrow; each realm can expand or collapse its quests; each quest and errand can expand or collapse its children at every supported depth (CHG-0163).
- Under the Realms heading, each Realm (crest and name) and its quests stand 20 px in from the heading, so the names of the Realms do not line up with the title (the owner's choice, CHG-0167).
- The Borderlands section is the former Realmless section renamed, with the Borderlands mountain icon and the same new-quest button; it has no intermediate grouping.
- A realm tied to a folder shows a small line-drawn folder icon after its name, with the folder's full path on hover and as its accessible label; a realm tied to no folder shows none (CHG-0163; a scroll was tried and dropped, CHG-0170).
- The Realms section lists every realm in one list in the owner's order, with no hairline between realms tied to a folder and those tied to none (CHG-0480; CHG-0170 had grouped them).
- Inside one block (between two diamond dividers) the categories are spaced identically, 36 px rows 1 px apart, in the scrolling part and the fixed foot alike; only the dividers separate blocks (CHG-0171).
- Hover marks (CHG-0163, after the Delta app): the fold arrow of the group headings, realm rows, quests, and errands, and the action buttons (realm overview, new quest, new realm) show only while the pointer is anywhere over the whole row, or while a keyboard focus (as `:focus-visible` would show it) is inside the row; the focus a mouse click leaves does not keep them. The quest count of a realm row and of the Archive row shows the same way, only on hover or keyboard focus (CHG-0171). They keep their place while unseen, so nothing moves or truncates when they appear. Always shown: titles, icons and crests, the folder icon, and state dots. The hover belongs to the whole row box, up to its edges, including the place of the hidden buttons (CHG-0171).
- The fold arrow is a bow arrow, fletching at the tail, pointing right when folded and down when open. On a group heading it stands right after the title; on a realm row after the name and its folder icon; on quest and errand rows in its former place before the title.
- Each Realm and the Borderlands show their three newest quests; the open quest and every running quest remain visible beyond the cap, each in its place in the list (CHG-0440). A "Show all N quests" link opens the corresponding full list, most recent first; N counts the quests, not their errands.
- The full list nests each quest's errands beneath it as the sidebar does, indented, each with its state, title, harness, model, and latest activity, and each quest and errand with children folds and unfolds; quests start unfolded there. Day groups and order follow each quest's own latest activity (CHG-0163; nesting rather than a flat list is an assumption the owner may overrule).
- A Realm's quest list offers its realm panel, including crest, lore, and rename controls, with or without a folder. The Borderlands panel content remains undecided.
- The sidebar is the only left quest tree; the conversation retains its details sidebar on the right, following [quest tree visibility](../thread-tree/specifications.md#quest-tree-visibility).
- The owner's supplied Guild Hall image is the reference for the nested quest presentation: visible parent-child relationships, indentation, branch guides, expansion controls, and state indicators.
  The image does not authorize its other Guild Hall contents, footer, wording, or new actions.
- Library holds generated and uploaded artifacts, especially artifacts from quests without a workspace; it is not limited to workspace-free quests.
  Artifact collection, supported types, storage, retention, and file actions need a separate Library specification before implementation.
- The Charter holds the connectors and The Vault; their scope, switches per realm and quest, and loading are in [connectors](../connectors/specifications.md). A separate destination for skills and custom MCP servers remains future; their scope, inheritance, loading, and failures stay governed by [tool and skill loading](../tool-and-skill-loading/specifications.md).
  The Charter holds nothing else (CHG-0326).
- Reserves opens the [detailed usage page](../budget-control/specifications.md#reserves-usage-page); its name is retained.
- Quest placement, direct creation, and confirmed moves follow the existing agreements above.

Navigation acceptance, once the draft decisions are settled:

- **Agent validation**: check the ten entries and their order; the three Keep destinations; and Reserves access to the usage page.
- **Agent validation**: use quests in both placements, including a realm tied to no folder, with multiple errand depths; expand and collapse parents, open descendants, and check that selection reaches the intended conversation.
- **Human acceptance**: compare the nesting with the supplied reference in the running desktop app and judge readability at the compact sidebar width.
- **Agent validation**: in dark and light, hover marks hidden at rest, shown when the pointer is anywhere on the row (including its far right), hidden again after a click once the pointer leaves, shown on keyboard focus; no heading title truncated at the minimum width; the rail dragged to a quarter of two window widths.
- Agent validation includes more quests than the former recent-quests cutoff, an idle quest after reporting a result, archive and reopen, long titles, empty groups, and collapsed and narrow-screen navigation.

## External contract

Threads use this thread tool (see [0005](../../architecture-decision-record/0005-thread-tools-over-mcp.md)):

| Tool | Purpose | Arguments | Answer |
| --- | --- | --- | --- |
| `set_mission_title` | Name the mission | A title | Done, or a refusal when the user has renamed the mission |

## Acceptance and validation

- **Automated, with a fake harness**:
  - direct creation from a Realm and the Borderlands without a Guildmaster turn, checking placement, lore and workspace, the last harness and model, the initial title, and naming on the first message;
  - dragging quests between sidebar placements opening the move confirmation, with no placement change before confirmation and none on Cancel;
  - confirming a move refused if any descendant starts running while confirmation is open;
  - quests in a Realm tied to a workspace, a Realm tied to none, and the Borderlands, with the correct shared lore;
  - moving the entire quest tree between each placement, including nested threads with a different prior workspace;
  - refusing the move without changing any placement or attachment when any thread in the tree is running;
  - preserving conversations, journals, and thread lore while changing workspace attachments and shared lore access;
  - leaving files, edits, branches, and own copies at their original locations after a move, with old own-copy locations still accessible;
  - a mission's three active states, with Summons taking precedence over running and running over idle, including nested descendants;
  - an errand reporting its result to its parent and returning to idle, with no Mark as done action;
  - failures needing the owner producing Summons, waiting and stopped shown as details, and stopped threads staying stopped until explicitly resumed;
  - the top thread's result leaving the quest available without a Done state or Mark as done prompt;
  - the inactivity question after the set duration, agent activity resetting it, and a dismissed question coming back;
  - the confirmation naming running threads before archiving, and those threads stopped;
  - spending totalled per provider unit by billing kind, with an estimated cost beside it that never counts toward a limit (budget-control);
  - absence of the old Done-based auto-archive and finished-quest visibility controls;
  - writing in an archived mission bringing it back;
  - reopening from the Archived view;
  - the proposed title, the user's rename, and `set_mission_title` refused afterwards;
  - prefilled choices when starting a mission;
  - dashboard order, filters, and search.
- **Realm lifecycle batch (CHG-0271), automated with a fake harness and temporary data**:
  - realm archive through either entry point, with confirmation, quest and running-thread counts, no change on Cancel, and nested running threads stopped on confirm;
  - archive preserving realm identity, lore, conversations, journals, and folder association across a service restart, and never deleting the workspace folder;
  - restoring only the quests archived with the realm, while previously individually archived quests remain archived;
  - quest archive returning to its realm or the Borderlands, realm archive returning to Realms, and Cancel or failure not navigating;
  - matching an archived realm by resolved folder without creating a duplicate, and the Restore, Start afresh, and Cancel paths;
  - independently choosing old or proposed name and crest, defaults for both paths, equal-row and equal-popup skipping, folder-name fallback, and a shuffled crest participating in comparison;
  - Start afresh requiring its final counted confirmation, preserving the realm id, leaving all old quests archived, deleting only realm-level lore, and restoring a deleted entry through the existing history;
  - duplicate active names warning without blocking, archived names excluded from collisions, and parent-folder hints in the sidebar, overview, and pickers;
  - the Realms overview grouping active quests and nested errands by realm, including empty realms and excluding archived realms and the Borderlands.
- **Realm lifecycle batch, human acceptance**: judge the grouped overview, both archive entry points, confirmation wording and counts, Archive restoration, and the independent name/crest comparison in the running desktop app.
- **Human acceptance**: on the desktop and on the phone web app, the user starts 3 missions, sees the one that needs them first, leaves a completed quest idle, archives one, and reopens it.

## Requirements

- [Local data](../../requirements.md): missions stay on the user's computer.
- [Single user](../../requirements.md): the dashboard shows one user's missions.

## Dependencies

- [thread-tree](../thread-tree/specifications.md): threads, their states, and deleting a mission.
- [mission-journal](../mission-journal/specifications.md): the entry added when a mission ends, and the briefings searched.
- [budget-control](../budget-control/specifications.md): budgets and their rings beside the spending shown.

## Exclusions

- Budgets and their limits belong to budget-control.
- Guildmaster, which proposes missions for the user, belongs to mission-coordination.
