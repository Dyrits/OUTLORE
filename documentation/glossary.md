# Outlore

Outlore (called Iskios until CHG-0285) organizes a person's work with AI agents as missions carried out in trees of threads, where any thread can open further threads on any harness, model, and effort, and threads talk to each other in both directions.

Definitions include agreed future concepts. A definition is not an implementation claim; check the [capability specifications](capabilities/) and [architecture's current state](architecture.md) for what exists.

## Guild interface vocabulary

The owner selected the Guild art direction on 2026-11-09, including its display names.
The definitions below remain the technical vocabulary for contracts, tools, stored records, and capability paths; the interface uses the following names for those same concepts.
User-authored text and historical service messages are not rewritten.

| Technical term | Interface name |
| --- | --- |
| Mission | Quest |
| Top-level mission thread | Quest |
| Model selected to do the work | Companion |
| Thread opened beneath another thread | Errand (formerly Side-quest, renamed 2026-11-18, CHG-0449 and CHG-0456) |
| Grouping of missions with shared lore, tied or not to a workspace | Realm |
| Autonomous mission, with no workspace and no shared lore | A quest in the Borderlands |
| Control conversation | Chronicler's conversation (formerly Guild Hall) |
| Entity the user talks with in Control | Chronicler (formerly Guildmaster, CHG-0173) |
| Workflow | Craft |
| Workflow run | Craft run |
| Routine | Ritual |
| Running (state) | Underway (the stored value is Underway too, CHG-0599) |
| Idle (state) | Resting (stored value too; it is the owner's turn, CHG-0599) |
| Done (state) | Fulfilled (stored value too, CHG-0599) |
| Summons, Awaiting word (state names) | Retired as state names: the state is Attention, or Waiting, as stored (CHG-0599) |
| Settings | Workshop |

Journal, briefing, harness, effort, budget, approval, and archive keep their meanings and names.
Fulfilled is the ending a quest reaches when the owner marks it done, and a thread state; CHG-0599 brings the name back and replaces Done with it (the "Mark as done" action keeps its label for now). Fresh is a quest with nothing sent yet. Otherwise work remains Resting, Underway, Waiting, or asking for the owner (Attention) until the quest is archived.
Companion means the selected model doing the work, not a conversation or a distinct saved agent definition; selectors say Companion (model) to make this explicit.
Craft and Ritual are the agreed names for the future automation interfaces.
Waystones and Spoils remain mockup suggestions for devices and changes.
An existing errand may contain legacy descendants; the name covers every child thread, including an aside, whose off-topic behavior stays distinct. The app, Chronicler's guide, the tool descriptions and the specifications say errand; code identifiers (`sideQuest`) and the stored mention token `#side-quest:` keep the old word, and dated records and the changelog keep what they were written with.

## Work

**Mission**:
A top-level thread other than Control, together with every thread opened beneath it. A quick chat is a mission too.
_Avoid_: Goal, objective, task, ticket, project

**Thread**:
The unit of work: a conversation with its own identifier, carried out by one harness at a time, and optionally opened beneath a parent thread.
_Avoid_: Sub-thread, child thread, chat, conversation, session

**Turn**:
One exchange in a thread, recording the harness, agent, model, and effort that produced it.
_Avoid_: Step, round

**Aside**:
A thread opened beneath the current one for an off-topic request the user chose to keep in the mission. It knows the mission's briefing and informs its parent when the conversation comes back to the mission, but does not update the journal itself.
_Avoid_: Side thread, tangent

**Thread message**:
A message one thread sends another, in either direction along the tree, or to any thread it references with `@`, that can ask for a reply.
_Avoid_: Ping, notification

**Comment**:
A note the owner writes on a message of a quest or errand, on the whole message or on a passage selected in it. Comments wait, per thread, in the browser's storage and go with the owner's next message in that thread, as a block in its text.
_Avoid_: Annotation, review note

**Attachment**:
A file the owner adds to a message, kept by Outlore and given to the thread's harness with the message's text. Only images are supported so far.
_Avoid_: Upload, media, file (alone)

**Terminal**:
The host's shell, opened with `!` on an empty composer line and shown as a bubble in the conversation, whose visible output can be sent as context. The host window runs it plainly; a paired device opens one only while the host's **Allow terminals from paired devices** switch is on, inside the host's sandbox.
_Avoid_: Console, command line, shell (alone)

**Steer**:
To deliver a message into a thread's current turn, changing its course without waiting for the turn to end. Its counterpart is to queue the message for the next turn.
_Avoid_: Inject, nudge

**Journal**:
The record a mission keeps as it evolves: its briefing and a dated change log only ever added to. Every thread in the mission starts from it and may update it.
_Avoid_: Mission journal, mission memory, mission history

**Briefing**:
The part of a journal that says where the mission stands, rewritten as it changes. Every thread in the mission reads it before it starts.
_Avoid_: Summary, journal summary, description, brief

**Dashboard**:
The one overview of all missions with their state, threads, spending, and the start of each briefing. Control reads it as text.
_Avoid_: Mission dashboard, index, mission list, board, kanban

**Guild Hall** (technical term: Control conversation):
The name of Chronicler's permanent conversation outside every quest. CHG-0449 retires the Guild Hall hub page and keeps the conversation in Chronicler's own panel. [Quest coordination](capabilities/mission-coordination/specifications.md#place)

**Chronicler** (the assistant; formerly **Guildmaster**, CHG-0173):
The app-wide assistant the user talks with in desktop conversation panes. The narrow screen's bar has no tab for it (CHG-0773).
It asks for the user's confirmation before opening a quest.
_Avoid_: Coordinator, dispatcher, orchestrator, main thread, Mission control

**Reply**:
The action that starts a quest from a channel message or an errand from a quest message. Comment holds a note for the next message. [Conversation panes](capabilities/conversation-panes/specifications.md#reply-and-comment)
_Avoid_: Sub-thread, fork (alone)

**Chronicle**:
The desktop sidebar destination, and the first tab of the narrow screen's bar, for updates and reminders across realms and the Borderlands. The attention feed and History split are specified in CHG-0569. [Conversation panes](capabilities/conversation-panes/specifications.md#main-conversations-and-channels)
_Avoid_: Log, Guild Hall (the retired hub's name, kept for Chronicler's permanent conversation in the older specifications)

**Missive**:
A message in a quest's, an errand's or a channel's conversation, as the Missives tab of a pane lists them (formerly the Messages tab, CHG-0571). The service and the contracts keep the word message. [Conversation panes](capabilities/conversation-panes/specifications.md#the-three-levels)
_Avoid_: Message (for the tab's name)

**Pane**:
One conversation column. Desktop shows up to three, in channel, quest, and errand order. [Conversation panes](capabilities/conversation-panes/specifications.md)
_Avoid_: Panel (the details column and the sidebars are panels), window, tab

**Reply line**:
A link on the originating message that shows the quest or errand and opens its conversation. [Conversation panes](capabilities/conversation-panes/specifications.md#errands-as-replies)
_Avoid_: Sub-thread, thread link (a reply is a message, see Comment)

**Mention**:
A realm, quest, or errand the owner names with `#` in a message, as context for the thread that receives it. A Companion named with `@` is a **Companion mention**: it asks that model to answer the one message (not built). Files are named with `+` and skills with `$`; those are not mentions.
_Avoid_: Reference (the token's name in code), link, tag

**Reach**:
Whom a thread may message and whose journal it may read beyond its own tree: what the owner's mentions and the messages it received open for the turn they reached, and nothing after.
_Avoid_: Permission, access, scope

**Theme**:
The owner chooses One, Iskios, Black & white, or Slate in the Workshop.
One is the default, and each theme comes in a dark and a light **Look**.
_Avoid_: Skin, style

**Look**:
A theme's dark or light variant; the owner may follow the system's. Called the color scheme in code.
_Avoid_: Mode, appearance

**Iskios**:
The theme the app had as its own look before the rename to Outlore: a flat dark navy look, and the original application icon as the Dock icon.

**Gild**:
The retired theme with brown, gilt, and parchment colors.
CHG-0457 removed it from the theme picker.

**One**:
The neutral theme based on Zed's One Light and One Dark colors. It is the default theme. It keeps the original application icon and the shared sidebar drawings.

**Black & white**:
The theme of pure greys with no hue for what decorates (surfaces, text, borders, the canvas): white on black in the dark look, black on white in the light one. What carries meaning stays colored: the state colors, so the activity indicator, the usage rings and graph, and the status dots keep their hues. It keeps the original application icon. Called `mono` in code.

**Slate**:
The theme with the colors of the islands prototype: a cool grey ground under near-white panels in the light look, a near-black ground under slate panels in the dark one, and an indigo accent. It was called Islands while that word named a theme (CHG-0668); a stored choice of that name opens Slate. It keeps the original application icon.

**Layout**:
How the desktop window's panels are drawn, whatever the theme: **Islands** or **Flat**. A phone, a narrow window, and the Android app are always flat.

**Islands**:
The default layout, in which the sidebar, each conversation pane (the realm's, the quest's or Ritual's, and the errand's), and the content of a screen without panes float as rounded cards, the islands, on a canvas derived from the theme's colors, each with a hairline and a soft shadow. The owner sets the canvas (cool glow, warm glow, or flat), the gap between the islands, their corner radius, and their lift, and each change shows at once.

**Flat**:
The layout the window had before Islands: panels side by side in one frame, told apart by dividing lines.

**The Keep**:
The navigation group containing Library, Lore, and Archive.

**Library**:
The place for generated and uploaded artifacts, including those from quests without a workspace.
Collection and lifecycle behavior remain to be specified.

**Workshop**:
The application settings page, opened from the gear in the desktop top bar or the Settings row in the narrow-screen side menu.
It shows one section at a time from Permissions, Look and feel, Providers, Companions, Connectors, Remote access, Messaging, Limits, Reserves, and Updates.

**Charter**:
The former sidebar destination for Connectors and The Vault.
The owner now manages them under **Workshop → Connectors** (CHG-0449, CHG-0457).

**The bar**:
On a narrow screen, the capsule of tabs floating above the bottom edge (CHG-0773): the Chronicle (its icon alone), Realms, and, once a realm and a quest are chosen, Quests and Errands, which grow in. A tap shows a tab's choice and a hold of half a second opens the sheet to change it. The conversation's composer sits above it.
_Avoid_: Pill (the three-tab bar it replaced, CHG-0761), tab bar (alone)

**The side menu**:
On a narrow screen, the top bar's button of three lines at its left opens a panel that slides in from the left with the hosts (the computer, the paired hosts, and a way to pair another), the Keep (Lore, Archive), Reserves, and Settings (the Workshop) (CHG-0773).
Before it, the top bar's Menu button of four squares opened a screen of tiles (CHG-0761).

**Connector**:
A named integration that gives threads the tools of one outside service or app, installed once by the owner from the list Outlore offers. It is **installed** (on this computer, global), **connected** (given a key, a sign-in or a permission) and **enabled** (switched on for a realm, the Borderlands or a quest); a thread can use it only when all three hold ([connectors](capabilities/connectors/specifications.md)).
_Avoid_: Plugin, integration, MCP server (the way a connector is delivered is a technical choice)

**Code Mode**:
An experimental global setting under **Workshop → Connectors**, off by default.
When it is on, a thread can call connector and thread tools by running short pieces of code through `run_code`.
Five thread tools and the harness's own tools stay directly callable (CHG-0324, CHG-0446, CHG-0447, CHG-0776).

**The Vault**:
Where the host keeps connectors' secrets, shown to the owner by connector, kind and date and never by value.

**Reserves**:
The usage summary and destination for detailed consumption, budgets, remaining allowances, and reported plan limits.

**Workspace**:
A folder or repository on the user's computer, chosen by the user or cloned by Outlore, where a thread works.
_Avoid_: Project, repo, directory

**Realm**:
A grouping of quests with lore shared across its quests. A realm may be tied to one workspace (a repository or folder) or tied to none.

**Borderlands**:
The sidebar section and stored placement for quests with no realm.
These quests have their own lore and global lore.
The desktop sidebar also opens the Borderlands conversation. [ADR 0015](architecture-decision-record/0015-realms-tied-or-not-and-one-borderlands.md)
_Avoid_: Free Realm, Realmless

**Browsable root**:
A folder set in the Workshop (Settings) under which the user and threads can browse and choose workspaces.
_Avoid_: Allowed folder, sandbox

**Scratch folder**:
The folder Outlore keeps for each mission, where its threads with no workspace work.
_Avoid_: Temp folder, default workspace

**Own copy**:
A thread's own git worktree of a git workspace, on its own branch, shared by the threads beneath it and merged back with one button.
_Avoid_: Worktree, fork, sandbox

## Execution

**Harness**:
An agent runtime that carries out a thread's turns: Claude Code, Codex, OpenCode, or Mistral Vibe.
_Avoid_: Bot, engine, runner

**Agent**:
An agent definition offered by a harness, such as a Claude Code subagent, optionally chosen for a thread.
_Avoid_: Bot, persona, teammate

**Model**:
The language model a harness uses for a turn.

**Effort**:
The reasoning level a turn runs at.
_Avoid_: Reasoning level, thinking budget

**Provider**:
The account that bills model use, such as an Anthropic subscription or an OpenAI API key.
_Avoid_: Vendor

**Provider account**:
One sign-in a harness runs with: the computer's own, named after the computer's name, or one added in Outlore with its own folder, such as a second Claude account named "Work".
_Avoid_: Profile, login, credential

**API key account**:
A provider account whose credential is an API key instead of a sign-in: the key is sealed in the Vault, and the account runs a harness (Claude Code) against the provider's own endpoint, such as Z.ai or Kimi. It has its own folder like any added account.
_Avoid_: Key profile, custom provider

**Companion preset**:
A name for a complete stack of one primary Companion (harness, provider account, model, effort) and its ordered backup Companions, which the owner picks instead of choosing each part by hand. An empty backup list is part of the stack too. The interface says preset. Light, Balanced, and Heavy are presets; see [companion presets](capabilities/companion-presets/specifications.md).
_Avoid_: Profile, template, tier (a tier is one of the three presets Chronicler picks among)

**Handover**:
A change of harness, agent, model, or effort in the middle of a thread, giving the new one the thread's full history.
_Avoid_: Switch, transfer

**Approval**:
The user's permission for one risky action in one thread.
_Avoid_: Consent, confirmation

**Choice question**:
A question a thread asks the owner to answer by choosing from options, with an own answer when allowed, instead of approving an action. One dialog carries up to four choices; the owner sends the answers or skips it. It never saves a standing permission.
_Avoid_: Poll, form, prompt

**Standing permission**:
The user's permission for one kind of risky action, in a workspace, a mission, or everywhere, granted with Always allow and removable from the Permissions page.
_Avoid_: Rule, always-allow, grant

**Computer use**:
A thread, Chronicler included, seeing and operating the host's own desktop (its screen, pointer and keyboard) through Outlore's `computer_*` tools, one approved app at a time. No sandbox contains it. Specified, not built.
_Avoid_: Remote control, desktop automation, CUA

**Computer backend**:
The program behind the `computer_*` tools that reads the screen and sends the clicks and keys: Cua Driver on macOS first, replaceable without changing the tools. Not a harness.
_Avoid_: Driver (except Cua Driver, its name), agent

**Computer lock**:
The one hold on the host's desktop that a thread takes while it uses the computer, so two threads never click at once; another thread calling a tool is told who holds it.
_Avoid_: Mutex, queue

**Attention**:
The state of a thread that waits for the user: an approval, an answer, a decision after the chatter guard paused it, a budget reached, a missing workspace folder, or a tool or skill loading problem that prevents a turn.
_Avoid_: Needs you, blocked, pending

**Budget**:
A spending limit, in cost, tokens, or both, on a mission or on Control, that every thread in it draws on. Single threads have no budget.
_Avoid_: Quota, cap

**Global budget**:
The budget on all spending, across every mission and Control, over a day, week, or month.
_Avoid_: Total budget, monthly cap

**Account budget**:
A limit, or a credit, on one provider account, counted from Outlore's own turns on it, over a day, week, month, or no period.
_Avoid_: Credit limit, account cap

**Billing kind**:
Whether a turn ran on a subscription, on an API key, or on an unknown sign-in; it decides which unit of a budget the turn counts toward.
_Avoid_: Billing type, plan type

**Estimated cost**:
A turn's cost in dollars worked out by Outlore from its tokens and the price table, shown with `≈`, never counting toward a limit except for an API-key turn the harness reported no cost for.
_Avoid_: Price, bill, fake cost

**Plan limit**:
A limit a harness reports for a subscription, such as a 5-hour or weekly window, shown and never enforced by Outlore.
_Avoid_: Quota, rate limit

## Automation

**Routine**:
A trigger paired with a skill or instruction, run for the owner on a schedule. The interface calls it a Ritual: an entity of the realm beside the quests, each run an errand beneath it, with fallback Companions ([rituals](capabilities/rituals/specifications.md)).
_Avoid_: Job, cron, scheduled task

**Trigger**:
The schedule, webhook, or event that starts a routine run or a workflow run.

**Workflow**:
A graph of steps, each carried out as a thread, with conditions, approvals, and outputs.
_Avoid_: Pipeline, flow

**Workflow run**:
One pass through a workflow.

**Skill**:
A reusable, named set of instructions, available globally, in a workspace, or in the thread it was installed in and the threads beneath it.
_Avoid_: Plugin, recipe

**Instruction**:
Free text that tells a thread how to work, attached to a routine, workspace, or the whole system.
_Avoid_: Prompt, system prompt

## Lore

**Lore**:
Saved facts, preferences, and decisions, each held at one lore scope. One item is a lore entry; several are lore entries, or simply lore.
_Avoid_: Memory, note, knowledge, intel

**Lore scope**:
Where a lore entry belongs: an errand, a quest, a realm, or global.
See [lore scopes](capabilities/scoped-intel/specifications.md#scopes) for visibility and Guildmaster's access exception.

**Lore kind**:
What a lore entry is (rule, preference, decision, fact, or temporary), which sets how fast it fades when unused.

**Lore index**:
The one-line-per-entry list of active global lore in a thread's context; the full text is read through `search_intel`.

**Dormant lore**:
A lore entry that faded below a strength of 0.15: out of the index and starting context, still found by search.

**Archived lore**:
A lore entry that faded below a strength of 0.05: out of search too, kept in the lore panel, where the user can restore it.
_Avoid_: Deleted lore

Stored records, request tags, and thread tool names keep the earlier word `intel` (the `intels` table, `ListIntel`, `save_intel`), so existing data and agents keep working.

## Devices

**Desktop app**:
Outlore installed on a computer, in its own window. It uses this computer as its host, or a host it is paired with.

**Web app**:
Outlore opened in a browser, on a phone or a computer, with nothing installed. It always uses a host it is paired with.
_Avoid_: Phone web app, web client

**Mobile app**:
Outlore installed on an Android phone from the release APK.
_Avoid_: Native app

**Paired device**:
A desktop app, web app, or mobile app connected to a host by a pairing code or link. It has the owner's full authority over the host it is paired with, except where the host fences it (terminals, folders).
_Avoid_: Remote, client

**Host**:
The computer whose Outlore runs the threads, conversation terminals, and folder work.
It keeps its own name, which the owner can change from the host or a paired device.
The desktop app starts and stops the host service.
[ADR 0018](architecture-decision-record/0018-host-service-runs-on-its-own.md) describes the planned **Keep running after quitting** option.
_Avoid_: Server, remote, daemon

**Screen view**:
One screenshot of the host's display, shown on demand to a paired device with no thread and no agent action; a still image, never a stream, and nothing the paired device can click on.
_Avoid_: Remote desktop, screen share, stream

**Pairing code**:
The one-time text the host shows to pair a device, kept as the fallback beside the QR code and the pairing links. It works once and expires after 10 minutes.
_Avoid_: Connect code, ticket

**Pairing link**:
A link that carries a pairing code in its fragment and pairs a device when it is opened or scanned: the **web link** (`<web app address>/#<code>`, opens the web app) and the **app link** (`outlore://pair#<code>`, opens an installed Outlore). The host's QR code encodes the web link; the phone app reads it with its scanner and opens an app link. It is as secret as the code: it works once and expires with it, and the fragment never reaches a server.
_Avoid_: Invite, share link

**Direct path**:
The direct WebRTC data channel that a paired desktop or web app and its host upgrade to after connecting through the relay, carrying its own Noise NK encrypted session so the relay forwards nothing while it is up, and falling back to the relay if it drops or cannot open.
_Avoid_: P2P tunnel, bypass
