# Window-check review list · 2026-11-25

A checklist for the owner of every pending look in [work in progress](../work-in-progress.md), grouped by screen.
It was written from the documents and the code at `a8416f70` (0.2.6-Pre-Alpha); no window, phone, or live harness was opened for it.
Only the owner accepts a look: no row here records an acceptance.

## How to read it

Each row names what to open, what to look at in one line, the section it comes from (with its CHG number and the release that shipped it), and a state.

| State | Meaning |
| --- | --- |
| still pending | The check was recorded as needed, nothing found since shows it done, and the work shipped in 0.2.5 or 0.2.6 (or needs a phone or a live harness, which no release settles). |
| probably released | The work shipped in a tag before 0.2.5 and its code is still in the app; the owner has used the app since, but no record says the look was seen. Look once and tick it, or say what is wrong. |
| superseded | A later change replaced what the check was about, so the check no longer applies. These sections were removed from work in progress and have no row; the reasons are at the end. |
| superseded in part | One half of the check was replaced; the other half stands. |

The kind of check is in brackets: [window] on desktop, [phone], [live] a real harness or provider turn, [decision] a choice only the owner can make.
Releases and their tag dates: 0.1.0 12 Nov, 0.1.1 and 0.1.2 13 Nov, 0.1.3 14 Nov, 0.1.4 and 0.1.5 15 Nov, 0.1.6 and 0.1.7 17 Nov, 0.1.8 to 0.1.10 18 Nov, 0.1.11 and 0.1.12 19 Nov, 0.2.0 and 0.2.1 21 Nov, 0.2.2 23 Nov, 0.2.3 and 0.2.4 24 Nov, 0.2.5 24 Nov, 0.2.6 25 Nov.

Later window checks by an agent exist for the Islands layout, the notch colour, and nested sidebar buttons ([Islands layout](2026-11-23-islands-layout.md), [notch colour](2026-11-23-notch-colour.md), [nested sidebar buttons](2026-11-23-nested-sidebar-buttons.md)).
They saw the sidebar, the panes, folded notches, and a Ritual in a throwaway window on the fake harness, so they lower the risk of the rows they touch but do not replace the owner's look.

## Count

| State | Rows |
| --- | --- |
| still pending | 29 |
| probably released | 50 |
| superseded in part | 5 |
| Total rows | 84 |

Ten more sections were superseded outright and removed from work in progress; they have no row (see the end of the page).

## 1. Sidebar (desktop)

| # | Open | Look at | Source | State |
| --- | --- | --- | --- | --- |
| 1.1 | [window] Sidebar with a realm of more than four quests, one quest having errands | The fold chevron shows with the pointer away; four quests then "Show all N quests"; two errand rows then "Show N errands" (opens the Errands tab); a Ritual row has a chevron and is not counted in N | Quest chevrons and sidebar limits; CHG-0635, CHG-0636 (0.2.2), reworked by CHG-0690 (0.2.5, never seen) | still pending |
| 1.2 | [window] Sidebar, a quest with errands | The errand tree opens under the quest; the Quests and Errands tabs open from the sidebar | Sidebar errands; CHG-0620 (0.2.1) | probably released |
| 1.3 | [window] Sidebar, a realm with quests and Rituals | The divider between quests and Rituals is evenly spaced | Sidebar Ritual divider; CHG-0648 (0.2.2) | probably released |
| 1.4 | [window] The sidebar pinned, as an overlay, and unpinned; a realm with no quests | Empty realms start closed; the sidebar looks like the panes | Desktop sidebar refresh; CHG-0587 (0.2.0); the Islands check saw all three modes | probably released |
| 1.5 | [window] Start a quest, then look at the list | A running quest stays listed past the preview limit | Running quests in the sidebar; CHG-0440 (0.1.7) | probably released |
| 1.6 | [window] Rows that wait for the owner, a summons, or a failure | Nested lower-left corner marks (25% grey, 50% amber, 75% red) and the errand guide line on the quest's border | Nested corner marks in the sidebar; CHG-0530 (0.1.12) | probably released |
| 1.7 | [window] [phone] Sidebar headings and empty lists | The creation icons at the right of Realms and Borderlands appear on hover; empty lists say "No realm to visit yet." and "No quest in the Borderlands yet."; a quest leaves its realm from the quest panel's Realm row | Simpler app; CHG-0452 to CHG-0463, CHG-0503 to CHG-0507 (0.1.9, 0.1.10); its five-quest cap is superseded by CHG-0636 | probably released |
| 1.8 | [window] Sidebar with quests in realms and in the Borderlands | Realms and Borderlands are the only two kinds of place; the folds and the arrow's place on quest rows | Only Realms and Borderlands; CHG-0161, CHG-0163 (0.1.0); "Show all N" assumption superseded by CHG-0690 | probably released |
| 1.9 | [window] Drag a quest row onto a realm | The confirmation dialog; the drop target highlight | Quest moves; CHG-0172 (0.1.0) | probably released |
| 1.10 | [window] Order of quests and errands in the sidebar | Latest activity first whatever the status | CHG-0679 (0.2.4), not in work in progress ("running desktop app was not checked") | still pending |

## 2. Conversation panes, notches, and tabs (desktop)

| # | Open | Look at | Source | State |
| --- | --- | --- | --- | --- |
| 2.1 | [window] A quest with an errand, then a realm | The create notch and the list notch on the right edge; the list notch opens Quests or Errands in the same pane and shows the most urgent child; the crossed-swords and three-branch icons read clearly (at 16 px the errand icon can read as an "E") | Two child controls on conversation panes; CHG-0683 (0.2.5), CHG-0716 (0.2.6) | still pending |
| 2.2 | [window] A folded realm, quest, and errand pane | Centered icon notches with the state dot; colour matches the canvas beside the gap | Pane notches; CHG-0592 (0.2.0), CHG-0673, CHG-0674 (0.2.3); the child shortcuts of CHG-0592 and CHG-0666 are replaced by 2.1 | superseded in part |
| 2.3 | [window] Hover and Tab to a notch, with several stacked and a long title | The title card beside the notch on both edges | Notch titles on hover; CHG-0630 (0.2.2); code still in `shell/paneStrip.tsx` | probably released |
| 2.4 | [window] Two or more panes open, then one expanded | Expand pane shows outward arrows, the restore glyph differs from the done checkbox; a full-width pane has no layout buttons and its notches reopen the others | Pane header controls; CHG-0625 (0.2.2), CHG-0623 (0.2.1) | probably released |
| 2.5 | [window] Quest pane's Quest and Companions tabs | Companion editing per pane, drafts kept, Journal, Lore, and Budget open and close independently; the tabs sit in a rounded track with a filled pill | In-pane Quest and Companions tabs; CHG-0591 (0.2.0); CHG-0688 (0.2.5) restyled them (handoff 2026-11-24-1256 lists its visual check) | probably released |
| 2.6 | [window] An errand's header | Reopen and Stop on an errand; the status line | Pane status and errand controls; CHG-0605 (0.2.0) | probably released |
| 2.7 | [window] Open a quest from the sidebar with the realm pane open, then closed | An open realm pane stays open beside the quest; a folded or absent one opens folded | Fold the channel pane when a quest opens; CHG-0613 (0.2.1), changed by CHG-0678 (0.2.4, not checked in a window) | superseded in part |
| 2.8 | [window] The realm pane on Quests, then open another quest | The pane stays on Quests instead of returning to Missives | CHG-0700 (0.2.5), not in work in progress | still pending |
| 2.9 | [window] Fold, resize, narrow and wide sidebar, Workshop and back | Pane folding and resizing, return from the Workshop, opening Chronicle entries | Architecture audit follow-through; CHG-0614 (0.2.1) | probably released |
| 2.10 | [window] Any screen the 17 audit refactors touched (panes, sidebar, Workshop) | The entry names no screen: it asks for the owner's look and a redeployed relay for the room-full code | Architecture audit 2026-11-16; CHG-0301 to CHG-0318 (0.1.6) | probably released |
| 2.11 | [window] [phone] A quest with many messages, then press **Find** | Hits count, Next and Previous match, each pane searches its own conversation; controls fit with the phone keyboard open | Find in conversation; CHG-0650 (0.2.2), not in work in progress; its [verification](2026-11-23-conversation-search.md) says the acceptance steps still need a live run | probably released |
| 2.12 | [window] Chronicler's button in the top bar | The width of the assistant's conversation when it fills the panel; leaving it restores the previous page and its Companions tab | Expanded Iskios width; CHG-0247 to CHG-0249 (0.1.1); the dock that expanded it was removed by CHG-0457, the panel and top bar button remain | superseded in part |

## 3. Conversation content and composer

| # | Open | Look at | Source | State |
| --- | --- | --- | --- | --- |
| 3.1 | [window] [phone] A thread during a long turn; send two messages | The tray above the composer, numbered rows, Edit, Remove, the Steer toggle, Interrupt; light and dark | Queued-message tray; CHG-0702 (0.2.5), not in work in progress | still pending |
| 3.2 | [window] The composer | Squarer composer and the Workshop item in the File menu | CHG-0689 (0.2.5), not in work in progress | still pending |
| 3.3 | [window] A Missives card with a quest emblem in each dark look | The emblem on the card's corner button is visible | CHG-0715 (0.2.6), not in work in progress | still pending |
| 3.4 | [window] The composer's mode selector, then a Vibe turn | Four permission modes; the mode changes mid-turn and applies to the next | Thread permission modes; CHG-0612 (0.2.1); a live Vibe turn is unchecked | probably released |
| 3.5 | [window] [phone] Workshop Permissions, a phone composer | The four modes as the default; the selector on the phone; a live harness turn | One permission vocabulary in the Workshop and the composer; CHG-0617 (0.2.1) | probably released |
| 3.6 | [window] [phone] Open a long conversation | It opens on its last message; the scroll position holds during a streaming reply (may fail on Android) | Conversation opens on its last messages; CHG-0442 (0.1.7) | probably released |
| 3.7 | [window] An agent reply | The header shows the date and time, "19 Nov 2026 · 11:15 AM" | Date beside the time in agent replies; 0.1.12 (no CHG) | probably released |
| 3.8 | [window] Hover a message | Comment button, Comment on selection, the tray of comments above the message box | Comments on messages; CHG-0196 (0.1.0) | probably released |
| 3.9 | [window] Type `@` and `#` in a message box | The mention menu and chips; realms are now written with `#` | Mentions with @; CHG-0182 (0.1.0), realm part changed by CHG-0701 (0.2.5, real database not checked) | superseded in part |
| 3.10 | [window] A settled choice question | One agent bubble with the answer attached; chosen options filled, a foot line with outcome, time and device | Choice questions as chat bubbles; CHG-0535 (0.1.12) | probably released |
| 3.11 | [window] [live] Claude Code asks a question | The dialog with single or multiple choices, an own answer, Send, Skip | Choice dialog for AskUserQuestion; CHG-0299 (0.1.6); a live Claude Code run is unchecked | probably released |
| 3.12 | [window] [live] A turn that edits a file | The step shows `+added −removed` and unfolds to a diff; a Write over existing text; a failed call | A modified file's diff in its step; CHG-0531 (0.1.12) | probably released |
| 3.13 | [live] A Codex, OpenCode, and Vibe turn that edits files | Steps diffs appear for completed edits | File diffs across harnesses; CHG-0593 (0.2.0) | still pending |
| 3.14 | [live] A real long-running background command in Claude Code | The wake-up turn runs and its reply stays visible | Turns woken by a background command; CHG-0595 (0.2.0), CHG-0669 (0.2.3), CHG-0685 (0.2.5) | still pending |
| 3.15 | [live] A Codex turn on Full access | A harmless sandbox-blocked command retries and Permissions history records an automatic approval | Codex Full access prompts; CHG-0629 (0.2.2) | still pending |
| 3.16 | [window] [live] A thread's gauge | The context gauge per model; the compaction line at the limit | Context window per model; CHG-0509 (0.1.10) | probably released |
| 3.17 | [window] The `!` terminal in a thread with its own copy | The terminal opens in the worktree where the agent works | The `!` terminal in an own copy; CHG-0455 (0.1.9), CHG-0699 (0.2.5) | probably released |
| 3.18 | [window] [live] The composer's microphone with a real microphone | Press, speak, stop; words land at the cursor, nothing is sent; first press downloads the model | Voice input; CHG-0499 (0.1.9), CHG-0594 (0.2.0) | still pending |
| 3.19 | [window] [live] Workshop, Connectors, the **Code Mode** switch, then a live thread | With it on a thread reaches Outlore's and its connectors' tools by one `run_code` tool; a live Claude Code, Codex or OpenCode run | Code Mode widened; CHG-0447 (0.1.8) | probably released |

## 4. Quests, errands, and realms

| # | Open | Look at | Source | State |
| --- | --- | --- | --- | --- |
| 4.1 | [window] A quest's Quests and Errands tabs | The archive box, the trash icon on an empty quest, and the done checkbox work without opening the card; the running-quest confirmation | Quest and errand tab actions; CHG-0637 (0.2.2) | probably released |
| 4.2 | [window] A new errand's Companions tab | The compact model-and-effort picker at the foot, selected look, effort named Default | The errand draft's Companions footer; CHG-0631 (0.2.2) | probably released |
| 4.3 | [window] [phone] A quest's Missives, a realm's Quests tab | Reply-line blocks quote the last exchange (160 characters each) | Missives, reply-line samples; CHG-0571 (0.2.0); its Chronicle Activity layout is superseded by CHG-0586 | probably released |
| 4.4 | [window] [phone] An inactivity notice in realm Missives | The neutral card, posting date and time, quest shortcut; opening it goes to the quest | Inactivity warnings in realm Missives; CHG-0639 (0.2.2), CHG-0682 (0.2.5) | still pending |
| 4.5 | [window] A realm's channel | The new History tab after Rituals, quests grouped by month with their errands; the eye button is gone | CHG-0686 (0.2.5), not in work in progress (no test draws it) | still pending |
| 4.6 | [window] Visit a new realm, then the folder picker | The five new sources in the chooser; the folder picker on this computer and on a paired device | New realm sources; CHG-0645 (0.2.2) | probably released |
| 4.7 | [window] Archive a realm | The checklist of quests to move, the Ritual notice, the Realms overview, duplicate-name warnings | Realm archive, recovery, and grouped overview; CHG-0270, CHG-0271 (0.1.3); the drive script was not run | probably released |
| 4.8 | [window] A new errand from a quest | The shared Companion picker and tab; choosing a model does not change the parent | Side-quest Companion selector; CHG-0246 (0.1.1) | probably released |
| 4.9 | [window] [live] Ask Chronicler to start a quest | The proposal card with realm and Companion by tier; whether its wording should say "Create"; a live Claude Code run | Iskios, the assistant; CHG-0173 to CHG-0180 (0.1.0) | probably released |

## 5. Rituals

| # | Open | Look at | Source | State |
| --- | --- | --- | --- | --- |
| 5.1 | [window] [phone] **+ Ritual**, **Schedule as a Ritual**, **Edit**, at wide and narrow widths | The form opens in the middle panel; Back restores the previous view; the Companions tab uses the regular selector | Ritual form and tabs; CHG-0660 (0.2.3); the verification record is [2026-11-22-ritual-form-panel](2026-11-22-ritual-form-panel.md) | probably released |
| 5.2 | [window] [phone] A saved Ritual | Errands opens a run, Missives shows run history, the Ritual details tab; **Run now** adds a run | Ritual tabs and manual runs; CHG-0638 (0.2.2) | probably released |
| 5.3 | [window] [phone] The ritual row among quests; a Ritual's panel | The moon, schedule, under-way dot, dimmed when off; + Ritual on a realm header; "Made from" link; the delete confirmation; phone-narrow | Rituals as realm entities; CHG-0619 (0.2.1) | probably released |
| 5.4 | [live] A Ritual with a real harness | A scheduled run reaches a live harness | Rituals as realm entities; CHG-0619 | still pending |

## 6. Chronicle and Chronicler

| # | Open | Look at | Source | State |
| --- | --- | --- | --- | --- |
| 6.1 | [window] Chronicle with entries | **Quest**, **Errand**, or **Realm** before each source title; long titles wrap | Chronicle source labels; CHG-0641 (0.2.2) | probably released |
| 6.2 | [window] The Chronicle screen | **Needs attention** (failures, then requests) and **History** (Today, Yesterday, months); cards or quiet lines; the empty and failing wording | Conversation panes, desktop revision; CHG-0569, CHG-0586 (0.2.0) | probably released |
| 6.3 | [window] [live] Chronicler's own pane | The Guildmaster conversation; a live run searches first, picks Rituals for repeating work, acts only when asked | Guildmaster batch; CHG-0106, CHG-0107 (0.1.0) | probably released |

## 7. Workshop and settings

| # | Open | Look at | Source | State |
| --- | --- | --- | --- | --- |
| 7.1 | [window] [phone] Workshop, Providers | One card per harness; on a narrow window a row's name, detail, pill, Rename and menu must fit | Providers merged into one card per harness; CHG-0268 (0.1.3) | still pending |
| 7.2 | [window] The Companion picker | A tab per account; long or several account names wrap; the default Companion's account | Companion picker tabs per account; CHG-0264, CHG-0265 (0.1.2) | probably released |
| 7.3 | [window] The Companions panel's Presets view | Light, Balanced, Heavy as tabs; the Custom list; **+ Add preset** opens a draft; Save as new preset; Overwrite; the preset card | Companion preset stacks; CHG-0260, CHG-0261 (0.1.2), reworked by CHG-0661, CHG-0684 (0.2.3 to 0.2.5), CHG-0711 to CHG-0714 (0.2.5, 0.2.6, visual check named in each) | superseded in part |
| 7.4 | [window] Workshop Accounts and Companions | The Computer name card and its rename in every place; the default Companion's button opens the tab | Computer name and default Companion tab; CHG-0257 (0.1.2) | probably released |
| 7.5 | [window] The right-hand Companions tab | A fold for the Companion in use and per backup, drag to reorder, bin to remove | Companions tab; CHG-0220 to CHG-0245 (0.1.1) | probably released |
| 7.6 | [window] Workshop, Look and feel | One, Iskios, Black and white, and Slate themes; the Layout choice | One theme; CHG-0279 (0.1.3), CHG-0668, CHG-0672 (0.2.3) | probably released |
| 7.7 | [window] Workshop, Limits and Reserves | The line under each reply, account budgets, plan-limit rings; whether budgets belong on each account's row | Consumption and cost; CHG-0126, CHG-0141 (0.1.0) | probably released |
| 7.8 | [window] [decision] Workshop, Connectors | The catalog, Vault card, placement controls, the Always allow grants in Permissions, the thread panel's tools line | Connector Charter controls; CHG-0543 to CHG-0548 (0.1.12) | still pending |
| 7.9 | [live] A real Composio connection and the macOS Automation prompt | Composio's tools run; the Apple prompt names the app; a live Claude Code denial probe | Connectors sections: the four branches merged; the Vault joined to the gateway; Streamable-HTTP backend; Stdio backend and Apple apps; Connector gateway on a fake backend; CHG-0536 to CHG-0542 (0.1.12); all five say "not merged" but merged | still pending |
| 7.10 | [window] [live] Providers card, a real `vibe-acp` | A full Vibe thread; the card and pickers; reasoning levels | Mistral Vibe as a harness; CHG-0520 to CHG-0522 (0.1.10, 0.1.11), CHG-0618 (0.2.1) | still pending |
| 7.11 | [live] [decision] Install each OpenBot provider | Authenticated turns and permission behavior against the installed binaries | OpenBot provider parity; CHG-0651 to CHG-0655 (0.2.2) | still pending |
| 7.12 | [window] Workshop, Antigravity | The sign-in status line in an updated desktop build | CHG-0687 (0.2.5), not in work in progress | still pending |
| 7.13 | [window] Workshop, Providers | The provider logo marks | [handoff 2026-11-25-0937](../../.agents/handoffs/2026-11-25-0937-provider-logo-marks.md), CHG-0720 | still pending |
| 7.14 | [decision] Workshop, Vault card | The Vault card has no Verify button; ADR 0022's amendment awaits the owner's confirmation | The Vault's read-denial check runs by itself; CHG-0657 (0.2.2) | still pending |
| 7.15 | [window] [live] Settings, Updates | The updates card and top-bar notice; a real update from a published release to the next | App updates; CHG-0266 (0.1.2). Later releases and CHG-0664's forced update suggest this has been used | probably released |

## 8. Hosts, pairing, mobile, and releases

| # | Open | Look at | Source | State |
| --- | --- | --- | --- | --- |
| 8.1 | [phone] Android, a test realm and the Borderlands | Each channel tab, Back keeps the tab, mark done, reopen, archive, the Chronicle from the menu with its badge | Mobile feature parity; CHG-0646, CHG-0647 (0.2.2) | still pending |
| 8.2 | [phone] A phone at 390 px, then a real phone | The top bar and menu, Chronicler as the whole screen, quest Back (replaced for channels by CHG-0646), starting a quest on a phone, safe areas | Mobile navigation; CHG-0292 (0.1.5) | still pending |
| 8.3 | [phone] A phone installed from a release APK | Pairing, camera, pairing links; a release-signed APK; the light-only Expo configuration | Android APK; CHG-0298, CHG-0443 (0.1.7) | still pending |
| 8.4 | [phone] A release-signed older APK | Install a newer APK through the updater and remain paired | Android self-update; CHG-0460, CHG-0461 (0.1.9) | still pending |
| 8.5 | [phone] A phone one release ahead of a packaged macOS host | The **Update host** banner; the host restarts; the device reconnects | Updating a host from a paired device; CHG-0517, CHG-0518 (0.1.10) | still pending |
| 8.6 | [window] [live] A paired browser against a running host | Terminals from a paired device with the off-by-default switch | Terminals from a paired device; CHG-0644 (0.2.2) | still pending |
| 8.7 | [window] A browser pairing | The pairing dialog, banners, host menu; a pairing from another network | Browser access; CHG-0286 to CHG-0290 (0.1.4) | probably released |
| 8.8 | [window] Host menu, Add a host, Charter relay form | Look of the host menu, the dialog, the banner; the optional own relay form | Device pairing; CHG-0201 to CHG-0212 (0.1.0) | probably released |
| 8.9 | [window] The folder picker on this computer and a paired host | Search field, step-in browsing, New folder; the Workshop's browsable roots card | Folder picker on a host; CHG-0254 (0.1.2) | probably released |
| 8.10 | [live] Two installed releases | An installed 0.1.2 updating from a published release to the next, then Windows and Linux updating | Release 0.1.2-Prototype; CHG-0267 | probably released |
| 8.11 | [window] The packaged app | The installed `/Applications` app launches and owns its profile; Gatekeeper on another Mac | Release launch recovery; CHG-0125 and the packaging entries (0.1.0) | probably released |
| 8.12 | [live] A paired device idle for ten seconds | Idle traffic per connected screen; the 2026-11-24 Cloudflare usage | Idle host traffic per connected screen; CHG-0719 (0.2.6); other errands are measuring it | still pending |

## 9. Decisions and releases that are not screens (left alone)

These sections hold an open decision, a release record, or a spec; the list names them so none is lost.
They were not pruned and carry no row above.

| Section | Why it stays |
| --- | --- |
| Architecture audit, 2026-11-24 | Awaiting the owner's choice of candidate. |
| Daily background check-ins | Host wiring pending. |
| Code Mode core | The Charter switch and gateway it lists open were delivered later (CHG-0447, CHG-0538); live harness runs and measurement remain. |
| Connectors, specified, nothing built | The heading is stale: the connectors were built in CHG-0536 to CHG-0548. The open question is where the tools line lives (answered by CHG-0544). |
| Review since 0.1.6-Prototype | Uncommitted refactors are long committed; the QuickJS callback exception remains open. |
| T3Code comparison; Outlore rename; Release 0.1.3-Prototype review | Owner decisions and acceptance records; the commit parts are done in released tags. |
| Sandbox token isolation; Panel-ownership publication; Release 0.1.2 | History with a remaining Linux or run check. |
| Desktop packaging automation; the Goal and Batch 1 to Batch 13 sections | Delivered history of the first slice. |

## Removed from work in progress

Each section below was removed because a later, recorded change replaced what it asked the owner to look at.
Every one is still in git history (`git log -S` on its heading) and its decisions are in the changelog entry it names.

| Section | Reason and proof |
| --- | --- |
| Editable queued messages · CHG-0615 | Its window check watched a pending message keep its place in the feed. CHG-0702 (0.2.5) moved pending owner messages out of the feed into a tray; `conversation/entries.ts` filters them out with `isPendingOwnerMessage`, and `conversation/queuedMessageTray.tsx` holds Edit, Remove, Steer and Interrupt. The tray's own check is row 3.1. |
| Queue by default, Steer or Interrupt a queued message · CHG-0519 | Its look was a faint message in the feed with Steer and Interrupt under it. Replaced by the same tray (CHG-0702, row 3.1). The always-queue rule it records stays in CHG-0523. |
| Corner marks in the sidebar · CHG-0524 | The nested corner marks of CHG-0530 (0.1.12) replace CHG-0524's 75%/50% marks, as the work-in-progress entry for CHG-0530 says. The nested look is row 1.6. |
| Sidebar icons, flat matte · CHG-0207 | `assets/nav/` and `shell/navIcons.tsx` no longer exist: CHG-0457 (0.1.9) removed the nav icons. |
| Gild theme · CHG-0183 | CHG-0457 removed Gild (palettes, theme list, icon); a saved Gild choice reads as One. No `gild` remains in `apps/app/src`. |
| Guild Hall hub · CHG-0195 | CHG-0457 removed the hub page, recap, Guild Hall place, and the Iskios dock; `conversation/guildHallHub.tsx` and `shell/iskiosDock.tsx` are gone. The service's two hub requests remain, listed as unused leftovers in CHG-0457. |
| Guild-board batch · 2026-11-09 | CHG-0143 (0.1.0) removed the whole Guild board look: leather, timber, parchment, Cinzel and Alegreya, banners, frames, and the painted desk. Three code comments still say "parchment"; no font, banner, or frame remains. |
| Iskios, simple art direction, and the left sidebar · CHG-0143 | Its sidebar (Guild Hall, Free Realms, Realmless, Craft, The Keep, Charter) was removed by CHG-0457; `Realmless` and `Free Realm` appear only in an old migration. The flat navy theme it introduced is still the Iskios theme. |
| Left navigation structure · CHG-0134 to CHG-0137 | The specification itself says "Partly superseded ... by Simplified left navigation (CHG-0449)"; the ten entries (Guild Hall, Craft, The Keep, Charter) no longer exist after CHG-0457. |
| Compact left navigation specification · CHG-0123 to CHG-0125 | Its 220 px menu and "tree only while a side-quest exists" were replaced by CHG-0143 (250 px default, the quest's one tree in the sidebar) and then by the whole sidebar of CHG-0457. |
