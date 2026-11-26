# Work in progress

## Phone control step 1 · 2026-11-26 · built, merged on `main` and tested against fakes; emulator and real phone pending

CHG-0767, CHG-0768 and CHG-0770 in `0.2.10-Pre-Alpha`: six `phone_*` tools in the host's tool server, run by the paired app (`PhoneLink`, `Sessions.sendTo`, `apps/app/src/phone/`), with the phone's per-group switches as the only consent and each call naming its phone; the full suite (3,652 passed) and typecheck pass.
Next: the owner installs a new APK (six Expo packages and location permissions were added), turns on groups in Menu, Settings, Permissions, and checks each tool from a thread on the real phone (Android prompts, the notification, `Linking`, staying connected in the background, the relay and direct paths); then step 2 (accessibility service) gets its own specification.
Step 2 (CHG-0771): the owner wants headless control; the [research](research/phone-headless-control-2026-11-26.md) says it needs a shell-identity virtual display, so the owner first runs the [spike](capabilities/phone-control/spike-background-screen.md) stage A on their phone.
Builders' choices to redirect: `phone_open` links and app names, the notification title default, phone naming by device name.

## Dual-auth OAuth and 13 missing remote connectors · 2026-11-26 · built and tested against stand-ins; live sign-in and window check pending

CHG-0763 in `0.2.10-Pre-Alpha` (base `431e71f4`): enabled dual authentication (generic MCP OAuth 2.1 browser sign-in alongside static API keys/tokens, with mutual credential cleanup in the Vault and OAuth Bearer + session switching in `httpMcp.ts`) on the 6 DCR-capable existing connectors (Composio, Tavily, Stripe, Neon, GitLab, Datadog) and added 13 missing DCR-capable remote connectors (Linear, Notion, Atlassian `/v2/mcp`, Figma, Vercel, Sentry, PostHog, Intercom, Postman, monday.com, Airtable, PayPal, Dropbox).
Unlisted runtime-discovered tools default safely to Unclassified (asks every time); vendored stdio connectors (Playwright, Chrome DevTools, Brave Search, MCP Fetch) stay deferred to a later batch, and non-DCR OAuth vendors (GitHub OAuth, Slack, Asana, HubSpot, Box, Google Workspace, Microsoft 365) remain blocked on pre-registered OAuth apps.
Next: open the Charter in the desktop window to check dual-auth connector panels (e.g., Composio, Stripe, Linear) and run a live OAuth sign-in on at least one dual-auth and one newly added connector.

## Phone floating pill shell · 2026-11-26 · built and checked in a phone-width browser; real phone pending

CHG-0761 in `0.2.10-Pre-Alpha`: the narrow window has a floating pill of three tabs (Chronicle, Quests, Chronicler), a Menu button in the top bar (Lore, Archive, Reserves, Settings), and the conversation's own composer in a quest (`narrowShell.tsx`, `phoneShell.ts`, `phonePill.tsx`, `menuScreen.tsx`, `pillScroll.ts`).
Next: the owner tries it on a phone (the pill's gap above the Android gesture or three-button bar, the collapse while scrolling, Back from a quest to the tab it came from) and decides whether the composer also needs a Back button, whether Rituals need a place on the phone, and whether a safe-area package is wanted. [Handoff](../.agents/handoffs/2026-11-26-1445-phone-floating-pill.md).

## Direct channels on the Android app · 2026-11-26 · built and run on an emulator; real phone pending

CHG-0754 in `0.2.9-Pre-Alpha`: the Android app loads `RTCPeerConnection` from `react-native-webrtc` at its first try and moves its link onto a direct channel like the web app (`phoneDirect.native.ts`, `directSettingsOfLoader`); the release build needs the R8 rule of `plugins/withWebRtcRules.js`. On an Android 36 emulator against a disposable host the host listed the phone as connected and direct, a quest and a message went through, and a restart resumed the direct channel. Not exercised: a real NAT or mobile network, the real phone, battery and memory. The phone's original "reads but cannot operate" symptom is not explained by this work.
Next: install a release-signed APK on the phone and check Workshop shows it as direct on home Wi-Fi and on mobile data; read the Cloudflare Metrics for `outlore`. [Handoff](../.agents/handoffs/2026-11-26-0900-android-direct-channel.md).

## Whole-codebase review and refactor · 2026-11-26 · wave 2 built, merged and re-reviewed; desktop check pending

CHG-0750 to CHG-0752 in `0.2.8-Pre-Alpha`: image flicker, panel islands including the standalone channel, quest-read broadcasts, spec fixes SPEC-03 to SPEC-06, the Reply starting-context warning, and the standards sweeps.
Wave 2 merged on `main` (`0.2.10-Pre-Alpha`): attachment byte caching (CHG-0757), scoped `Changed` topics and shared identical queries (CHG-0758), and cross-package boolean renames, cast removals, and `QuestTitle` memoization (CHG-0759).
Wave 2 merged on `main` (`0.2.10-Pre-Alpha`): 20 of 21 oversized service files outside `work/` split to <= 256 lines (CHG-0765; generated `core/priceSnapshot.ts` kept unsplit at 434 lines), and the standards re-review's findings addressed (CHG-0766: request sharing in its own module, the core types cycle broken, core imported through its index, `fieldOf` for caught errors' keys, the stale `imageCache` comment).
Both re-reviews passed on the merged tree: the standards axis (naming, JSDoc, one-way imports, sizes) and the specifications axis (attachment caching, `Changed`-topics compatibility, no wire or stored name broken, behavior-neutral splits); the pre-existing debt they recorded (the connectors parent-child ring, the relocated generic-result casts, grown `App.tsx` and `questListRows.tsx`) waits for the next pass.
Next: check the flicker, realm panel, and standalone-channel first quest in the desktop window, and decide Fresh or Resting for an empty errand (SPEC-07).

## Child reads parent on demand · 2026-11-25 · built and verified by tests; desktop check pending

CHG-0748 in `0.2.8-Pre-Alpha`: the opener's-messages snapshot is replaced by a line plus the `read_parent_messages` tool with FTS5 search (`parentMessages.ts`, migration 0079, `journal.ts`, `threadTools.ts`).
CHG-0749 adds the last 5 clipped opener messages on the first turn of an owner-opened errand (`opener_tail`, migration 0080).
Next: read the proof in `documentation/verification/2026-11-25-opener-tail-and-parent-search.md`, try it in the desktop window, and decide whether `read_parent_messages` should also reach further up than the direct parent.

## Reply opens the child thread · 2026-11-25 · built and tested; desktop window check pending

CHG-0746 in `0.2.8-Pre-Alpha`:
- A Reply opens an empty quest (Chronicler message) or an empty errand (quest message) at once and opens its pane; the bottom Reply box and the starter's reply banner are gone (`replies.ts`, `tree.ts`, `guildmaster.tsx`, `threadPane.tsx`).
- The first message of a quest or errand opened without a Reply is copied to its parent as conversation only and becomes its anchor (`copyOpeningToParent` in `questOrigins.ts`); this reverses CHG-0572 for empty quests.
Next: look at it in the desktop window (Reply in the Chronicle and in a quest, New quest then write, New errand then write, mobile layout), then record Delivery once accepted.

## Reply icon and owner message actions · 2026-11-25 · built and tested; desktop window check pending

CHG-0747 in `0.2.8-Pre-Alpha`: Reply is an icon beside Copy under an agent's reply; the owner's messages have a time line with Reply and Copy icons shown on hover (`messageActions.tsx`, `commentable.web.tsx`, `conversationEntries.tsx`).
Next: look at it in the desktop window, light and dark, then record Delivery once accepted.

## Agent reply first and the reply line without a box · 2026-11-25 · built and tested; desktop window check pending

CHG-0741 and CHG-0742 in `0.2.8-Pre-Alpha`:
- A thread with no anchor, or a dashboard-started quest whose opening message repeats its anchor, pins its own first message as the root, so the first reply is the agent's; the reply count includes the questions a thread asked the owner (`missionDetail.ts`, `exchangeSamples.ts`, `entries.ts`).
- The compact reply line under a message has no box and no "Open": it hangs from the message by an elbow and ends with a small quest or errand mark, with a hover fill that leaves the elbow alone (`replyLine.tsx`; option B of `documentation/art-direction/2026-11-25-reply-line.html`).
- CHG-0744: the reply line shows nothing instead of "No replies yet" and its elbow and text start at the card's left edge and text inset.
Next: look at all three in the desktop window, then record Delivery once accepted.

## Copy buttons and visible code blocks · 2026-11-25 · built and tested; desktop window check pending

CHG-0738 on `main` (commits `6279ea1b`, `172e98de`):
- An agent's reply has a Copy button at the right of the line under it, and each code block has one in its top right corner; both show a check mark for 1.5 seconds (`apps/app/src/ui/copyButton.tsx`).
- Code blocks and inline code sit on a veil of the text color (opacity 0.08) with a border, so they stand apart from the card in every theme.
Next: look at both in the desktop window across the themes (copy a reply, copy a code block, check the contrast), then record Delivery once accepted.

## Reply count and pinned thread root · 2026-11-25 · built and tested; desktop window check pending

CHG-0737 on `main` (merged from `mission/reply-count-and-thread-root-8f07963c`, commit `330cc8aa`):
- An errand counts every non-system message as a reply, so a 4-message errand reads "4 replies"; a thread with no anchor, or a dashboard-started quest whose opening message repeats its anchor, still drops its first message (`replyCountOf` in `exchangeSamples.ts`).
- `ThreadView.root` carries the thread's anchor message, drawn at the top of the errand and quest panes as a quiet read-only card followed by an "N replies" rule, as Slack does.
Next: desktop window review together with Batches 1 and 2, then record Delivery once accepted.

## Slack-like thread replies (Batch 2) · 2026-11-25 · built and tested; desktop window check pending

CHG-0736 on `main` (merged from `worktree/slack-like-replies`, commit `19b3c983`):
- Added `SendToParentScope` (`"MessageOnly"` | `"FullContext"`) on `SendMessage` and an unchecked-by-default **Also send to \<parent\>** checkbox with **This message** / **Full context** toggle under quest and errand composers; errands echo to and wake their parent quest, while quests echo conversation-only into their realm or Borderlands channel.
- Updated `report_result` to post one message that appears both as the errand's reply and directly in its parent quest (with optional `includeContext` on `report_result` and `send_thread_message`), deduplicating an identical final turn reply.
- Updated inactivity notices to post inside the quest and echo to its parent channel, and suppressed **Reply** on notices and parent-echoed thread replies while linking them to their originating quest or errand.
Next: desktop window review of Batches 1 and 2 (CHG-0735 and CHG-0736), then record Delivery once accepted.

## Slack-like thread replies (Batch 1) · 2026-11-25 · built and tested; desktop window check pending

CHG-0735 on `main` (merged from `worktree/slack-like-replies`, commit `167142e0`):
- In realm and Borderlands channels, `suggest_mission` with no matching quest directly opens the quest anchored to the owner's latest message using the channel's current Companion configuration (harness, account, model, effort, backups, and permission mode) with no second proposal bubble or confirmation card, and the channel pane auto-opens the new quest pane beside it; casual chat still receives an in-channel reply.
- Clicking **Reply** on a quest message directly opens the `ErrandStarter` third pane anchored to that message (inheriting the quest's Companion configuration and creating the errand on first send via `OpenThread.anchorMessageId`), and replying to an already-anchored message opens the existing quest or errand directly.
- Agent `open_thread` anchors a single errand directly to the triggering message with no extra brief bubble, and splits multiple errands targeting the same message into separate agent brief replies so none is asymmetrically tied to an umbrella prompt.
- In-feed reply lines use a compact one-line bar (state dot, reply count from `replyCount`, title, waiting/attention indicator, last activity time) while the **Quests** and **Errands** tabs keep the fuller cards.

## Price lookup for effort-suffixed model IDs · 2026-11-25 · built and tested

CHG-0729 on `mission/antigravity-vs-t3code-47229313`: `priceOf()` in `packages/service/src/core/prices.ts` falls back to stripping trailing effort suffixes (`-low`, `-medium`, `-high`, `-xhigh`, `-max`) and date+effort combinations after exact and undated lookups, while keeping exact matches first and returning `null` for unknown base models.
`packages/service/src/core/priceSnapshot.ts` is refreshed from `models.dev` via `bun run --filter @outlore/service prices:snapshot`, adding `gemini-4-neon` and `gemini-4-hydrogen` to the fallback snapshot.
Verified with `priceSources.test.ts`, `prices.test.ts`, Biome, and workspace typecheck; no live `agy` turn was run.

## One account isolation per harness · 2026-11-25 · built and tested against stand-ins; no provider turn or sign-in run

CHG-0728 (Batch 1 of the multi-account plan), branch `mission/antigravity-vs-t3code-5a344e2b`: every harness declares one `AccountIsolation` (`computerOnly` or `directory` with `envOf`), and the launch, sign-in command, sign-in read, model probe, plan limits and the Workshop's **+ Add account** derive from it.
ACP launches resolve per call from the definition and the thread's `configDirectory`; Antigravity keeps its pinned Gemini home through `pinnedHome` while it stays `computerOnly`.
No provider is newly enabled: the same six stay computer-only and the same six stay directory-based, and the Workshop shows "Uses this computer's sign-in only." instead of Add account on the six.
Next: Batches 2 to 4 in the [backlog](backlog.md), each behind a live check.

## Shared ACP launch hygiene · 2026-11-25 · built and tested against the stand-in; no live agy turn run

CHG-0727 on `mission/antigravity-vs-t3code-e08e3479`: adds three declarative, provider-agnostic launch-hygiene options to `AcpProviderDefinition` / `AcpProviderProtocol` (`minimumAgentVersion`, `hasIsolatedTempDir`, `scrubEnvPrefixes`), executed generically in `acpLaunch.ts`, `acpHarness.ts`, `acpProviders.ts`, and `core/lineProcess.ts`.
Antigravity enables `minimumAgentVersion: "1.5.0"`, `hasIsolatedTempDir: true`, and `scrubEnvPrefixes: ["GEMINI_", "GOOGLE_"]` (preserving `GEMINI_HOME` from `stateHome` and `AGY_CLI_DISABLE_AUTO_UPDATE` from `spawnEnv`).
`backlog.md` now records the owner's Google AI Developers forum topic URL for Antigravity ToS clarification (topic 205306) and marks launch hygiene as landed.
Verified with 92 tests across the ACP launch hygiene, protocol, provider definition, and Antigravity suites, plus Biome and workspace typecheck; no live `agy` turn was run.

## Antigravity steering and interrupt · 2026-11-25 · built and tested against the stand-in; live turn pending owner approval

CHG-0726 on `mission/antigravity-vs-t3code-4774eeeb`, base `953e98b9`: the shared ACP module reads `agentInfo.version` from `initialize` and adds `steersWithPromptFrom` (set to `"1.5.0"` on Antigravity only).
When `agy` reports `>= 1.5.0`, steering a running turn sends a second `session/prompt` instead of refusing, delivers the steered message to the pool, sums usage across the prompt flight, and keeps the last prompt's context reading; older versions, missing versions, and all other ACP harnesses stay unchanged.
Outlore's existing interrupt path already matches T3 Code's `cancelBehavior: "wait-for-prompt"` (sends `session/cancel`, waits up to `interruptGraceMillis` for the prompt to settle, keeps the process alive when confirmed, and closes it only on timeout).
Verified against the configurable ACP stand-in (`acpProtocol.test.ts` and related harness suites), Biome, and workspace typecheck.
No live Antigravity turn was run (personal Google quota and pending forum clarification); a live check requires owner approval for one signed-in `agy acp` turn to confirm mid-turn second-prompt steering and settled `session/cancel`.

## Antigravity plan limits and plan usage display · 2026-11-25 · data side and di

The owner chose display alternative C (CHG-0723, branch `mission/pull-main-and-choose-next-9eb450d2`, built on the CHG-0722 branch): the rings are gone (`editors/planLimitRings.tsx` removed); the rail shows each provider's logo with one status dot (`editors/planUsageDots.tsx`, `PlanUsageDots` in the sidebar) and the popup is a table grouped by model group with the share left and the time to reset, and "not started" for a limit with no reset time (`editors/planUsage.ts`, `planUsageOf`, tested in `planUsage.test.ts`). The accessibility text says "not started" too. **Built, not seen:** the window check is pending (the dot's size and place on the logo, the table's width in the rail card for four limits, Antigravity's two groups, a phone's tap, the light and dark themes), and the owner has accepted nothing. My choices to redirect: an all-unstarted provider's dot is green rather than grey; the dot sits at the logo's lower right with a ground-colored ring; rows inside a group are ordered by window length.

CHG-0722 on `mission/pull-main-and-choose-next-79f32477`, base `a8416f70`: `readPlanLimits` on the Antigravity adapter runs the CLI's own `agy --print "/usage" ...` (zero tokens, no token file), and the report's new optional `label` names the four limits "Gemini Models · 5-hour" and so on. Tests pass against the stand-in; the live app has not shown them. The display choice and its build are described above.

## Idle host traffic per connected screen · 2026-11-25 · on `main` in 0.2.6; byte loop re-verified, live page measurement pending

CHG-0719 on `mission/relay-outage-and-p2p-6f3be08b`, base `c8bc9f5d`: a connected screen cost the host about 4.4 MB/s over UDP and 1 MB/s on the desktop's loopback link while idle. Both suspected causes were reproduced by `idleTraffic.test.ts` and fixed in `Sessions`. A 6,000-character reply in 3-character deltas sent 2,002 `Draft` frames and 6,155,152 bytes; it now sends 40 frames and about 9,600 bytes (only the new text with its `offset`, at most ten frames a second per thread, the whole text for a screen that joins mid-reply and every fiftieth frame). 50 commits sent 50 `Changed` frames; they now send 2 (first at once, then one per 250 ms window with the latest sequence). Not measured: the effect on the live relay's request count, the phone app, and what each refetch costs by query (a refetch still returns a query's whole result; refetching only the queries a change affects is not built). [Handoff](../.agents/handoffs/2026-11-25-0800-idle-host-traffic.md).

Re-checked on `a8416f70` (CHG-0724, [verification](verification/2026-11-25-idle-host-traffic.md)): the byte loop passes (41 `Draft` frames and 9,653 bytes; 2 `Changed` frames for 50 commits). The installed 0.2.6 app holds the relay link flat and has no direct socket without a page, but its loopback link to the desktop window still carries about 0.9 MB/s while four agents work. Each `Changed` frame makes every mounted call site refetch (`ReadSettings` from up to 12 sites, `ReadChronicle` 18 KB with 30 quests), about 120 KB with all mounted. Recommended next, not built: share one request between identical queries in `ServiceClient`, measure again, and scope `Changed` only if needed. Open for the owner: a page-connected live measurement and the Cloudflare graph for 2026-11-24; the steps are in the record.

## Architecture audit · 2026-11-24 · all landed except P3, P4 and the rest of P5

Fifteen deepening candidates for the harness roster, the shell and panes, and the service's work modules are in the [report](architecture-audit/architecture-audit-2026-11-24-0731.html). What landed, by candidate and change:
- Shell and panes: P1, P2 and the P5 chevron (CHG-0690).
- Harness roster: H1 (CHG-0697 fixed the budget card that labelled nine harnesses "OpenCode", and CHG-0704 derived the closed lists from one harness definition), H3 (CHG-0691, the missing tool server on six ACP harnesses), H4 (CHG-0706), H5 (CHG-0707), and H2, the one ACP module: Vibe and the generic providers in CHG-0708 (with CHG-0709 and CHG-0710 for unknown usage and context readings) and OpenCode and Antigravity's system prompt in CHG-0725.
- Service: S1 (CHG-0693, the settings-authority table), S2 (CHG-0695), S3 (CHG-0692, the inactivity-days setting and its question deleted), S4 (CHG-0696), S5 (CHG-0694) and S6 (CHG-0698).
Still open: P3 (island frame and layout editing), P4 (window composition) and the rest of P5 (sidebar row anatomy), all in the [backlog](backlog.md), and two H2 leftovers in it: `SSH_CONNECTION` for Antigravity CLI 1.5, which stays undecided until a signed-in live check can prove it, and whether OpenCode's tool calls should show as events.
OpenCode through the ACP module (CHG-0725, `mission/pull-main-and-choose-next-af907065`): no live OpenCode turn or live Antigravity turn was run, and a real OpenCode inside Seatbelt has not been checked. [Verification](verification/2026-11-25-opencode-through-the-acp-module.md). [Handoff](../.agents/handoffs/2026-11-24-0738-architecture-audit.md).

## Two child controls on conversation panes · 2026-11-24

The owner approved a create notch and a same-pane list notch on the right edge, with the most urgent active child shown on the list notch.
Starting revision: `a4a4fec1`.
The focused child notch, pane notch, and Ritual row tests pass (20 tests), and Biome passes with two existing architecture audit warnings.
Desktop visual review is pending.
[Behavior](capabilities/conversation-panes/specifications.md#panes).

## The Vault's read-denial check runs by itself · 2026-11-23 · on `mission/vault-sandbox-check-without-owner-steps-910f3d35`

CHG-0657: Claude Code's denial is probed at start through `@anthropic-ai/sandbox-runtime` (new pinned dependency), each probe writes its own marker (the shared name made Codex read "The marker could not be read outside the sandbox"), and a service inside a sandbox says so. The card has no Verify button; the live stamp is optional. ADR 0022 is amended and awaits the owner's confirmation. Open: the probe proves the library, not the installed Claude Code's copy; the bundle inside Electron's `utilityProcess` and Linux/Windows were not run. [Verification](verification/2026-11-23-vault-denial-automatic.md).

## OpenBot provider parity

CHG-0651 through CHG-0655 deliver eight provider harnesses alongside the original four. The full suite on provider tip `96e0103a` passed with 2,848 tests and 24 skips. Authenticated turns, permission behavior against installed binaries, and the remaining provider and connector scope are tracked in the [handoff](../.agents/handoffs/2026-11-23-0043-openbot-providers.md).

## Mobile feature parity

The owner requested desktop functionality on mobile. Initial source review at `7026ce87` found that narrow screens bypass the shared realm channel and hide the Chronicle entry. The native terminal panel is a stub, and the desktop terminal starts in Electron. Mobile dictation and broader phone layout checks also remain open.

The owner approved opening the shared realm and Borderlands channels from the phone menu and asked for phone-sized controls and common quest actions. Implementation is on `worktree/mobile-parity`, starting at `7026ce87`. The channel has a Back chevron and a swipeable tab row. Opening a quest from a channel preserves the channel and its tab on return. Mark done, reopen, and archive are available in the Quests tab and the quest header. See [phone navigation](capabilities/conversation-panes/specifications.md#phone-channels).

Verification on 2026-11-22: workspace lint and typecheck passed, as did the Android and web Expo exports. `CI=1 bun run test apps/app/test` passed with 710 tests and 6 skips. The full run had 2,715 passes, 64 skips, and one QuickJS memory-limit test that timed out. All 14 tests in `packages/service/test/connectors/codeExecutor.test.ts` passed on an isolated rerun. ADB found no Android device. The browser check was blocked by Aside's local keychain authentication and the absence of a Playwright Chromium installation.

Batch 2 (2026-11-22), from Claude Duet's lead ([research](research/claude-duet-2026-11-22.md)): the Chronicle is on the phone. The menu's first row opens it with the unread badge, the narrow top bar's menu button carries the same count from every phone screen, and Back in a quest or errand opened from the Chronicle returns to the Chronicle — the batch-1 channel return generalized to a quest origin (`questReturn` in the location). The Attention filters wrap on a narrow screen. [CHG-0647](changelog/0.2.2-Pre-Alpha.md); checks: the 19 location tests, Biome, the workspace typecheck, the app suite (712 passed, 6 skips), and the web export.

Paired Android acceptance remains open. In a test realm and the Borderlands, open each channel tab, follow a linked Missive to its quest, and press Back to confirm the selected tab is retained. Mark an idle quest done and reopen it from the list and header. Archive a quest and check the confirmation when it has active work. Open the Chronicle from the menu, follow an unread request into its quest or errand, answer it, and press Back to return to the Chronicle; check that the menu button's badge clears with the read. On desktop, repeat the channel and quest open with the multi-pane layout.

Later batches cover the Workshop at phone width, dictation, and device integrations. Remote terminals have a separate host-side dependency under [ADR 0020](architecture-decision-record/0020-terminals-run-in-the-host.md).

## Terminals from a paired device · 2026-11-22 · built; live host check pending

CHG-0644 is implemented on `worktree/remote-terminals`, base `7026ce87`: the conversation shells run in the host service (ADR 0020) and every screen reaches them through the same requests. The host's own window opens the full login shell; a paired device — a browser, another computer's app — opens one only while the host's off-by-default **Allow terminals from paired devices** switch is on (Workshop's Remote access card, host window only), inside the OS sandbox, writing only in its conversation's folder and the terminals' own temporary folder, with the Vault hidden and no loopback token inherited. The desktop's terminal IPC is gone; the packaged launch gate drives the packaged service. Checks and the open items are in the [verification record](verification/2026-11-22-remote-terminals.md). Not seen live: a paired browser against a running host, the real Seatbelt/bwrap fence (the tests use a stand-in wrapper over the shared profile), and the desktop window through the new path. The fenced shell's reads follow the harness sandbox — everything readable except the Vault — the workable reading of ADR 0020's stricter fence, which the owner kept on committing. The native phone app keeps no terminal surface yet.

## Ritual form and tabs · 2026-11-23 · window check pending

Worktree branch `worktree/ritual-menu-placement`, starting at `ad4740b9`.
CHG-0660 reveals the middle-panel form when a floating sidebar or a narrow quest details panel was open.
The form and the saved Ritual's Companions tab use the regular selector, and narrow windows share the Ritual's desktop tabs.
Biome, workspace typecheck, and 40 focused Ritual and location tests passed.
On a wide and narrow window, open **+ Ritual**, **Schedule as a Ritual**, and **Edit**, then check Back restores the previous view.
In a saved Ritual, check that Errands opens a run, Missives shows run history, and saving a primary or fallback Companion affects the next run.
Updating the Ritual from a Missive remains an open design decision.

## Chronicle source labels · 2026-11-22 · window check pending

CHG-0641 shows **Quest**, **Errand**, or **Realm** before each Chronicle source title in Attention and History. The service derives the type from the thread tree, an older paired host shows no label, long titles wrap, and screen readers speak the type. Biome, the seven-workspace typecheck, and the full suite (2,713 passed, 68 skipped) are green on the base; the rebased tip re-passed Biome, typecheck, and the focused Chronicle tests. The window check is pending; see the [current handoff](../.agents/handoffs/2026-11-22-2206-chronicle-source-labels.md).

## New realm sources · 2026-11-22 · window review pending

CHG-0645 adds five sources to the sidebar's **Visit a new realm** dialog. The worktree branch `mission/outlore-next-batch-0b321042` is rebased onto `mission/outlore-next-batch-3e6266c7` (CHG-0642); the original base was `7026ce87` on `main`. Review the chooser and the folder picker in a desktop window and on a paired device. [Verification](verification/2026-11-22-new-realm-sources.md)

## Daily background check-ins · 2026-11-22 · settings and day admission landed; host wiring pending

Starting revision `f5e50adb` on `worktree/background-check-ins`. The owner authorized implementation of the [CHG-0633 agreement](capabilities/background-check-ins/specifications.md). The settings requests now save selected realms, local time, Companion, and any explicitly chosen fallback. Pausing keeps the selection. The service test went red before the settings field existed and now passes, including a full settings save by an older client.

The host admission operation reuses Rituals' local-time calculation and claims the local calendar day in storage before calling a reviewer. A controlled-clock test covers paused settings, concurrent sweeps, same-day schedule edits, and a Companion change. A host that first sweeps after the scheduled time can still claim that day. A failed or interrupted attempt consumes the day, so the host does not repeat inference on every sweep.

The workspace typecheck, Biome, and the full suite passed on the admission slice. The suite recorded 2,715 passes and 64 skips. The connector memory-limit test passed on retry.

The settings and admission slices are landed on `main` (CHG-0640). Host wiring, the Workshop, and linked Missives are pending. The [Companion research](research/background-check-in-companion-2026-11-22.md) identifies OpenCode's stateless text endpoint with an owner-installed local runtime as the strongest candidate. The loopback mock and effective configuration isolation are unverified. Publication should verify the selected realm, quest link, reportable change, and absence of duplicate Missives through the same conversation request as inactivity warnings.

## Inactivity warnings in realm Missives · 2026-11-22 · window check pending

CHG-0639 is implemented and reviewed on `worktree/inactivity-missives`, based on `891c972f`. Outlore posts linked notices to realm Missives at the four-hour Attention and twelve-hour Resting thresholds. The scheduled service and app feed checks passed. Open a notice in the desktop window and from a paired device to check its presentation and quest navigation. [Verification](verification/2026-11-22-inactivity-missives.md)

## Errand draft's Companions footer · 2026-11-22 · window check pending

CHG-0631 gives a new errand's Companions tab its own compact model-and-effort picker at the pane's foot (selected, as a saved errand's pane) and the compact picker names a Default effort. CHG-0632 makes the Vault live-probe fixture read backtick-quoted paths, so the seven probe tests pass where the sandbox's temp folder has a space. Biome, the workspace typecheck, and the full suite (2,703 passed, 68 skipped) are green. The window check is pending: the picker in both tabs of the draft, its selected look, and the effort named at Default.

## Quest chevrons and sidebar limits · 2026-11-22 · window check pending

CHG-0635 keeps the fold chevron visible on quests with errands. CHG-0636 previews four quests per realm and in the Borderlands, and two unfolded errand rows per quest. When more errand rows are available, **Show N errands** opens the quest's Errands tab. The desktop window check is pending. See the [overflow verification record](verification/2026-11-22-sidebar-overflow.md).

## Notch titles on hover · 2026-11-22 · window check pending

CHG-0630: hovering or keyboard-focusing a pane notch shows its title in a small card beside the notch — folded panes and child shortcuts alike — so quests and errands that share one icon are told apart without opening them. Biome, the workspace typecheck, and the app suite (704 passed) are green; see the [verification record](verification/2026-11-22-notch-titles.md). The window check is pending: the card's look on both edges, a stack of several notches, long titles, and keyboard focus. Found beside the work: the `tooltipOf` helper never showed a tooltip (backlog).
## Quest and errand tab actions · 2026-11-22 · window check pending

CHG-0637 is on `worktree/quest-tab-actions`. Check that the archive box, trash icon for empty quests, and done checkbox work from their cards without opening the card. Check the running-quest confirmation in the Quests tab and the empty-quest trash icon in both header layouts.

## Codex Full access prompts · 2026-11-22 · live check pending

Outlore now directs Codex to use its own per-command escalation when Full access is active. In a live Codex turn, retry a harmless local command blocked by the sandbox and check that Permissions history records an automatic approval. The original prompt came from Codex calling Outlore's direct approval tool.

## Ritual tabs and manual runs · 2026-11-22 · window check pending

CHG-0638 adds a Rituals tab to realms and the Borderlands, a Ritual details tab in each Ritual, and a Run now button in the header. The desktop and phone layouts still need a visual pass. In a test realm, open a Ritual with its schedule off, run it from the header, and check that its history shows the new run.

## Sidebar Ritual divider · 2026-11-22 · window check pending

The sidebar groups visible Rituals below visible quests in each realm and in the Borderlands. Check the divider spacing in the desktop window.

## Pane header controls · 2026-11-21 · window check pending

The Expand pane button uses outward arrows and appears when multiple conversation panes are visible. A full-width pane has no layout buttons. Its edge notches reopen the other conversations. Check the icon and header spacing in the desktop window.

## Sidebar errands · 2026-11-21 · window check pending

CHG-0620 restores the errand tree on desktop and opens the Quests and Errands tabs from the sidebar. See the [verification record](verification/2026-11-21-sidebar-errands.md).

CHG-0635 makes quest chevrons visible at rest on `worktree/quest-fold`, based on `04cc66ee`. In the desktop window, check that a collapsed quest with errands shows its chevron with the pointer away, the chevron toggles the errands, and a quest without errands has an empty chevron slot.

## Rituals as realm entities · 2026-11-21 · built; window check and the owner's look pending

The entity model of CHG-0616 is implemented and delivered in three commits (CHG-0619: the specifications pass, the service core, and the app UI) plus the app-guide alignment: runs as persisted errands beneath the Ritual, service-made trigger and result lines, one run at a time, savepoint starts, fallbacks on the run errand, `ListMissions.includeRituals`, `CreateRitual.originMissionId`, whole-tree `DeleteRitual` (ritual rows beside the realm's quests, the Rituals place removed, controls and the origin link in the Ritual's panel, the composer hidden, Schedule as a Ritual on a quest's panel, + Ritual on a realm header). Checks and coverage: [verification](verification/2026-11-21-rituals-as-realm-entities.md); the full suite was green at each commit (2734 passed, 24 skipped at the end). Migration: `0073_ritual_origin_mission` (0071 and 0072 are the permission modes').

Still open:
- The desktop window pass and the owner's judgment of the look: the ritual row among the quests (moon, schedule, under-way dot, dimmed off), the + Ritual button on a realm header, opening a Ritual (no composer; the Errands tab lists its runs), the panel's controls and "Made from" origin link, Schedule as a Ritual from a quest's panel, the delete confirmation, phone-narrow.
- A live-harness scheduled run (the fake harness covers the seams; the old model's note said the same).
- Review points the owner should see: rituals of an archived realm are invisible until the realm is restored (the notice is on the panel); a realm tied to no folder cannot receive a directly created Ritual (pre-existing form limitation); the muted no-message-box line.

## Architecture audit follow-through · 2026-11-21 · window check pending

The owner approved the relevant findings from the 2026-11-21 audit. The work is on `worktree/audit-follow-through`, based on `eaf8fb69`. The automated checks and the blocked Electron launch are recorded in [verification](verification/2026-11-21-architecture-follow-through.md). The desktop window still needs a pass through pane folding and resizing, narrow and wide sidebars, Workshop return, and opening Chronicle entries.

## One permission vocabulary in the Workshop and the composer · 2026-11-21 · window check pending

CHG-0617 replaces the Workshop's two approval levels and its sandbox-escape toggle with the four permission modes (Supervised, Auto-accept edits, Auto, Full access) as the default every thread without its own mode runs with; the composer's Default permissions names the chosen default. Full access also covers leaving the sandbox, and Outlore's own approvals still ask. Store migrations 0071 and 0072 translate saved choices and snapshot the mode a turn is admitted with. Amended the same day on the owner's ask: the selector shows for quests and errands alike, in the host window and on a paired phone (the mode request left the host-only list), and a mode changes at any time like the runner — the running turn finishes on the mode it was admitted with and the next turn applies the change. Service checks cover the folded escape, the mode-derived sandbox behavior, the migration, and the in-turn change (red first); a window check, the phone composer, and a live harness turn are pending.

## Fold the channel pane when a quest opens · 2026-11-21 · window check pending

CHG-0613: a quest opened from the sidebar starts with only its own conversation pane open, the realm's channel pane folded behind its notch. Pressing the notch reveals the channel, and the folds hold for the rest of the quest. Biome, the app typecheck, and the app suite (681 passed) are green in the [original verification](verification/2026-11-21-fold-channel-on-quest-open.md). The window check is pending.

## Thread permission modes · 2026-11-21 · window check pending

CHG-0612 adds the host composer's four permission modes on `worktree/thread-permissions`, starting at `42449116`. The owner approved implementation after the T3 Code comparison. Service checks exercise the mode change through the host request and the permission response through the harness. The Vibe check uses an ACP stand-in. Biome, the workspace typecheck, the desktop build and the Expo web export passed. The full suite finished with 2,665 passed and 64 skipped. Chromium could not launch in the verification environment because macOS denied its Mach service registration. A live Vibe turn and the composer in a window remain unchecked.

## Pane status and errand controls · 2026-11-20 · review pending

CHG-0605 records the current pane and status changes, errand reopening and Stop behavior. Focused checks passed during implementation; the errand reopen service test and full suite have not been run, and the final desktop behavior needs review. See the [handoff](../.agents/handoffs/2026-11-20-1844-pane-status-follow-up.md).

## Turns woken by a background command · 2026-11-20 · live check pending

CHG-0595 runs what Claude Code does after a background command ends as a turn, on `worktree/resume-after-background`.
Fixes replies that were never logged and commands refused with "This thread is not at work". The new tests pass with stand-in harnesses; a real long-running command in the app is unchecked. [Verification](verification/2026-11-20-background-wake-turns.md)

## File diffs across harnesses · 2026-11-20 · live checks pending

CHG-0593 adds Steps diffs for completed file edits reported by Codex, OpenCode, and Vibe.
The 26 focused tests passed with stand-in harnesses, and live harness turns remain unverified. [Verification](verification/2026-11-20-cross-harness-file-diffs.md)

## Pane notches · 2026-11-20 · window review pending

CHG-0592 replaces folded strips with centered icon notches (realm, quest, errand, with the state dot) on the open pane's edge. Checks pass; not seen in a window. [Handoff](../.agents/handoffs/2026-11-20-1345-pane-notches.md)

## In-pane Quest and Companions tabs · 2026-11-20 · checks pass, window review pending

CHG-0591 is committed and rebased onto the pane notches (CHG-0592) on `main`.
Biome, the workspace typecheck, and the app, channel, contracts, and controller test suites passed on 2026-11-20; see the [verification note](verification/2026-11-20-in-pane-details.md).
Still unchecked in a desktop window: Companion editing in each pane, preserved drafts, and opening and closing a pane's Journal, Lore, and Budget independently.

## Desktop sidebar refresh · 2026-11-20 · window review pending

CHG-0587 aligns the sidebar with the conversation panes and starts empty realms closed.
The changes are on `worktree/sidebar-refresh` for desktop review.
Biome, workspace typecheck, and the 141 shell tests passed.

## Missives, reply-line samples, the realm's Quests tab, the Chronicle's Activity layout · 2026-11-20 · built and tested, the owner's look pending

CHG-0571 (window review pending): a quest's Messages tab is **Missives**; a reply line and each quest in a realm's **Quests** tab is a block quoting the last exchange (the owner's latest message and the companion's latest reply, 160 characters each), read by the service as `lastExchange` on the summaries; a channel has Missives and Quests tabs in its own pane; the Chronicle's original Activity list was superseded by CHG-0586. Checks: typecheck, Biome, the new `exchangeSamples` test (3), the app's tests (651) and the full suite (2,530 passed; 28 sandbox `git init` failures). Not seen in a window or on a phone. The decisions and the open questions are in the [changelog](changelog/0.2.0-Pre-Alpha.md), CHG-0571; the [verification](verification/2026-11-20-missives-samples-quests-tab.md) lists what was run. [Handoff](../.agents/handoffs/2026-11-20-0908-missives-realm-panes-review.md)

## Conversation panes · 2026-11-20 · desktop revision

The desktop build (CHG-0565 to CHG-0567) is integrated on `main`; CHG-0570 repairs a development store that left the panes blank. The [verification note](verification/2026-11-19-conversation-panes.md) records the automated checks and the blocked window check. The [Chronicle follow-up](capabilities/conversation-panes/specifications.md#main-conversations-and-channels) adds an unread badge, filters, direct links, and History (CHG-0569). Its first slice is built (CHG-0586): the Chronicle screen reads as two views — **Needs attention** (failures first, then requests, latest first, counted on its tab) and **History** (routine events grouped under Today, Yesterday and the months), entries as cards or quiet lines, empty and failing states said in words; checks pass (Biome, typecheck, full suite), the owner's look in a window pending. Still open from CHG-0569: the sidebar's unread badge, the Unread filter, and clearing an approval's unread when read (the service has no read record yet). Phone navigation and pane identity are deferred. See the [handoff](../.agents/handoffs/2026-11-20-0847-conversation-panes-blank-panel-fix.md).


## Connector Charter controls · 2026-11-19 · built on the Charter errand branch; review pending

CHG-0543 adds the connector catalog, Vault and placement controls on `mission/connectors-composio-and-apple-apps-2aaf91f7`. The tool approval question grants Always allow and Permissions manages it; CHG-0544 adds the thread panel's connector tools line from cached server listings. No window or phone look, real Composio, real macOS permission prompt or live Claude denial check was made. See the [verification](verification/2026-11-19-connector-charter.md) and [handoff](../.agents/handoffs/2026-11-19-1755-connector-review-fixes.md).

CHG-0545 addresses four independent review findings in the same branch: listing metadata redaction, serialized startup, cleanup on interrupted or failed initialization, and bounded incremental SSE. [Verification](verification/2026-11-19-connector-review-fixes.md). Integration and live checks remain open.

CHG-0546 adds per-app Apple access checks and revocation handling. The host requires a fresh check after restart and paired devices can see the latest result. [Verification](verification/2026-11-19-apple-permission-readiness.md) · [Handoff](../.agents/handoffs/2026-11-19-1810-apple-permission-readiness.md).

CHG-0547 fixes the security review's three findings: redirects never followed so a connector's key header cannot reach another origin, a Grep or Glob that would walk into the Vault's folder from above refused, and the denial probes asked afresh at every protection read so a harness installed or upgraded after an earlier probe counts at once. [Verification](verification/2026-11-19-connector-security-review.md) · [Handoff](../.agents/handoffs/2026-11-19-1915-connector-security-review.md). Integration and live checks remain open.

CHG-0548 refactors the connector branch after a standards and specification review (uncommitted when written). Open and not refactored: files this branch grew past the 256-line soft limit (`service.ts` 349, `core/execution.ts` 326, `work/threads.ts` 332, `packages/contracts/src/records.ts` 504 of the 512 hard limit, `apps/app` `questPanel.tsx` 432, `conversation.tsx` 387, `settings.tsx` 264, `ui/controls.tsx` 264, `connectors/backends/stdioMcp.ts` 266); the live checks listed above.

## Choice questions as chat bubbles · 2026-11-19 · built and tested on `mission/diff-view-for-modified-files-c8b345f5`, not merged; the owner's look pending

CHG-0535: a settled choice question (Answered, Skipped, Withdrawn) is no step in a turn's list; the conversation shows one agent bubble per choice, in order, with the owner's answer attached (chosen options filled, the others faded, own words as a chip, a foot line with the outcome, time and device). The call's own "Use AskUserQuestion" step is gone, rows stored earlier hidden. A waiting question keeps its card. Checks: Biome, typecheck, the app's tests (568 passed) and the service's activities and Claude Code tests; not seen in a window or on a phone. Overlaps the diff errand's files only in `entries.ts` (one condition in `isFoldedAction`) and `conversationEntries.tsx` (the `Question` branch of `EntryView`). [Handoff](../.agents/handoffs/2026-11-19-1610-choice-question-bubbles.md) · [Changelog](changelog/0.1.12-Prototype.md), CHG-0535

## A modified file's diff in its step · 2026-11-19 · built and tested on `mission/diff-view-for-modified-files-9978e8a0`, not merged; the owner's look and a live Claude Code check pending

CHG-0531: a call that modifies a file (Claude Code's Edit, MultiEdit, a whole-file Write) keeps its line in the turn's steps with `+added −removed` and unfolds to a unified diff, read on demand through `ReadFileDiff`; only the diff is stored (64 KB per file, cut with a note, deleted with the thread, never sent to a harness). A Write's previous text is read in memory before the write; if the file already holds the text written, the step says the previous text is not known. Checks: Biome and typecheck clean; full suite 2,192 passed, 55 skipped, 28 sandbox-only failures; seen in a throwaway window, wide and at 390 px, light look only. Open: the owner's look in a window and on a phone, the dark and other looks, a live Claude Code (the Write race, and Claude Code's `tool_use_result` as a race-free source), a diff on an allowed action's line, a failed call still showing its diff, Codex, OpenCode and Vibe, a per-thread size cap. [Handoff](../.agents/handoffs/2026-11-19-1615-file-diff-in-steps.md) · [Verification](verification/2026-11-19-file-diff.md) · [Changelog](changelog/0.1.12-Prototype.md), CHG-0531

## Nested corner marks in the sidebar · 2026-11-19 · released in 0.1.11; the nested look built, tested, on `main` once committed; the owner's look pending

CHG-0530: a quest or errand row nests lower-left corner marks sized by what it waits for — 25% grey (the owner's turn), 50% amber (a summons), 75% red (a failed state) — in one shared `corner` style (`shell/railStyles.ts`), sized per mark and drawn largest first (`shell/railRows.tsx`, `cornersOf` in `shell/railQuests.tsx`); it replaces CHG-0524's 50/75 ring and turn mark. The errand guide's first level now runs along the quest's left border, deeper levels along the errand's border line, so nested branch lines stack on one line. Checks: Biome clean on the touched files, `bun run typecheck` passes, the app's tests pass (78 files, 556 tests, 6 skipped); not seen in a window or on a phone. [Handoff](../.agents/handoffs/2026-11-19-0940-nested-corner-marks.md) · [Changelog](changelog/0.1.12-Prototype.md), CHG-0530

## Connectors: the four branches merged into one · 2026-11-19 · built and tested on `mission/connectors-composio-and-apple-apps-cd1b5543` (from `main` 8d4b767), not merged into `main`; the owner's approval pending

CHG-0542: the Vault and read-denial probes, the gateway, the Vault join, the Streamable-HTTP backend with Composio's tools and the stdio backend with the Apple apps are one branch, their changelog entries renumbered CHG-0536 to CHG-0541 (the corner-marks entry already held CHG-0530 on `main`). One `connectorBackendsLayer` (`connectors/backends/defaultBackends.ts`) opens `httpMcp` for an Http entry and `stdioMcp` for a Stdio entry; the service supplies the real Vault unless a test hands one in. A new test, `test/connectors/defaultWiring.test.ts`, runs the service on that default wiring: the real Vault on a temporary folder (an in-memory key holder, a disposable secret), a real local fake of a Connect endpoint and the stand-in MCP server process, one connector of each kind, proving a turn lists both and a call reaches each, the key reaching only the HTTP server. Not built: the Charter screens and a read of a realm's or quest's current choice. Not checked: the real Composio server, the real macOS Automation prompt, a live Claude Code denial probe (`OUTLORE_LIVE_CLAUDE_PROBE=1`), a real Keychain, a phone. [Handoff](../.agents/handoffs/2026-11-19-1630-connectors-merged.md) · [Verification](verification/2026-11-19-connectors-merge.md) · [Changelog](changelog/0.1.12-Prototype.md), CHG-0542

## Connectors: the Vault joined to the gateway, its requests and the denial stamp · 2026-11-19 · built and tested on fakes, on `mission/connectors-composio-and-apple-apps-02a36299` (the merged Vault and gateway branches), since merged with the two backends into `mission/connectors-composio-and-apple-apps-cd1b5543`; the owner's review pending

CHG-0539 (blueprint steps 2 and 3 merged, after CHG-0536 to CHG-0538): the real Vault behind the gateway's `VaultPort` from the one service instance (`work/vaultWiring.ts`, supplied as `connectorVault` in place of the empty stand-in); the owner requests `ReadVault`, `PutSecret`, `ReplaceSecret` (which clears Needs connecting), `RemoveSecret` and `VerifyClaudeVaultDenial`, with the secret wrapped as `Redacted` end to end (the app's client now encodes frames through `ClientFrameJson`); and the Claude Code denial stamp in the Vault's folder, keyed to the version and a hash of the sandbox settings, written by the owner-run live probe and read at start, with the stricter rule (a secret is stored only while every installed harness's denial is verified) applied through `Vault.refreshDenials` after a verified probe. Proved on fakes: a fake key holder, a stand-in `claude` for the live probe, the fake harness; a stored secret appears in no file of the service nor in any plain rendering. Not built: the real HTTP and stdio backends and the Apple tool names (step 4), the macOS permission's request, every screen (step 5). Not checked: a real live Claude Code turn (the opt-in `OUTLORE_LIVE_CLAUDE_PROBE=1` test), a real Keychain, a real server, a phone. [Verification](verification/2026-11-19-vault-gateway-join.md).

## Streamable-HTTP MCP backend and Composio's tools · 2026-11-19 · built and tested on a real local fake server, on `mission/connectors-composio-and-apple-apps-2f728664`, merged into `mission/connectors-composio-and-apple-apps-cd1b5543`; the owner's review and first real Composio run pending

CHG-0540 (blueprint step 4, first half), built on merged branch `mission/connectors-composio-and-apple-apps-5906083b`: `backends/httpMcp.ts` (stateless Streamable HTTP, one POST per request, the Vault's key in the entry's header, redaction, fixed failure words, interruption aborting the request, the usual four classes), `connectorBackendsLayer` as the service's default backends, and the Composio entry's seven published meta-tools: two pure discovery tools `Read`, five that act `Write`. Proved against a real local fake of Composio's Connect endpoint, six tests of the adapter and four through the whole gateway (the read retried once and the write never over real HTTP; a switch stopping a real request, the server seeing the client give up). Not built by this half: the stdio backend and the Apple tool names (the other errand), the Vault, the Vault's and the macOS permission's requests, every screen. Not checked: the real Composio server, whether its endpoint answers a stateless `tools/list` (no key was held; the fallback is one `initialize` at open). The decisions are in the changelog entry. [Verification](verification/2026-11-19-http-mcp-composio.md) · [Research](research/composio-mcp-2026-11-19.md) · [Handoff](../.agents/handoffs/2026-11-19-1205-http-mcp-composio.md)

## Stdio MCP backend and Apple apps · 2026-11-19 · built and tested, on `mission/connectors-composio-and-apple-apps-74a0ea1f`, merged into `mission/connectors-composio-and-apple-apps-cd1b5543`; the owner's review pending

CHG-0541 (blueprint step 4, second half), on top of the merged gateway branch: the line-RPC transport and the generic process-tree helpers moved down to `core/`; `connectors/backends/stdioMcp.ts` runs a connector's MCP server as a child of the host (started on first use, closed when idle, restarted on failure, no secret, reduced environment), proved over a real stand-in server process; `mcp-icloud@2.1.4` (MIT) is vendored as `packages/service/vendor/mcp-icloud.cjs` and run by a system Node, with the desktop app shipping the vendor folder as a resource (`OUTLORE_VENDOR_DIR`); the Apple catalog entry names all 41 tools of the pinned version's real `tools/list` (recorded fixture, pinning test, opt-in live test) with their app and Read/Write class; `applePermission.ts` plus the host-only `RequestApplePermission` request ask macOS through the connector's own child. Not built: the HTTP backend and Composio (the other half of step 4, another errand), the Vault and its requests (another errand), every screen; the real macOS permission prompt is unverified (Apple Events are blocked in a sandbox) — the owner runs it on their Mac, command in the verification note. [Verification](verification/2026-11-19-stdio-apple-backend.md).

## Connector gateway on a fake backend · 2026-11-19 · built and tested on fakes, on `mission/connectors-composio-and-apple-apps-5906083b`, merged into `mission/connectors-composio-and-apple-apps-cd1b5543`; the owner's review pending

CHG-0538 (blueprint step 3): the catalog (Composio, Apple apps), migration `0062_connectors`, pure availability, the gateway (listing, calls, asking through `Approvals.askToolUse` and the new capability `useConnectorTool`, per-turn snapshots, stopping at once, error classes, secret redaction, removal in three steps), the owner's requests, and the wiring into the tool server and the harnesses. Proved on a scripted fake backend and the fake harness under the three harness names. Not built: the real HTTP and stdio backends and the Apple tool names (step 4), the Vault (a port holding nothing stands in), the Vault's and the macOS permission's requests, every screen. Until the backends exist an installed connector offers no tool. The departures from the blueprint are in the changelog entry. [Verification](verification/2026-11-19-connector-gateway.md).

## Date beside the time in agent replies · 2026-11-19 · built and tested, on `main` once committed; the owner's look pending

An agent reply's header shows the date and the time (`19 Nov 2026 · 11:15 AM`), through `stampOf` in `apps/app/src/foundation/formatting.ts`. Owner messages still show no time, so no date. Checks: formatting and conversation tests pass (58), Biome clean on the touched files; not seen in a window or on a phone. [Handoff](../.agents/handoffs/2026-11-19-0724-message-date.md)

## Updating a host from a paired device · 2026-11-18 · on `main`; a phone and a packaged macOS update pending

CHG-0517 (agreement) and CHG-0518 (delivery): a device of a later release offers **Update host**, the host installs once no turn is running, restarts, and the device reconnects with its stored pairing. A host from before this feature must be updated by hand once. Open: the owner's merge, a phone one release ahead of a packaged macOS host, and the look of the banner. [Specification](capabilities/app-updates/specifications.md#updating-a-host-from-a-paired-device) · [Verification](verification/2026-11-18-host-update.md).

## Mistral Vibe as a harness · 2026-11-18 · built and tested against a stand-in; first probe of a real `vibe-acp` 3.1.3 fixed the MCP server shape (CHG-0522); a full thread in the app still unchecked

CHG-0520 (in [0.1.10-Prototype](changelog/0.1.10-Prototype.md)) adds `vibe` to `HarnessName` and a new adapter, `packages/service/src/harness/vibe.ts` (with the account probes in `vibeAccount.ts`), driving Vibe's ACP server `vibe-acp` (one process per thread, `session/new`/`load`/`prompt`, `ask` mode so every tool call asks, `model`/`thinking` config options, `session/cancel`, permission requests answered from the tracked `tool_call` updates). Models, sign-in, and the monthly plan limit read from Vibe's own ACP extensions on a short session; accounts use `VIBE_HOME`; Install is `uv tool install`, Update is `vibe update`, newest release from PyPI. [Research note](research/mistral-vibe-acp-2026-11-18.md) cites the `mistral-vibe` 3.1.3 and `agent-client-protocol` 0.11.0 wheels read for the wire shapes. Checks: Biome clean, typecheck clean on all workspaces, 10 new tests in `test/harness/vibe.test.ts` over `stand-in-vibe.mjs`, and the full suite `CI=1 bun run test` passes (2,155 passed, 19 skipped). Open: a live probe with a real `vibe-acp` (not installed here — Vibe Desktop bundles `vibe-app-server` only), the owner's look at the Providers card and pickers in a window, a phone, whether `session/set_config_option model` persisting to the account's `config.toml` is acceptable (Vibe's behavior, mistralai/mistral-vibe#1556), per-model thinking levels need a Vibe newer than 3.1.3 to be listed, no host-sandbox wrap for Vibe yet (adapter reports Unprotected), and steering waits for the next turn as on OpenCode. Update: a real `vibe-acp` 3.1.3 refused `session/new` with -32602 because the MCP server lacked `type` and `headers`; fixed in CHG-0522 ([0.1.11-Prototype](changelog/0.1.11-Prototype.md)), and the stand-in now validates the shape.

## Android self-update · 2026-11-18 · phone acceptance pending

The updater is implemented and merged into `main`, pushed (CHG-0460, CHG-0461). On a phone, install a release-signed APK with the updater, decline the install allowance once, then allow it and install a newer APK signed with the same key. Open Outlore again and confirm the host is still paired. The release signing secrets are needed for this check. [Specification](capabilities/app-updates/specifications.md#the-android-app)

## Context window per model · 2026-11-18 · redone and built on `mission/choose-the-next-batch-2e9256cc` (CHG-0509), not merged; the owner's merge and look pending

Each turn stores the window its harness reports (Claude Code `modelUsage[model].contextWindow`, Codex `modelContextWindow`; OpenCode none, 200,000), migration `0058_usage_context_window`. The limit is `min(window, 272,000)` for every model (the owner's soft limit, `contextSoftLimit`), read by the thread gauge, the lore gauge, the starting-context warning and the handover allowance. A thread that reaches the limit gets one line offering compaction (an errand for the next part of the work; Outlore has no compaction action). Claude Code's compaction shows as a line. Checked by the full suite (2,123 passed, 55 skipped); not run on a live Claude Code or Codex, not seen in a window. Open: the owner's merge and look, the interpretive choices listed in CHG-0509. [Verification](verification/2026-11-18-context-window.md).

## Simpler app · 2026-11-18 · all four batches built, tested, merged into `main` and pushed; the owner's look pending

CHG-0459 uses flat creation rows with the castle and sword-and-plus icons at the right of the labels on desktop and phone.

CHG-0463 removes the Realms title and overview page (home screen instead), reduces quest indentation, adds a separator above quests in no realm, and caps lists at five quests plus running ones.

CHG-0507 then removes the two creation rows and moves their icons to the right end of the Realms and Borderlands labels, shown on hover. CHG-0506 renamed the two creation rows **Visit a new realm** and **Start a new quest** (and the home screen's button with them). CHG-0503 gives those rows the conversation's own fill at rest, in place of the sidebar tone they showed inside their border; CHG-0504 drops their hover fill, so they stay white under the pointer; CHG-0505 gives the Realms and Borderlands lists **No realm to visit yet.** and **No quest in the Borderlands yet.** when they are empty.

CHG-0462 adds a plus to the castle, a leading folder icon on folder-backed realms, and a divider above the sidebar's two creation rows. Browser verification confirmed that the global **Start a quest** action creates a quest in no realm even from a realm view. The backup editor uses **Add a backup companion** in both layouts.

CHG-0452 crests removed; CHG-0457 and CHG-0454 the Realms title, realms and quests, quests in no realm as plain rows, Visit a realm and Start a quest, the footer menu, the phone's menu screen being the sidebar, the hub, Gild and nav icons removed, Connectors in Settings; CHG-0458 quests in no realm in the Realms overview, the Borderlands page and drop zone gone, a quest leaves its realm from the quest panel's Realm row (my choice); CHG-0456 side-quest worded errand, with a guard test. Numbers: written as CHG-0453 and CHG-0455, renumbered CHG-0457 and CHG-0458 at the merge because own copy and the `!` terminal had taken them. Open: the owner's look in a window and on a phone, the Realm row as the way out of a realm, budget rings in Reserves, the Workshop's icons, and unused leftovers (the service's hub requests, the app's Chronicler-realm plumbing). [Specification](capabilities/mission-tracking/specifications.md#simplified-left-navigation) · [Blueprint](capabilities/mission-tracking/blueprint.md#simplified-sidebar-errands-and-crest-removal-chg-0449)

## Voice input · 2026-11-20 · automatic desktop setup in verification

**Batch 3, automatic desktop setup.** Outlore builds the pinned whisper.cpp executable into desktop installers and downloads the multilingual `base` model on the first microphone press, before recording. The host checks the model's SHA-256 before caching it, and a later press retries a failed download. Explicit engine and model paths still work. The batch starts at `801e8c77` in `.worktrees/desktop-voice-setup`, following [ADR 0024](architecture-decision-record/0024-speech-is-transcribed-on-the-owners-device-with-whisper-cpp.md).

**Batch 2, "the audio message" ([CHG-0499](changelog/0.1.9-Prototype.md)):** a microphone button in the shared Composer, desktop window only. Press to record, press to stop, a cross cancels; the host transcribes (`ReadDictation`, `TranscribeDictation`) and the words are inserted at the cursor, never sent. Without `OUTLORE_WHISPER_CLI` and `OUTLORE_WHISPER_MODEL` the press says voice is not set up. Checked in a real window with a fake microphone and the real engine, and by the full suite (2,080 passed, 55 skipped, after the rebase onto `main`); the window run was not repeated after the rebase. Not tried with a real microphone, another language, or a packaged build. Deferred from that batch: the web app and the phone (the button is hidden there), the licence exclusions, and the owner's look at the button's place and states. [Verification](verification/2026-11-18-dictation.md).

**Batch 1:** the owner's answers are in [ADR 0024](architecture-decision-record/0024-speech-is-transcribed-on-the-owners-device-with-whisper-cpp.md) (accepted): no vendor receives audio; whisper.cpp on the desktop and the phone; the `base` model; many languages; no direct voice for now. Agreed and delivered: [CHG-0450](changelog/0.1.8-Prototype.md) (approach) and [CHG-0451](changelog/0.1.8-Prototype.md) (the service's transcriber, `packages/service/src/voice/transcribe.ts`), tested against whisper.cpp at `8302b819` with the `base` model and whisper.cpp's sample. Original batch full suite (`CI=1 bun run test`): 2,055 passed, 56 skipped. Not built then (the button and the desktop recording came in batch 2): the phone's native module, the model's download and bundling, the start-and-stop choice, the licence exclusions. Open: whether the phone spike (latency, memory, battery on a device) comes before the desktop batch; the owner's look at the composer when built. The engine's own GPU path aborted inside the sandbox; the CPU path is verified. [Verification](verification/2026-11-18-voice-transcriber.md).

## Code Mode widened · 2026-11-18 · built, tested and merged into `main` (branch `worktree/code-mode-widen`), the owner's look and a live harness check pending

The owner said Code Mode should do many things, as in Cloudflare's article, and asked for it built (proposal CHG-0446, delivery CHG-0447). With the switch on, a thread reaches Outlore's own tools and its connectors' tools by code, through one `run_code` tool; four tools stay direct; at most 5 calls that start work a run; the setting is read once per turn and joins the harness restart keys; the Charter's switch reads "Code Mode". It works with no connector. Biome, typecheck and the full suite pass (2,061 passed, 54 skipped). The listing is only 7% smaller; the gain of chained calls is unmeasured. Not seen in a window or on a phone, not tried on a live Claude Code, Codex or OpenCode. The decisions are listed in the [specification](capabilities/connectors/specifications.md#code-mode) and the owner can redirect any. [Verification](verification/2026-11-18-code-mode-widened.md).

## Review since 0.1.6-Prototype · 2026-11-17 · uncommitted refactors

The review covers `0affd46..fd7f802`. The refactors cover Code Mode's service wiring, the inverted conversation feed, and the mobile pairing adapter. An executor regression test verifies that a compilation error caused by exhausting QuickJS memory returns a failure. An exception in the separate connector completion callback can still escape before the pending call is disposed. The service composition and release workflow remain above the size guideline. The workflow's duplicated version stamping is pending a packaging check. Capability findings and decisions are listed below.

The Standards and Specifications reviewers checked the patch. `bun run check`, `bun run typecheck`, and `git diff --check HEAD` passed. The full suite ran with `CI=1` and `XDG_DATA_HOME` absent (2,045 passed, 50 skipped). Four terminal tests skipped at the baseline ran in this session. The additional test covers the QuickJS compilation failure.

## Conversation opens on its last messages · 2026-11-17 · built and tested, the owner's look pending

A quest, side-quest, or Chronicler's conversation uses an inverted feed to open on its newest entry (CHG-0442, committed as `28aaa8c`). The [thread messaging specification](capabilities/thread-messaging/specifications.md#position-in-a-conversation) lists the window and phone checks. Keeping the reading position during a streaming reply remains unverified and may fail on Android. The scroll cue remains open in the [backlog](backlog.md).

## Code Mode core · 2026-11-17 · merged into `main`

The owner asked to implement Code Mode (Cloudflare's design) and chose to build its core ahead of the connectors, with QuickJS in WebAssembly as the executor (CHG-0441, [ADR 0023](architecture-decision-record/0023-code-mode-runs-in-quickjs-inside-the-host.md)). Starting revision `0affd46`, rebased on `6bc53e8`; worktree `.worktrees/code-mode`. Built: `packages/service/src/connectors/` (gateway interface with a no-connector layer, executor, declarations, `run_connector_code`), the setting `shouldUseCodeMode`, the tool server's wiring. Checks: Biome, typecheck, full suite (2,034 passed, 54 skipped), 25 new tests; [verification](verification/2026-11-17-code-mode-core.md).
The Charter switch, real gateway, approval checks, live harness runs, and measurement remain open. The server currently reads the setting per request. It needs to keep the setting and gateway listing consistent throughout a turn. The tool description should also say that a call past the 200th throws an error the code can catch. Decide whether Chronicler and Rituals should be able to change the setting.

## Android APK · 2026-11-17 · merged into `main` and launched on a phone

The local build and launch are recorded in the [verification note](verification/2026-11-15-android-apk.md#follow-up-on-2026-11-17-chg-0443) (CHG-0298 and CHG-0443). A phone check still needs to cover pairing, the camera, pairing links, and screens. Review the light-only Expo configuration against the agreed system appearance and check the wording when the phone refuses a local relay. The release key and first GitHub packaging run are pending. A manual run can currently pass with debug signing even when a tag would fail. Decide whether debug signing should require an explicit workflow input or be available only in local builds.

## Running quests in the sidebar · 2026-11-17 · merged into `main`

CHG-0440 keeps quests in the Running state visible past the list cap. The sidebar still needs a window check. Decide whether a quest in Summons should also stay visible when it has a running side-quest.

## The `!` terminal in an own copy · 2026-11-18 · built and tested, the owner's look pending

CHG-0455: a thread working in its own copy opens the `!` terminal in that worktree (`ownCopy` on the thread's conversation view, `terminalFolderOf`). Built on branch `worktree/bang-worktree`, which is merged into `main` and pushed. The owner's rule: a thread keeps one working folder; another place means a side-quest, so hand-made worktrees are not followed. Open: a window check on an own copy; the full suite passes (2,019 passed, 54 skipped).

## Connectors · 2026-11-16 · specified (CHG-0321 to CHG-0327), nothing built

The owner wants connectors in the Charter (a marketplace-like place), with a switch on each realm and quest, a global switch and a switch per tool, Composio and Apple apps first, a Vault for secrets, and Code Mode as one experimental global setting. [Specification](capabilities/connectors/specifications.md), [draft](capabilities/connectors/draft.md) (open items only), [research](research/code-mode-autonomy-connectors-2026-11-16.md), [handoff](../.agents/handoffs/2026-11-16-0835-connectors-specification.md). Also written: the requirement *Connector secrets stay on the host*, the glossary terms Charter, Connector and The Vault, the outline line, notes in tool-and-skill-loading, mission-tracking and thread-panel, and backlog items. Open: which group of the thread panel holds the tools line, whether The Vault holds other secrets later. The [blueprint](capabilities/connectors/blueprint.md) and [ADR 0022](architecture-decision-record/0022-the-vault-encrypts-secrets-and-hides-its-folder-from-sandboxes.md) are proposed (CHG-0328) and were revised after a second opinion (CHG-0330), awaiting the owner's review; the build starts with read-denial probes of each harness using a disposable secret, then the Vault. Not authorized to build.

## Architecture audit · 2026-11-16 · all 17 candidates built, integrated and merged into `main`, window checks pending

The owner authorized every candidate of the [audit](architecture-audit/architecture-audit-2026-11-15-2323.html). Five side-quests built them (CHG-0301 to CHG-0318); the parent merged them on `worktree/audit-integration` (on top of `main` at `12fedf9`; base `dbb3ae6`). Typecheck, Biome and the full suite pass (1,679 passed, 54 skipped). Candidate 3 is partial (per-screen Back and the callback interface remain). No window, phone, live provider or relay deployment was checked when it was built; `worktree/audit-integration` has since reached `origin/main`. [Verification](verification/2026-11-16-audit-integration.md), [handoff](../.agents/handoffs/2026-11-16-0110-architecture-audit.md). Open: the owner's look, redeploying the relay for the room-full code.

## Choice dialog for AskUserQuestion · 2026-11-15 · built and tested, window look and a live Claude Code run pending

The owner reported that Claude Code's `AskUserQuestion` showed no dialog: it ran unasked and came back with no answers. CHG-0299 (in `changelog/0.1.6-Prototype.md`; starting revision `d0896ad`, committed on `main`) makes it a choice question: one dialog with the call's choices (single or multiple, an own answer, Send, Skip), the turn held in Attention, the answers returned in `updatedInput.answers`; Stop withdraws, Skip is recorded as Skipped. Agreed with the owner: multiple choices and an own answer supported, Skip distinct from a withdrawal, Claude Code only wired, contract shaped for Codex and OpenCode. [Specification](capabilities/action-approval/specifications.md#choice-questions), [verification](verification/2026-11-15-choice-dialog.md). The owner's look at the dialog, a live Claude Code run, and the Codex and OpenCode adapters remain open.

## Mobile navigation · 2026-11-15 · built and checked in a 390 px window, owner's look pending

CHG-0292 (in `changelog/0.1.5-Prototype.md`; starting commit `3ba47a7`, uncommitted): below 820 px a top bar with a menu button opens a full-screen menu of the places; Chronicler is the whole content area; a quest's Back goes to its realm's quests or the Borderlands; the Workshop, archive, and All lore lose their Back to the Guild Hall. [Verification](verification/2026-11-15-mobile-navigation.md). Open: the owner's look on a real phone; starting a quest on a phone (the quest lists have no new-quest button on a narrow window); other screens at phone widths (the Workshop's cards are cramped, see the backlog's narrow-windows item); safe areas, light and Gild looks.

## T3Code comparison and documentation accuracy · 2026-11-15 · built and checked, owner's review and commit pending

The owner asked to compare Outlore with T3Code, then authorized correcting documentation to distinguish implemented behavior from plans (CHG-0288). Starting revision `1d664b370ae350aabbcd34aec6209a89b43e6a2c`. Changed: [upstream notes](research/t3code.md) (pinned `pingdotgg/t3code` at `0de6ddb8235debee8c7119343e1a4da9cd8b5de8`, 0.1.9), the [comparison](research/outlore-t3code-comparison.md), implementation-status sections in five specifications, notes in the outline, glossary, architecture and inspirations, the README, `apps/app/AGENTS.md`, and Chronicler's guide topics with a test. No planned capability was implemented, removed or reduced, and nothing authorizes a fork, migration, release or push.

Result: T3Code already ships much of what the host and browser batch plans; its managed access does not meet Outlore's no-account, relay-cannot-read requirement, though its LAN, Tailscale and SSH routes were not compared. The batch's checks are in the changelog entry; no upstream app or live provider was run.

Open: the owner's decision whether to evaluate extending or borrowing from T3Code before building the host and browser batch (the comparison recommends doing so); the owner's review; commit. The T3Code reading was bounded: worktree/merge logic, the update flow, scheduled-task rules, and budgets or multiple accounts per harness remain unread. Older dated entries below and the handoffs keep their original claims.

## Browser access · 2026-11-15 · first batch built, committed and deployed; owner acceptance and a real pairing pending

The owner approved the first batch and the trust boundary on 2026-11-15 ([CHG-0286](changelog/0.1.4-Prototype.md), [0019](architecture-decision-record/0019-browsers-use-the-relay-served-web-app.md)). Starting revision `1d664b3`; committed and pushed as `8cee410`. Published (CHG-0287): the relay Worker serves the web build (first deployed 2026-11-15 as `outlore-relay`, version `08b135fa`; `bun run deploy` in `packages/relay`); checked locally with `wrangler dev` and live with requests. The owner then paired a browser with their Mac through the page and reported "It works" (2026-11-15; the network was not stated, so a pairing from another network is still not recorded as seen). CHG-0289: the Worker is renamed `outlore` in the code (`https://outlore.dyrits.workers.dev`) and the app shows where the web app opens; the new Worker is not deployed yet: the release workflow's `relay` job (CHG-0290) deploys it from the first tag (a manual deploy was denied by the session's permission check), so until then the address does not answer and `main`'s default relay is dead; devices paired through the old address pair again. Behavior: [device-pairing specifications](capabilities/device-pairing/specifications.md) (A browser as a paired device; Releases). Evidence and limits: [verification](verification/2026-11-15-browser-access.md).
Built: `packages/controller` (`@outlore/controller`: browser pairings in storage, pairing, the encrypted link as a transport); `ServiceClient` talks through a transport (a WebSocket on desktop, the link in a browser); `useHostConnection` has a browser mode (no local service; the pairing dialog is required until a host exists; the host menu has no "This computer"; the banner offers **Pair again** when the host disconnected this browser); hosts tell their release in pairing replies (`OUTLORE_RELEASE`, set by the desktop from `app.getVersion()`); `@outlore/relay/browser` is the relay's client without Node. Checked: Biome, typecheck (seven workspaces), the new tests, the web export, and a 24-check drive of a plain Chromium page against a real host and relay.
My choices within the batch (to redirect): `localStorage` for pairings; the host's release in the `paired`/`resumed` replies, optional in the parser, and a host that tells none is refused; a mismatch has its own close code (4003) so the banner does not offer to pair again; a mismatch at pairing keeps nothing (the host still lists the device until the owner disconnects it); the browser's device kind is `desktop`; a local relay is accepted only by a page served from this computer; the verification used Chromium inside Electron with no preload, not Chrome, Firefox or Safari.
Open: the owner's look at the browser's pairing dialog, the banners and the host menu; the full suite result (see the verification record); the relay serving the web build, so a browser has somewhere to load it from, is the next batch and is not authorized; background host, remote terminals, host-side updates, phone layouts, and the two small races in the [backlog](backlog.md) are not part of this batch. No release or push is authorized.

## Outlore rename · 2026-11-15 · built and checked, owner's look and commit pending

The owner asked to rename the app Outlore, keep the old icon for the Iskios theme, make One the default theme, and then to leave the new icon unused for now. Agreed in [CHG-0285](changelog/0.1.4-Prototype.md): a full rename as in CHG-0143 (window, bundle and installer names, packages `@outlore/*`, `OUTLORE_*` variables, `window.outlore`, `outlore.sqlite`, MCP server `outlore`, `app.outlore.desktop`, pairing code prefix `outlore1-`), the assistant renamed **Chronicler** (migration 0050 renames its stored titles), One first in the Look card and the default. Starting revision `3269091`; uncommitted on `main`.
Renamed at the owner's word that a prototype may break: the app scheme `outlore-app`, the browser storage keys, the handshake label `outlore/1`, and the relay Worker `outlore-relay`. The code and README now name the repository `Dyrits/OUTLORE`; the repository was renamed on GitHub on 2026-11-15, and the origin remote of the original checkout still names `Dyrits/ISKIOS` (GitHub redirects it). Kept: migration id `0041_assistant_renamed_iskios`, dated documents. The new icon is kept as received in [brand](brand/README.md), not used.
Checks: `bun run check`, `bun run typecheck` (six workspaces), full suite outside Claude Code's sandbox, and a throwaway Electron drive; [record](verification/2026-11-15-outlore-rename.md).
Open: the owner's look and commit; a release needs the owner's approval, the `outlore-relay` Worker is deployed (a host connection to a random room is accepted and answers a ping; no real pairing through it was run), and `iskios-relay` still runs. Saved theme, look and drafts reset once, and devices paired before must be paired again. For the tag `0.1.4-Prototype` only, the release workflow also publishes each macOS installer as `Iskios-<version>-mac-<arch>.dmg` (a copy; the Outlore app looks for Outlore names, so 0.1.5 needs no copy), so an installed Iskios 0.1.3 can update into Outlore; only the copy step was run offline, no release or real update was done, and the updated app keeps the path `/Applications/Iskios.app`. The first launch of an installed Outlore moving the `Iskios` data folder is covered by `formerData.test.ts` only, not by a packaged run. Not changed: the application icon, older capability text that still says Guildmaster, and the `~/.iskios/` paths written in the workspace-attachment specification.

## Release 0.1.3-Prototype review · 2026-11-14 · review, refactor and behavior fixes done; owner acceptance and commit open

The owner asked for a review of changes since 0.1.2-Prototype, then, away, to carry it to the end. Both review axes are complete; the behavior-preserving refactors are applied and verified; the six behavior findings are fixed red/green as [CHG-0280](changelog/0.1.3-Prototype.md) (running-turn permission authority, multi-file standing permissions, whole-path owner words, sent drafts, realm hints on the proposal card, continued suggestions never counting as owner words), each with two rounds of independent Standards and Specifications verification. Migrations 0048 (`turns.harness`) and 0049 (`suggested_messages`) are new and unshipped.

Checks on the final tree: `bun run check`, `bun run typecheck` (six workspaces), `git diff --check` pass; `env -u CLAUDE_CONFIG_DIR CI=1 bun run test` outside Claude Code's sandbox passes (1,599 passed, 18 skipped). No window drive, build, installer or live provider ran.

All edits are uncommitted on `main` at `ae1bb1b`; private snapshot refs `refs/review/0.1.3-refactor`, `-behavior`, `-followup`, `-final` mark each stage. The [review record](verification/2026-11-14-release-0.1.3-review.md) owns finding identifiers, dispositions, verification and acceptance gaps.

Open: the owner's commit (and any push, tag or release, which need explicit approval); the owner's appearance and interaction acceptance listed in the record; SPV-14 (a folder path with a space or comma, quoted or not, names its shorter prefix; existing, low; proposed fix in the record), SPV-06 (folder paths match ignoring case) and SPV-09 (file order) by decision; Standards debt ST-01/02 (file sizes), ST-03 (synchronous worktree discovery), ST-04 (showing `openExternal` failures needs the owner's choice of how), ST-17 (test clock). A local development store built from `refs/review/0.1.3-behavior` must be recreated (0049 changed before shipping).

## One theme · 2026-11-14 · built and checked, owner's look pending

CHG-0279: One alongside Iskios and Gild in Workshop → Look and feel, with the existing Light / Dark / System choice and local persistence. It uses Zed's MIT-licensed One colors, with [source and contrast adaptations](research/zed-one-themes.md); the notice ships with desktop builds. Existing defaults, palettes, sidebar drawings, and the Iskios application icon are unchanged.
The owner's follow-up is fixed: changing a theme or look returns to **Look and feel**, not Permissions. Normal Workshop navigation still opens Permissions.
Starting revision `fd4680e`; implementation `875699a`, integrated with current `origin/main` (`e0d75d5`) in `d8ec0fd`. The owner authorized committing and pushing to `main` and asked to notify the 0.1.3-Prototype release-review thread afterward.
Checked: Biome, workspace typecheck, full suite after integration (1,558 passed, 18 skipped), desktop build, web export, and a throwaway Electron drive of selection, both looks, reload persistence, and a System change. [Proof and screenshots](verification/2026-11-14-one-theme.md).
Open: the owner's visual acceptance. Not checked: installer contents, Windows/Linux, native phones, a paired host, narrow windows, or every screen. The browser drive found the unchanged sidebar's nested-button DOM warnings; those are outside this palette batch.

## Sandbox token isolation (SA-11, SA-13) · 2026-11-14 · OpenCode fixed and checked

Approved by the owner on 2026-11-14. The owner then asked for a fix that breaks nothing, keeping threads able to share context and know what the others are doing (they do so through the thread tools, never the process table). Delivered as [CHG-0277](changelog/0.1.3-Prototype.md#chg-0277--2026-11-14--a-sandboxed-opencode-no-longer-sees-other-processes), with [evidence](verification/2026-11-14-token-isolation.md). Committed on `main` with the handoff, on top of CHG-0276.

Still open:
- A run under Claude Code's and Codex's sandboxes. Both were read from their profiles. The session's permission classifier declined running `@anthropic-ai/sandbox-runtime` twice; the owner can add a permission rule, or run [the reader scripts](verification/2026-11-14-token-isolation/scripts/) from a Claude Code thread.
- Linux (bubblewrap) and a live OpenCode turn under the new profile.

## Providers merged into one card per harness · 2026-11-14 · built and checked in a window, owner liked it except on small screens

The owner asked to merge the Workshop's Harnesses and Accounts cards, keeping the title, with a second screen as the target (CHG-0268, in `changelog/0.1.3-Prototype.md`; starting commit `b6e0324`, uncommitted). `settings/providers.tsx` replaces `accounts.tsx`; `ui/actionMenu.tsx` is the new "⋯" menu. Checks: typecheck, Biome, app tests (366 passed); [proof](verification/2026-11-14-providers-merged.md). The owner's verdict, 2026-11-14: "Awful on small screen but really nice otherwise"; the narrow layout is to redo (a row's name, detail, pill, Rename and menu do not fit side by side). Open: Update and Install, a signed-out account, long details, narrow window, light and Gild looks were not seen. Account budgets still sit on their own card in Limits (the earlier question of moving them onto each account's row stays open).

## Realm archive, recovery, and grouped overview · 2026-11-13 · built; window proof of the quest and Ritual choices pending

Starting revision: `b6e03247c1caeab64a0eacdaf5d7e79dc99c2518`. The owner selected realm removal as the next focus and settled Q1–Q10 in the thread, with the last clarification that a blank form name resolves to the folder's name and the initial shuffled crest is a proposed value. The agreement is [CHG-0271](changelog/0.1.3-Prototype.md#chg-0271--2026-11-13--realm-archive-recovery-and-the-realms-overview); behavior and acceptance live in [mission tracking](capabilities/mission-tracking/specifications.md#archiving-and-restoring-a-realm).

Implementation plan, in dependency order:
1. Test-first service/contracts/storage work for confirmed realm archive and restore, preserving prior individual quest archives, folder identity, and older saved data. Reuse the command transaction/follow-up boundary and lore history writer; do not silently unarchive through folder attachment. Cover cancellation and confirmation-time changes in the realm's contents or running threads.
2. Wire the realm panel and top-right archive button, Archive restore, and the post-archive parent navigation. Build the grouped Realms overview with the existing compact quest rows and nested side-quests; keep the sidebar heading's fold behavior and add its overview button.
3. Extend new-realm creation with the archived-folder prompt, independent two-column name/crest choices, defaults and equality skipping, and the final counted, recoverable lore-wipe confirmation. Add duplicate-name warnings and folder hints to create/rename, the sidebar, overview, and realm pickers.

Verification plan: focused red/green tests at the service and plain UI-logic interfaces, then `bun run check`, `bun run typecheck`, and `bun run test`; exercise the actual desktop flow on isolated data with the fake harness, in dark and light. Include nested running threads, previously archived quests, a service restart, same-folder recovery, mixed name/crest choices, equal values, Cancel and failure, and lore undo. Review the combined data-risk change against the starting revision before delivery; the owner's visual/interaction acceptance is required.

Status: the owner authorized implementation with "Go for it." The receiving worktree was clean at the starting revision. The service, additive migration 0046, shared contracts, archive/recovery controls, return navigation, grouped overview, duplicate-name warnings, and folder hints are built. The two independent reviews found five standards issues and three behavior defects, all accepted, corrected, and re-verified as resolved by the original reviewers, with no supported regression. Their independent focused checks passed 24 tests (Standards) and 19 tests (Specifications). DECISION-1 remains open. Current lint, typecheck, desktop build and full `CI=1 bun run test --maxWorkers=4` pass: **1,500 passed, 14 skipped; 140 files passed and one skipped**. An intervening full run hit terminal/test time limits while the freshly restarted host had high load; the two affected files passed alone (28 tests), and the unchanged code passed the next full run. The dark and light Electron drives pass the original four behavior groups, but precede the review corrections. Exact checks, limits, review dispositions, screenshots and repeat commands are in the [verification record](verification/2026-11-13-realm-archive.md). No Delivery or owner acceptance is claimed.

Agreed 2026-11-14 ([CHG-0270](changelog/0.1.3-Prototype.md)): the archive dialog lists the realm's active quests with checkboxes (none checked) to move to the Borderlands instead of archiving; a quest at work cannot be checked. It also names the realm's Rituals, which are switched off, kept in the Rituals with a "Realm archived" notice, and left off after Restore or Start afresh. Built test-first in `realmArchiveDisposition.test.ts` (5 tests), with the checklist in `apps/app/src/realms/realmArchiveChoices.tsx`. Still to do for this change: the window drive for the checklist and the Ritual notice (the drive script predates it), the reviewers' pass over the new code, and the owner's look.

Landed on `main` after a rebase onto `6adb863` (full tests 1,511 passed); the window drive script now covers the checklist and a Ritual but has not been run. Next: run `documentation/verification/2026-11-13-realm-archive/drive.ts`, repeat the window drive in dark and light on fresh disposable data, record the evidence, and ask the owner to judge the runnable result.

Deferred in scope: right-click actions across menus, recorded in the [backlog](backlog.md). Outside this batch: permanent realm deletion, workspace-folder deletion, and a new realm id for an already-associated folder. No push, release, or shared-branch landing is authorized.

## Release 0.1.2-Prototype · 2026-11-13 · published; the update loop is not yet proven

Tag `0.1.2-Prototype` at `90b79ef` (CHG-0267); the first release with the app's own update check. The tag's workflow run (`43506315451`) passed and published a prerelease with the four installers, `latest.yml`, `latest-linux.yml`, and `SHA512SUMS.txt`; the macOS arm64 installer matches its checksum. It holds everything from CHG-0252 to CHG-0266 (the sections below), listed in [its changelog](changelog/0.1.2-Prototype.md); the release notes on GitHub for 0.1.1 and 0.1.2 were written from the changelog files. The changelog is one file per release: the next entries go in `changelog/0.1.3-Prototype.md`.
Not proven: an installed 0.1.2 updating itself from a published release (this needs a later release, so the first update will be 0.1.2 to the next), the Windows and Linux updaters, the installers on each system beyond macOS packaging, and the owner's looks listed in the sections below.

## Companion picker tabs per account · 2026-11-13 · built and checked headlessly, window look pending

The owner asked for the Companion selection to be based on account, so two Claude subscriptions show as different options (CHG-0264; starting commit `170a43c`, committed as `7fa08e5`, in 0.1.2-Prototype). The picker has a tab per harness account with that account's own models; choosing a model sets harness, account, and model. Open for the owner: the look of the tabs in a window (several or long account names wrap), and whether the Workshop's default Companion should gain an account (today it shows each harness's own sign-in only, as CHG-0257 settled the new quest's account). Renaming accounts apart from the computer's name followed in CHG-0265 (a Rename control on each Accounts row; a harness's own sign-in has its own name, per harness; window look pending). Not checked: a real second subscription with differing model lists, a paired device, the phone build. Model lists are now read once per signed-in account, which can make the first open slower (backlog: slow model lists).

## App updates · 2026-11-13 · built and checked on a packaged macOS app; released in 0.1.2-Prototype; owner review and a real update pending

CHG-0266 agreed the behavior ([specification](capabilities/app-updates/specifications.md)); starting commit `170a43c`, committed as `3c40d85`, in 0.1.2-Prototype. Built in the desktop main process (`apps/desktop/src/updates/`) with the preload bridge, an Updates section in the Workshop and a notice in the top bar (`apps/app/src/shell/updateNotice.tsx`, `settings/updatesCard.tsx`); the release workflow now publishes `SHA512SUMS.txt` and `latest*.yml`; new requirement "Update check carries no owner data". Evidence and limits: [verification](verification/2026-11-13-app-updates.md).
Checked: unit tests of versions, release choice, network, swap script, staging from a real disk image, the macOS updater against a fake GitHub, and the controller; the offline release-workflow check; and `apps/desktop/scripts/check-update.ts` on two packaged builds (0.1.1 to 0.1.2, found, downloaded, hash checked, swapped, relaunched, through the real `open` too). Screens in the verification folder.
Awaits the owner: the look of the Updates section, the top-bar notice and the confirmation (dark theme only seen); a real update from a published release to the next (0.1.2 is the first release with the updater, so the first real update needs a release after it). Not run here: Windows and Linux updating (`electron-updater`), and an installed app reading GitHub's real release list. The workflow's new upload steps ran for 0.1.2 and produced the update files and `SHA512SUMS.txt`. Left for later, in the [backlog](backlog.md): signing, a data backup before updating, channel choice. Next: the owner's look; the next tagged release, to update an installed 0.1.2 for real; then a Delivery record.

## Panel-ownership publication and next focus · 2026-11-13

The owner accepted the right-hand panel fix (`2a2d46f`, CHG-0263) after restarting `bun run dev`: "It's okay like that." Behavior and verification now live in the [specification](capabilities/thread-panel/specifications.md#panel-ownership-across-navigation) and [evidence](verification/2026-11-13-panel-ownership.md). A possible later restoration of each quest's own sidebar state is a candidate in the [backlog](backlog.md), not an approved change.

The owner requested a shared handoff, commit, local sync, and push to `main` with `--no-verify`. At handoff preparation, GitHub `main` was `6eed7ee` and the original checkout `/Users/dgerrits/Codelab/Dyrits/ISKIOS` was clean on `main` at `b526f74`. GitHub publication is authorized; read its live ref for the final result. Updating the original checkout still needs attachment or explicit permission to modify that unattached checkout; requested from the owner. Next product batch is not selected: slow model lists and account-specific model tabs remain candidates. The existing nested-button warning is unchanged.

## Companion preset stacks · 2026-11-13 · implemented and reviewed; owner's look and decisions pending

The owner rejected CHG-0258's primary-only presets; CHG-0260 applies the correction (a preset is a primary Companion and ordered backups, copied together) and CHG-0261 records the review fixes and the new layout (presets in a "Preset" card above the Companion fold). Starting commit `b526f74`, committed as `cbd8666` and pushed, in 0.1.2-Prototype.

Waits on the owner: the look of the Preset card and the Workshop's backup editor in a window (restart `bun run dev`); the provisional choices in the [specification](capabilities/companion-presets/specifications.md#provisional-choices): an empty preset clearing a thread's backups, no presets in backup folds, the proposal card and a Ritual taking a tier's backups, a side-quest taking the chosen preset's stack.

The owner's notes after seeing the new layout are in the [backlog](backlog.md) and the [handoff](../.agents/handoffs/2026-11-13-1705-companion-preset-stacks.md). The column carrying over is fixed and accepted (CHG-0263); slow model lists and a choice per account remain open. Left open from the reviews: two writers of one tier in the Workshop that can still race, removing an account does not scrub the Workshop's lists, the client sends the stack rather than the service reading the tier, oversized files, and the preset window drive (`drive.ts`, now without `any`) not rerun on the new layout. `shell.tsx` is now 434 lines. Checks and limits for the preset batch: [verification](verification/2026-11-13-companion-stacks.md).

## Computer name and default Companion tab · 2026-11-13 · built and checked headlessly, window look pending

CHG-0257 (starting commit `163667a`, committed as `b526f74`, in 0.1.2-Prototype; [proof](verification/2026-11-13-computer-name-and-companions.md)): the computer's own sign-in carries the host's name instead of "This computer", renamed from a new Computer name card in the Workshop's Accounts section; the Workshop's default Companion and backup cards became one card with the Companion button, and the right-hand Companions tab holds the default and its backup folds. Also fixed: the plan-limit rings' `origin` and `rotation` props made React warn on the web (`transform-origin`), now a `transform` string. Checks: typecheck, Biome, app and service work, remote and harness tests (843 passed). Open (also: narrow windows are broken with the Companions column open, left for a later session with the mobile version, see the [backlog](backlog.md)): the owner's look in the window (the card, the button opening the tab, the rings still starting at the top), a rename showing in every place, a paired device viewing a host's Accounts, narrow window, light and Gild looks.

## Folder picker on a host · 2026-11-13 · built and checked headlessly, window drive and owner review pending

Batch 3a of device pairing, agreed in CHG-0253 and delivered in CHG-0254 (starting commit `ae217e4`, committed as `39fee06`, in 0.1.2-Prototype): one picker for this computer and a paired host; a paired device reaches only the host's browsable roots, set in the Workshop (Remote access section, "Folders open to Iskios"); the host's own window reaches any folder. Checks: typecheck, Biome, 751 app and service tests passed, an end-to-end paired-device test, the web export. Open: drive the picker in a window (this computer, and a paired host through a local relay) and have the owner look at it and the Workshop card. The full suite passed on 2026-11-13 for the 0.1.2 release (1,475 passed, 14 skipped). Next in device pairing: 3b the terminal on a host (needs the owner's choice, backlog), then a mini-prototype of the direct path before batch 4 (backlog), then batch 5 measurement.

## Expanded Iskios width · 2026-11-13 · live check pending

CHG-0247 removes the expanded conversation's centered 900 px cap so the conversation and composer use the full available panel width. CHG-0248 restores expanded Iskios when the owner navigates from the left sidebar, including choosing the current destination again. Pending: check a wide window, resizing, and sidebar navigation to pages, realms, quests, and side-quests while Iskios is expanded in the running app.

CHG-0249: expanded Iskios hides the previous page's highlight and Quest tab, restricts Companions to Iskios's picker and backups, and sends no previous-page viewing context. Lint, typecheck, and app tests pass (323 passed, 4 skipped), including new scope and viewing-context tests. Pending: expand from a quest with its Companion already selected, verify the Iskios-only tab and backups, then restore and check the quest's picker returns.

## Side-quest Companion selector · 2026-11-13 · built, live check pending

CHG-0246: the new side-quest composer uses the shared Companion button and Companions tab instead of separate fields; the side-quest action sits after Send. Lint, typecheck, and app tests pass (320 passed, 4 skipped). Pending: check opening the draft's picker, selecting model and effort without changing the parent, sending the draft, cancelling, and the narrow-window overlay in the running app. The owner's sidebar Heading and SVG WebShape errors remain undiagnosed; the supplied logs omit the error messages above the stacks.

## Companions tab · 2026-11-12 to 2026-11-13 · built and checked in the window, owner review pending

The model choice asked for "like Delta's and OpenBot's pickers" became, over CHG-0220 to CHG-0245, a **Companions** tab in the right-hand column beside **Quest** (the Quest tab only in a quest): a Companion button in a composer opens it; a fold for the Companion in use and one fold per backup Companion (drag to reorder, bin to remove), the same picker in each; Iskios's button opens it as "✦ Companions" and its own backups; pressing the tab switches between a quest's and Iskios's; the right-hand toggle shows on every screen. Also: the top bar's breadcrumbs removed (CHG-0229), the quest panel's duplicate "Quest" caption removed (CHG-0230), the app has **no scroll indicator** for now (CHG-0245; question in the [backlog](backlog.md)). Companion presets are specified, not built ([specifications](capabilities/companion-presets/specifications.md), CHG-0242). Evidence: [screens](verification/2026-11-12-companion-picker/); typecheck, Biome, and the app suite (320 passed, 4 skipped) pass; driven in a throwaway Electron window on the fake harness.
Open: the owner's look at the tab and folds; the narrow-window overlay, light and Gild looks, a real failing turn using backups (a thread's or Iskios's), OpenCode effort levels in a backup, and the phone build were not checked.

## Device pairing · 2026-11-12 · batches 1 and 2 reviewed and checked; later batches pending

The owner wants to control one Iskios from another, from any internet connection, with no account or cost for users or the owner, and asked to implement it. Agreed in CHG-0201 to CHG-0203: the shared relay Worker on the owner's free Cloudflare account on `workers.dev` ([0016](architecture-decision-record/0016-shared-relay-on-the-owners-free-cloudflare-account.md)), end-to-end encrypted; host and paired-device words; full authority; a text pairing code (single use, 10 minutes); paired devices listed in Charter with Disconnect; a host menu at the top left; the folder picker on the host. [Specifications](capabilities/device-pairing/specifications.md), [draft](capabilities/device-pairing/draft.md), [lab evidence](verification/2026-11-12-relay-and-direct-path-lab.md). Starting commit `4987773`; review, verification and publication authorized by the owner.
Relay deployed 2026-11-12 and checked live ([CHG-0209](changelog/0.1.0-Prototype.md)): 13 of 14 end-to-end pairing tests pass against it.
Optional own relay built and checked live on the owner's account ([CHG-0212](changelog/0.1.0-Prototype.md)): Charter's Relay section deploys the relay to the user's own Cloudflare account with one API token (used once, never kept); owner review of the form pending (light theme only seen; token page wording, and the case of a token that reaches several accounts, which is refused today, to decide). Follow-ups are in the [backlog](backlog.md).
Review completion: [review record](verification/2026-11-12-device-pairing-review.md). Offline-host errors, shutdown cleanup, authentication guards, paired-host rename control and module boundaries corrected. Appearance and the unproven claims in the record remain pending.
Batches (CHG-0203): 1 `@iskios/channel` (Noise NK over any carrier, pairing code), `@iskios/relay` (room core, Worker with Durable Object, Node relay for tests), service host and controller sides, headless test of two services through a local relay; 2 the app (host menu, Add a host, Charter section); 3 folder picker and terminal on a host; 4 the direct WebRTC path; 5 deployment to the owner's account and measurement of real use.
Status: batches 1 and 2 built and checked (CHG-0204 and CHG-0205; evidence [1](verification/2026-11-12-device-pairing-batch-1.md) and [2](verification/2026-11-12-device-pairing-batch-2.md)); owner review of the look pending (host menu, Add a host dialog, Charter card, the banner). Open for the owner: the draft's points on the terminal staging, the offline host, and the host menu details; the batch 1 decisions in CHG-0203 (device token, room claim, bridge through the local service).
Resuming: what is left is (3) the folder picker on the host (search field, suggestions, step-in browsing, New folder; today a selected host refuses the system dialog with a message) and the terminal on a host (today `!` stays text); (4) the direct WebRTC path; (5) measure real use of the relay, which is deployed to the owner's account at `https://iskios-relay.dyrits.workers.dev` (CHG-0209; a real pairing between two apps through it is still to be seen). Not seen: two physical computers, a phone, dark mode, the Gild theme, a narrow window.
Known limits: keys stored in the SQLite file in plain text; rooms not rate-limited; free-plan use not measured. Node's own WebSocket reports a relay's close ten seconds late; the relay now sends a closing frame so clients do not wait (CHG-0209).

## Comments on messages · 2026-11-11 · built and checked, owner review pending

Agreed in CHG-0195, built in CHG-0196. Starting commit `588d0e3`, built in worktree `ISKIOS-message-comments` (branch `worktree/message-comments`) and rebased onto `b901df9`.
Built: a Comment button on any message card (hover or focus) and a Comment on selection button beside selected text; comments wait per thread in the browser's storage, listed in a tray above the message box (edit, remove); sending carries them as a `<comments>` block after the typed text and the conversation draws them back as quotes.
Checks: typecheck, Biome, 12 tests added, app suite passes; driven in a throwaway Electron window on the fake harness ([proof](verification/2026-11-11-message-comments.md)).
Open, awaiting the owner: the look; the block's form and the keys (my choices in CHG-0195); comments on other items (step groups, cards, lore changes, journal, quest panel) not built. Not checked: dark mode, a side-quest, a real harness reading the block, the phone build beyond typecheck.

## Mentions with @ · 2026-11-11 · built and checked, owner review pending

Agreed in CHG-0181, built in CHG-0182. Starting commit `5fbfc4c`; nothing committed.
Built: in every message box a bare `@` lists Quests, Realms, and Files & Directories (the last only with a linked folder); a quest, side-quest (`Quest › Side-quest`), or realm becomes a chip, written as `@quest:<id>`, `@side-quest:<thread id>`, or `@realm:<id>`; the service appends what each names, with ids, to the message the harness reads; for that turn the receiving thread may read a mentioned quest's journal and message its top thread or the mentioned side-quest, and the quest written to may answer. Archived quests are never offered and open nothing.
Checks: typecheck, Biome, 9 service and 9 app tests added, app suite passes, full suite with two failures that also fail without the change; driven in a throwaway Electron window on the fake harness, light and dark ([proof](verification/2026-11-11-mentions.md)).
Open, awaiting the owner: the look of the menu and chips; the token form and the reply rule (my choices in CHG-0181); whether a realm mention should open anything (today context only). Not checked: a real harness choosing to use a mention; the phone build beyond typecheck (no chips in the box, Backspace erases the `@`); long lists (no scrolling, capped at 12 and 5 per category). Not built: Iskios's event lines for messages between quests.

## Iskios, the assistant · 2026-11-11 · built, checked, and reviewed; owner review pending

Agreed in CHG-0173, CHG-0174, and CHG-0176; delivered in CHG-0175, CHG-0177, CHG-0178, CHG-0179, and CHG-0180 (review and refactor). Starting commit `f492434`. The Guildmaster is Iskios: it proposes quests as a card (realm and Companion by tier), makes and renames realms on the owner's quoted words, and the Guild Hall has no side panel. Run with Claude Code in a throwaway window ([verification](verification/2026-11-11-iskios-live.md)).
Open, awaiting the owner: the look of the card and the Guild Hall; whether the card's wording should say "Create" with the realm's folder (CHG-0173 words it so; built as "Open the new quest"); whether "Customize the Companion" stays; realms tied to no folder cannot be chosen on the card, so Iskios can make a realm it cannot use yet (a decision: stop making them, or carry the realm's id); whether `create_ritual` should need the owner's quoted words like the realm tools (a Ritual opens quests on a schedule).
Not built: the Guild Hall hub (recent activity, what waits for the owner, a recap; the recap's period and contents to settle with the owner); the renaming of code identifiers, columns, request and setting names (a storage and wire migration); deleting realms; moving quests by Iskios; explaining the app; Codex and OpenCode as Iskios's harness not run.

## Quest moves · 2026-11-11 · built and checked, owner review pending

The owner chose confirmed quest moves as the next unbuilt feature from the backlog; agreed earlier in CHG-0130, CHG-0133, and CHG-0161, built in CHG-0172. Starting commit `2fb5af5`; nothing committed.
Built: request `MoveQuest` and `packages/service/src/work/questMoves.ts`; in the sidebar, drag a quest's row onto a realm or the Borderlands, with a confirmation (`shell/questDrag.web.tsx`, `moveQuestModal.tsx`, `questMove.ts`).
Checks: typecheck, Biome, 7 service and 4 app tests added, the app suite passes; driven with real drags in a throwaway Electron window, dark and light ([proof](verification/2026-11-11-quest-moves.md)).
Open: the owner's look; no run through the app's own harness process after a move (sessions are kept and a journal entry tells the thread; probed with `claude -p`, CHG-0172); no menu or keyboard way to move; the Guildmaster cannot move a quest; the Guildmaster and realm chooser still do not offer realms tied to no folder.

## Only Realms and Borderlands · 2026-11-11 · built and checked in the web export, owner review pending

CHG-0161 (placements) and CHG-0163 (sidebar hover marks, folding headings, scroll cue, widths, nested full list) are built and recorded in CHG-0164; storage in [ADR 0015](architecture-decision-record/0015-realms-tied-or-not-and-one-borderlands.md). Starting commit `10684a9`.
Evidence: [verification](verification/2026-11-11-realms-and-borderlands.md); the Electron window was not checked.
Open: the owner's look; the assumptions in CHG-0163 (nested full list unfolded by default, "Show all N" counting quests only, the arrow's place on quest rows); the Guildmaster and the realm chooser do not offer realms tied to no folder; quest moves are still to build; the full list keeps its own small "›" fold marks; three suite failures outside this change (CHG-0164).

## Release launch recovery · 2026-11-10 · repaired locally, CI gate implemented

The owner wants a release that installs and runs; this batch starts at `4724ebc` alongside unrelated account-budget changes.
The packaged-app check fails on the blocked executable and passes on a byte-identical fresh copy and the repaired installation; it exercises the rendered Guildmaster screen, service bridge, and native terminal on isolated fake-harness data.
The installed app was replaced with the passing copy, preserving its new file identity; its Finder registration was corrected after a temporary test bundle claimed the normal profile.
The normal app now runs from `/Applications/Iskios.app` and owns its ordinary profile; the owner's final acceptance remains pending.
The exact macOS DMG launch gate passes against the untouched GitHub download and runs before release artifact upload; this proves packaged startup on the build runner, not Gatekeeper acceptance on other Macs.
Evidence: [DMG launch recovery](verification/2026-11-10-dmg-launch.md).
Developer ID signing and notarization require the owner's membership and credentials; no Developer ID Application identity is currently available in this Mac's keychain.

## Desktop packaging automation · 2026-11-10 · tagged releases configured

The owner reported the initial packaging workflow works, then authorized moving packaging to version tags and direct downloads.
This follow-up starts at `45893948e884f6208b633e1a1155b7fcb5fcbf92`; `main` pushes and pull requests now run lint, types, and tests, while `v*` tag pushes build all four installers and publish a GitHub Release.
Manual builds publish direct Actions artifacts only; prerelease tags become GitHub prereleases, and the tag sets the packaged app version.
Verification: actionlint and seven offline shell scenarios pass; see [tagged release proof](verification/2026-11-10-tagged-releases.md).
Next: inspect the first check-only run after publication, then push a version tag when the owner chooses to release and verify the direct release downloads.
Trusted signing, notarization, auto-updates, and runtime portability fixes remain outside this batch.

## Consumption and cost · 2026-11-11 · built, owner review pending

Agreed in CHG-0126 and built in three steps, recorded in CHG-0141: billing kind per turn, estimated cost (`≈`), the models.dev price table with its snapshot and Charter switch, account budgets and credits, a line under each agent reply, and plan limits (Codex). Starting revision `4589394` (step 1 `4724ebc`, step 2 `93e7f10`, step 3 `97e0457`); proofs in [verification](verification/2026-11-10-consumption-and-cost.md), [step 2](verification/2026-11-11-account-budgets.md), and [step 3](verification/2026-11-11-reply-usage-and-plan-limits.md).
Awaiting the owner: the look of every new screen; decision record 0014 (the price read, proposed; `architecture.md` changes on acceptance); the API-key rule ("I guess") and the requirement "Price table read carries no owner data"; whether the account budgets belong on each account's row in the Accounts card instead of their own Charter card.
Not probed, since each needs a paid model call: Claude Code's `apiKeySource`, `rate_limit_event`, and `total_cost_usd`; OpenCode's sign-in and usage; usage per model call live. The open terms question on subscription use through the `claude` tool is in the [backlog](backlog.md).

## Guildmaster batch · 2026-11-10 · increments A, B, and C implemented and checked, owner review pending

Agreed in CHG-0106 and CHG-0107: the Guildmaster is the one place quests start and the control panel over them, built from the full [quest coordination](capabilities/mission-coordination/specifications.md). Starting revision: `b913921`.
Built: A (CHG-0106) the conversation, matching on ticket keys, Continue in or open, realm hand-off; B hearing back, `act_on_mission`, `create_ritual`, `read_journal` and `read_control_history`, messaging to and from the Guildmaster; C tiers, its own cheap Companion and budget, the hide setting.
Checks: 29 fake-harness tests in `guildmaster.test.ts`; typecheck and Biome pass; full suite 581 passed, 10 skipped; the window driven on a throwaway database for A, B, and C ([proof](verification/2026-11-10-guildmaster.md)).
Awaiting the owner: the look; a live Claude Code, Codex, or OpenCode run of the Guildmaster's prompt (does it search first, pick Rituals for repeating work, never open a quest that fits, and act only when asked?).
Not built: messages between quests by `@` reference and their event lines; the 20-message window with summarized older messages; Guildmaster's spending on the quests' dashboard.

Sidebar follow-up (2026-11-10): the rail no longer lists finished (Done) quests by default; a Charter toggle ("Show finished quests in the sidebar", `shouldShowFinishedQuests`) brings them back, and a finished quest stays listed while it is open. The board and the realm counts are unchanged. Checked by `apps/app/test/shell/railQuests.test.ts`, typecheck, lint, and the full suite (590 passed); not driven in the window; the look awaits the owner.

## Goal

Build the first slice iteratively (CHG-0025): each batch leaves a runnable application with its checks. Design under review: [first-slice-design.md](first-slice-design.md) and the mission-tracking, thread-tree, and thread-messaging blueprints. Starting revision: `e445b44`.

## Batch 1: delivered

Delivered in CHG-0026 (commit 649e232). Provisional behavior still in place until decided: on startup, threads left Running become Idle and interrupted turns are not replayed; the desktop app loads only the Metro dev server; rollback of a failed mission start is not directly tested.

## Batch 2: delivered

Delivered in CHG-0030 (commits ddb888d to d62a904). Provisional behavior still in place until decided: a failed turn's messages become undelivered and are retried with the next message; the live check runs only with `ISKIOS_LIVE_CLAUDE=1`; a missing `claude` executable is covered by the stand-in checks only.

## Batch 3: delivered

Delivered in CHG-0033; the owner skipped the run-through and the desktop notification is unverified. Agreed in CHG-0031: Claude Code's built-in tools behind action approval. The user's own MCP servers, skills, and Claude settings stay off.

### Behavior

- **Approval level** in Settings: **Risky actions only** (default) or **Also commands and edits**.
- **Default level**: Claude Code runs sandboxed with in-workspace edits and sandboxed commands unasked. The thread's instructions list the risky actions (action-approval, Asking); the thread calls `request_approval` before one.
- **Harness prompts** reach Iskios through `--permission-prompt-tool` on the local MCP server. A prompt matching the action just allowed in that thread runs once without a question; one matching a standing permission's pattern runs unasked; any other prompt becomes a question. At **Also commands and edits**, every prompt is a question.
- **No sandbox** (native Windows; Linux or WSL2 without bubblewrap and socat): the default level asks for every prompt, and Settings says why.
- **The question**: one sentence (what and why); **Show details** with the exact command or target and the proposed pattern; **Allow**, **Always allow**, **Deny**, **Deny with a message**, **Discard**. Thread in Attention until answered, no time limit. Deny carries on with the refusal; Discard answers as Deny without a message.
- **Named in the owner's message**: `request_approval` cites the owner's words; when they appear verbatim in the owner's latest message in that thread, the answer is Allowed without a question, recorded as "Allowed by your message". Thread or harness text never counts.
- **Standing permissions**: Always allow saves a sentence and a command pattern (for example `git push *`) for the mission, widenable to everywhere; removable. Workspace scope follows workspace attachment. Each thread's instructions carry the permissions that apply.
- **Permissions page**: Settings row "Permissions · <level>"; level, standing permissions with scope, answer history filterable by mission.
- **Records**: each answer, discard, and withdrawal stays in its thread as a short line, for example "Allowed `git push` · 14:02 · desktop".
- **Where**: in the thread, and an open-questions list at the top of the dashboard (mission and thread shown). A content-free desktop notification when a thread enters Attention (macOS, Linux, Windows).
- **Stop**: a per-thread Stop button; the thread becomes Stopped and its open question is withdrawn. On startup, open questions are withdrawn and their thread becomes Idle.
- **Out**: routines, thread messages, Interrupt, phone answering, workspace scope.

### Probe evidence (Claude Code 2.1.302, 2026-11-05, stand-in MCP server over stdio)

- The prompt tool is called as `tools/call` with arguments `{ tool_name, input, tool_use_id }`, for example `{"tool_name":"Bash","input":{"command":"…","description":"…"}}`. It answers with one text block holding JSON: `{"behavior":"allow","updatedInput":<input>}` runs the tool; `{"behavior":"deny","message":"…"}` returns the message to the model as an error tool result.
- With `--permission-mode acceptEdits` and `--settings '{"sandbox":{"enabled":true,"autoAllowBashIfSandboxed":true}}'`: a command writing inside the working directory runs unasked; a write outside it fails with "Operation not permitted"; a new network host is denied ("deny network-outbound github.com:443"). Neither reaches the prompt tool.
- A Bash call with `dangerouslyDisableSandbox: true` reaches the prompt tool with the exact command and that flag, and runs unsandboxed when allowed. So an approved risky action is retried unsandboxed, and the thread's instructions must say so; the one-time match compares that prompt's command with the approved details.
- A prompt-tool answer held 200 seconds was accepted and the turn continued. Waits of hours are not verified.
- Claude Code aborts an MCP call silent for 300 seconds ("sent no response or progress for 300s; aborting"); SSE comments do not count and `MCP_TOOL_TIMEOUT` did not lift it. A per-server `timeout` in `--mcp-config` does: an answer given after 5 min 51 s was accepted (window drive).
- The sandbox refuses every write under `.git` in the working folder ("Operation not permitted" on `git init` and on `.git/index.lock`), so each local `git init` or `git commit` becomes a harness question at the default level.

### Checks

- Live probe: done, see above.
- Automated with the fake harness: done, 42 checks.
- Live check behind `ISKIOS_LIVE_CLAUDE=1`: done, 44 of 44 pass with Haiku.
- `bun run test`, `bun run typecheck`, `bun run check`: pass. Driven in the Electron window: done, see Drive findings.
- User run-through: pending. In a mission's scratch folder, allow a push to a local bare remote, choose Always allow, see a second push run unasked, remove the permission on the Permissions page; confirm the desktop notification.

### Drive findings (2026-11-05, Electron window, Claude Code with Haiku)

Verified: a harness question with Claude Code's description, Show details, the quote check ("Allowed by your message"), the one-time match, Always allow from the dashboard list, a later push in the same mission allowed by the standing permission with no question, the Permissions page and its filter, Remove, and Stop.

Fixed during the drive, each with a check written first:

- Stop opened a new question: Claude Code still prompted while exiting. A question now opens only on a thread at work, and Stop marks the thread Stopped before withdrawing.
- A question held over 300 seconds stayed open while Claude Code moved on. The MCP server entry now sets `timeout`, and a call whose connection closes withdraws its question.
- Harness questions said only "Claude Code asks to use Bash." They now add Claude Code's description of the command.
- The Allowed text now tells the thread to run the approved command alone: a chained `&& git log` failed the one-time match and asked again.
- History lines showed whole multi-line commands; they now show the first line, cut at 80 characters. Long mission names no longer overflow the filter chips.

Open, for the owner:

- Settled in CHG-0032: the sandbox protects `.git` (its write settings cannot lift a protected path, per Claude Code's settings reference), so Iskios answers prompts for local git itself at the default level when the sandbox runs. Verified in the window: a mission created a repository, committed, and branched with no question.
- The desktop notification was not observed by an agent.
- The service passes its whole environment to Claude Code except `ISKIOS_` variables. Launched from an agent's shell, that leaked the agent's `CLAUDE_*` and `GIT_CONFIG_*` variables; a normal launch is not affected. Not changed.

## Batch 4: delivered

Delivered in CHG-0036 after an agent's run-through in the window at the owner's request ([proof](verification/2026-11-06-batch-4-drive.md)). Agreed in CHG-0034 and CHG-0035. Not verified: operating the Finder dialog itself, and the desktop notification. Provisional behavior still in place until decided: the sensitive list is best effort; a missing-folder wait raises no desktop notification; Relocate and Clone again are staged.

### Open, for the owner

- In a fresh clone, `bun install`'s `prepare` step cannot set `core.hooksPath` inside the sandbox, so commits skip the pre-commit hook until something sets it. A thread asked to set it does so with no question.
- Whether a workspace should also load its own Claude Code settings and skills (`--setting-sources project`), which would also let project hooks run.

## Batch 5: delivered

Thread tree core, agreed in CHG-0037 and delivered in CHG-0038 after the owner accepted the side tree. Built test-first and driven in the window: [proof](verification/2026-11-06-thread-tree.md). Sources: thread-tree and thread-messaging specifications and blueprints.

### Behavior

- **Opening by a thread**: `open_thread` with a request and optional short title, model, and effort opens a thread directly beneath the caller, in the caller's workspace, and starts it with the request. The answer is the new thread's identifier, or a refusal with its reason. Starting context: the request and who opened it; journal and intel are staged.
- **Opening by the owner**: "Open thread beneath" on the selected thread, with model and effort shown and changeable before the first message. Down to 4 levels below the top thread; agents have no depth limit.
- **Running limit**: at most 8 threads Running at once in a mission. `open_thread` past the limit is refused with the reason; a message to a thread past the limit waits until a slot frees.
- **Results**: `report_result` with the result text sends it to the parent as a thread message and makes the caller Done. The top thread has no parent: its result is shown in its own conversation. A result can be reported while threads beneath still run.
- **Thread messages**: `send_thread_message` to the parent or a thread directly beneath; others refused with the reason. Delivered at the receiver's next turn; a message wakes Waiting, Idle, and Done threads; each message shows its sender.
- **Waiting**: a turn ending while threads beneath the thread are Running or Waiting leaves it Waiting rather than Idle.
- **Stop and Resume**: Stop affects only the selected thread. Messages reaching a Stopped thread are kept; the tree shows "N messages waiting". Resume makes it Idle and delivers them.
- **View**: the conversation screen shows a side tree with each thread's title, state, and waiting count; selecting one shows its conversation, model, effort, and workspace.
- **Hooks**: the thread instructions say that a setup step failing only because the sandbox protects a Git file is re-run outside the sandbox.

### Provisional, until decided

- On startup, Waiting threads become Idle with Running ones, since nothing runs beneath them any more.
- The top thread's `report_result` makes it Done with no message: its replies are already the owner's.
- A thread message reaches a running thread at its next turn only; mid-turn delivery is staged.
- The phone layout of the side tree is not designed; the tree is a fixed 280-point column.

### Checks

- Automated with the fake harness: opening by owner and thread with copied settings and overrides; depth and running limits; results to the parent and Done; message reach and refusal; delivery and waking; Waiting; Stop without cascade, kept messages, and Resume.
- Live: one Claude Code mission that opens a thread, gets its result, and reports.
- Driven in the window: the side tree, selecting threads, writing to a child, Stop and Resume.

## Batch 6: delivered

Interrupts and steering, agreed in CHG-0039 and delivered in CHG-0040 after the owner accepted the composer. Built test-first and driven in the window on the fake harness (Claude Code's session limit stopped the live drive): [proof](verification/2026-11-06-steering.md). Sources: thread-messaging specifications (Delivery, Interruptions, Thread tools) and the Claude Code probe recorded in CHG-0039.

### Behavior

- **Steering**: a message to a running thread joins its current turn after the current tool call: thread messages and results always, the owner's when steered. A message counts as delivered when the harness takes it in; one written but not taken in before the turn ends starts the next turn.
- **Queuing**: an owner message sent as Queue waits for the thread's next turn; the conversation marks it Queued until then.
- **Composer**: while a thread runs, Send uses the owner's default (Steer unless changed in Settings) and a smaller second button does the other; an Interrupt button sits next to them.
- **Interrupt**: by the owner (any running thread) or by a thread (`interrupt_thread`, a running thread directly beneath it; others refused with the reason). The turn ends, its open questions are withdrawn, and the thread becomes Done if it reported its result in that turn, Waiting while threads beneath it are Running or Waiting, otherwise Idle. Undelivered messages start its next turn. Stop is unchanged.

### Provisional, until decided

- A message written to Claude Code but not taken in before the turn's result closes the process, so Claude Code does not run it on its own; the next turn resumes the session and sends it again. If the process had already taken it in when closed, the model may see it twice.
- An interrupt that Claude Code does not confirm within 10 seconds closes the process.

### Checks

- Automated with the fake harness: steering owner and thread messages, queuing, the default setting, interrupts by the owner and by a parent with refusals, the state after an interrupt, and undelivered messages starting the next turn.
- Automated with the Claude Code stand-in: the stream-json steering message with its identifier, delivery on echo, closing on an untaken message, and the interrupt control request.
- Live: one Claude Code thread steered mid-turn and one interrupted.
- Driven in the window: Send and Queue while running, the Queued mark, Interrupt, and the default setting.

## Batch 7: delivered

Folding agent-opened threads, deleting, and the chatter guard, agreed in CHG-0041 and delivered in CHG-0042 after the owner accepted its look; the interface gets its own pass later (backlog, Interface pass). Built by Codex (`gpt-6-astra`) at the owner's request; verified and driven in the window on the fake harness: [proof](verification/2026-11-06-batch-7.md). Sources: thread-tree specifications (Threads opened by agents, Deleting) and thread-messaging specifications (Chatter guard).

### Behavior

- **Folding**: Settings **Show threads opened by agents**, on by default; settings saved before it read on. When off, the side tree folds each agent-opened thread into the thread that opened it, which shows "+N threads" (all folded threads beneath it, at any depth) and unfolds when selected. A folded thread whose state is Attention or Failed still appears. Folding is view only.
- **Deleting**: "Delete" on the selected thread. One confirmation: "Delete this thread?" or "Delete this thread and N threads beneath it (M running)?". Running threads are stopped first, open questions withdrawn. Deleting the top thread deletes the mission and returns to the dashboard. Permanent: threads, turns, messages, questions erased; for a mission also its scratch folder and mission-scoped standing permissions. A workspace folder is never touched. Messages other threads sent to deleted threads are erased with them; a thread whose parent is deleted is deleted with it, so no orphan remains.
- **Chatter guard**: a count per unordered pair of threads of messages between them (thread messages and steered thread messages; results do not count). A message from the owner to either thread or a result reported between them resets it. At the threshold (Settings, default 20, minimum 2), both threads enter Attention with the notice "<A> and <B> exchanged 20 messages without you" and the choices **Let them continue** and **Stop both**; messages between them past the threshold are kept undelivered. Let them continue resets the count, leaves Attention, and delivers the kept messages. Stop both makes both Stopped with messages kept. Simultaneous sends at the threshold trip the guard once. A pause ends both threads' running turns; a message a turn already took in may get no answer (the owner kept this on 2026-11-06).

### Checks

- Automated with the fake harness: the folding setting and its default; the tree query exposing what folding needs; deletion of a subtree with count, running threads stopped, questions withdrawn, mission deletion with scratch folder and permissions, workspace folder untouched; chatter count, reset by owner message and by result, trip at threshold for both threads, kept messages, Let them continue, Stop both, simultaneous sends at the threshold, the adjustable threshold.
- `bun run test`, `bun run typecheck`, `bun run check`, desktop build.
- Driven in the window: fold and unfold, a folded thread reappearing in Attention, delete with the count, the chatter notice and both choices.
- Owner's look: the "+N threads" mark, the delete confirmation, the chatter notice.

## Batch 8: delivered

The mission journal, agreed in CHG-0043 and delivered in CHG-0044 after the owner accepted its look, built here test-first and driven in the window with Claude Code (Haiku): [proof](verification/2026-11-06-journal.md). Sources: mission-journal specifications; thread-tree specifications (Opening a thread).

### Behavior

- **Journal**: one per mission, created with it: a briefing (empty at first, version 0) and a change log. Entries carry their author (a thread with its title, or the owner) and time, and are never edited or deleted.
- **Limit**: the briefing holds at most the Settings value **Briefing limit** (default 2,000 tokens), estimated at 4 characters per token; a rewrite over it is refused with its reason.
- **Thread tools**: `read_journal` (optional `before`, an entry number, and `count`, default 20) answers with the briefing, its version, and those entries. `update_journal` takes `entry` and optionally `briefing` with `basedOn`, the version it was based on; a rewrite without `basedOn`, or with a version older than the current one, is refused with the current briefing and version.
- **Results**: `report_result` requires `journal`, an entry or exactly "nothing to record"; a missing one is refused with the reason. The entry is added before the result is delivered.
- **Starting context**: every turn's context carries the briefing and the 20 latest entries. A thread opened beneath another also carries its opener's messages since the journal's latest entry, captured when it was opened.
- **The owner**: a Journal link in the mission header opens the Journal view: the briefing with Edit, the entries newest first, and a box to add an entry. A rewrite by the owner adds the entry "Rewrote the briefing" unless the owner writes one.

### Provisional, until decided

- The opener's messages are capped at the 40 latest, with a line saying how many earlier ones were left out; summarizing is staged (thread-tree, Opening a thread).

### Checks

- Automated with the fake harness: journal created with a mission; entry with author and time; briefing rewrite with its entry; over-limit refusal; stale rewrite refused with the current briefing, then accepted; `read_journal` paging; `report_result` refusing a missing `journal` and recording the entry; the starting context with the briefing, 20 latest entries, and the opener's messages; no tool or route edits or deletes an entry; the owner's edits recorded as entries by the owner; deleting a mission erases its journal.
- `bun run test`, `bun run typecheck`, `bun run check`, desktop build; mutation check.
- Driven in the window with Claude Code (Haiku): a thread updating the journal, a child opened from it starting with the briefing, and the owner editing the briefing.
- Owner's look: the Journal view and the Briefing limit setting.

## Batch 9: delivered

Mission tracking, agreed in CHG-0045, built here test-first. Sources: mission-tracking specifications; mission-journal specifications (When a mission ends).

Status (2026-11-06): implemented and committed in `8e05eb0`. Tests pass (175, five opt-in live checks skipped), typecheck, lint, desktop build. Recovered mutation evidence catches 15/15 mutations. The window drive on the fake harness proved the dashboard row ending actions (Mark as done with the stop confirmation, Cancel, Archive, Reopen from Archived), rename and the refused `set_mission_title`, workspace and state filters, search, the Mark as done? question with Not now, and writing in a Done mission: [proof](verification/2026-11-06-mission-tracking.md). Visual polish is deferred by the owner. Accepted by the owner and delivered in CHG-0046.

### Behavior

- **Mission state**: the most urgent of its threads' states (Attention, Failed, Running, Waiting, Idle), or Done or Archived once ended. Done and Archived are set only by ending.
- **Mark as done?**: when the top thread reports its result, the dashboard asks "Mark as done?" with **Mark as done** and **Not now**. The mission does not end on its own; a later result asks again.
- **Ending**: **Mark done** and **Archive** in the mission header; an archived mission's header offers **Reopen**. With threads still at work (Running, Waiting, or Attention), one confirmation, for example "2 threads are still running. Stop them and mark as done?", then they are stopped.
- **Inactivity**: after **Ask after inactive days** (Settings, default 14) without a turn or message, the dashboard asks of a mission not ended "Archive it or mark it as done?" with **Archive**, **Mark as done**, **Not now**. Not now brings it back after another such period without activity.
- **Auto-archive**: Settings **Archive done missions automatically**, off by default, after **days after done** (default 30).
- **Archived view**: from the dashboard header; lists archived missions with Reopen. Reopening, or the owner writing in a thread of a Done or archived mission, returns it to the state worked out from its threads.
- **Journal**: "Marked done by the user", "Archived by the user", "Archived automatically", "Reopened by the user".
- **Title**: `set_mission_title` from the top thread only, whose instructions ask for a short title on its first turn; refused once the owner renamed the mission from its header. The top thread's title follows the mission's.
- **Prefilled choices**: model, effort, and workspace of the last mission started; the Settings defaults before any.
- **Dashboard**: missions in Attention or Failed first, then by latest activity; each row shows title, state, workspace, thread count with running count, usage, last activity. Filters by state and workspace; search over titles and briefings.
- **Out**: budget rings, the phone web app, `find_missions`.

### Provisional, until decided

- "Still running" in the ending confirmation counts threads Running, Waiting, or in Attention, so no question stays open on an ended mission.
- "Need the user" in the dashboard order means Attention or Failed; the questions above the list are not counted.
- The inactivity question is not asked of a Done mission; auto-archive covers those.
- Auto-archive runs at startup and then hourly.

### Checks

- Automated with the fake harness: state urgency; the top thread's result asking Mark as done without ending, Not now; the inactivity question after the set duration, agent activity resetting it, a dismissed question coming back; the confirmation counting threads at work and stopping them; ending and reopening journal entries; auto-archive off by default and archiving after the set duration when on; writing in a Done or archived mission bringing it back; the Archived view and Reopen; the proposed title, the rename, and `set_mission_title` refused afterwards and from other threads; prefilled choices; dashboard order, state and workspace filters, title and briefing search.
- `bun run test`, `bun run typecheck`, `bun run check`, desktop build; mutation check.
- Driven in the window: 3 missions, the one needing the owner first, Mark done, archive, reopen, rename, filters and search.
- Owner's look: the dashboard questions, filters, Archived view, and the header actions.

## Batch 10: delivered

Status (2026-11-06): committed in `083003f`; 13/13 mutations caught; driven in the window on the fake harness: [proof](verification/2026-11-06-off-topic.md). Agreed as built with its provisional choices, and accepted, in CHG-0047; the owner adjusts after the MVP. Not run: the live check with Claude Code.

Off-topic requests (thread-tree, Off-topic requests; CHG-0045 staged `find_missions`). Chosen by an agent under the owner's instruction of 2026-11-06 ("build what is next", no questions this session); not yet agreed by the owner. Sources: thread-tree specifications (Off-topic requests, External contract, Acceptance).

### Behavior

- **Judging**: every thread's instructions say that a message from the owner that clearly shares nothing with the mission, judged against the briefing, is not answered: the thread calls `find_missions`, then `suggest_mission`, then carries on as if the message had not been sent.
- **`find_missions`** (the request): up to 3 other missions whose titles or briefings share words with the request, best first, each with its id, title, state, and briefing. Every mission not deleted counts, Done and Archived included; the caller's own mission does not.
- **`suggest_mission`** (the off-topic part, a proposed title, the matching missions' ids): the thread enters Attention and its conversation shows the suggestion with **Continue in "title" · state** for each match (at most 3), **Open as new mission** with model and effort prefilled from the thread, and **Keep as aside**. The answer tells the thread where the message went.
- **Continue in**: the off-topic part goes to that mission's top thread as the owner's message, steered or queued by the default delivery, waking it.
- **Open as new mission**: a mission whose top thread starts with only the off-topic part, the proposed title, no workspace, an empty journal.
- **Keep as aside**: a thread beneath the current one, marked as an aside, whose first message is the off-topic part from the owner. Its instructions carry the note that the message went off topic and was put aside, and the rule to message its parent with what is relevant when the conversation comes back to the mission. An aside does not update the journal: `update_journal` is refused and its result records no entry.
- **Link left behind**: the original thread shows a line "Continued in mission: X", "Moved to mission: X", or "Kept as aside: X" that opens it.
- **Setting**: **Open off-topic requests as new missions without asking when no mission matches**, off by default.
- **Withdrawal**: Stop, Interrupt, a failed turn, or a restart withdraw an open suggestion, as with questions.

### Provisional, kept until after the MVP

- Matching is word overlap on titles (counted twice) and briefings; no semantic search.
- The suggestion shows in its thread only, not in the dashboard's open-questions list; its mission comes first on the dashboard as Attention.
- An aside starts with the whole journal context (briefing and latest entries), not the briefing alone, and without its opener's messages.
- A new mission opened from a suggestion does not change the dashboard's prefilled choices.
- The aside is not folded with agent-opened threads: the owner chose it.

### Checks

- Automated with the fake harness: matches by title and briefing, Done and Archived included, own and deleted missions excluded, at most 3 best first; the suggestion in Attention; Continue in waking the chosen mission; a refused Continue to a mission not offered; the new mission's fresh start; the aside's first message, context, and journal refusal; the link left behind; the setting with and without matches; withdrawal on Stop; the instructions.
- `bun run test`, `bun run typecheck`, `bun run check`, desktop build.
- Driven in the window on the fake harness: the three choices and the setting.

## Batch 11: delivered

Status (2026-11-06): committed in `083003f`; 16/16 mutations caught; driven in the window on the fake harness: [proof](verification/2026-11-06-budgets.md). Agreed as built with its provisional choices, and accepted, in CHG-0047; the owner adjusts after the MVP. Not run: the live check with Claude Code's usage.

Budget control (budget-control specifications), chosen by an agent under the owner's instruction of 2026-11-06 ("Go for next feature", no questions); not yet agreed by the owner. Control and the phone web app do not exist yet, so Control's budget, its event lines, and phone notifications are out.

### Behavior

- **Budgets**: two optional limits, cost (API-key spending) and tokens (subscription spending); empty means none; tokens never priced. Each mission has one, for its whole life; one global budget covers all missions over a period: Day, Week, or Month (default), starting at local midnight, Monday, or the 1st.
- **Settings**: a default mission budget, empty at first, copied onto each new mission; the global budget and its period, empty at first.
- **Mission budget**: set, changed, or removed from the mission's budget window; only the owner, no thread tool.
- **Seeing use**: a mission with a budget shows a meter per limit, orange from 80%, red at 100%; without one, only its spending. The global meters sit at the top of the dashboard. The budget window shows used of limit and the split by thread.
- **Budget line**: each turn's context carries one line, for example "Budget: 12,000 of 50,000 tokens used (24%); global: 61% of this month's tokens". Left out with no budget at all.
- **Reaching a limit**: when a turn's spending reaches the mission's limit, every running thread of the mission stops its turn and goes to Attention; the thread that reached it shows **Raise budget** and **Stop**. At the global limit, every running thread stops, with one shared question at the top of the dashboard: **Raise budget** or **Stop all**. Raise budget opens the limit with +25%, +50%, double, and remove; once under the limit, the stopped threads resume on their own, their interrupted messages delivered again. Stop leaves them Stopped. A message to a thread under a reached budget waits in Attention the same way.
- **Refusals**: at a reached limit `open_thread` is refused with the reason; at the global limit starting a mission is refused with the reason.
- **Lowering** below what is spent stops running threads the same way.
- **Record**: each change (set, raised, lowered, removed) and each stop at a limit is a line in the mission's top thread, for example "Budget raised to 75,000 tokens · 14:02".

### Provisional, kept until after the MVP

- Claude Code counts as subscription spending: its turns count in tokens (input, output, cache writes, and cache reads); a cost is counted only from a harness that reports one (the fake harness). Detecting API-key billing is staged.
- Spending is counted when a turn ends, as Claude Code reports it then; a turn can go over before it stops.
- The budget window splits by thread only: Claude Code is the only provider.
- Global budget events have no line (Control holds them, and Control does not exist yet).
- A thread released after a raise becomes Idle and runs its kept messages; a thread that had reported its result in the reaching turn is not set Done again.
- Meters are thin bars, not rings, until the interface pass.

### Checks

- Automated with the fake harness reporting spending (`spend <tokens> [cost]`): limits counted separately; empty limits never stop; every thread drawing on the mission; mission and global counting; the default budget applied; changing a mission's budget; period starts for day, week, month; a reached limit stopping running threads in Attention with the question; Raise (resume) and Stop; the global limit with one question; `open_thread` and starting a mission refused; lowering below spending; the budget line present and absent; the lines recorded.
- `bun run test`, `bun run typecheck`, `bun run check`, desktop build; mutation check.
- Driven in the window on the fake harness: a budget set, meters turning orange then red, the stop question, Raise by 50%, threads carrying on.

## Review, fixes, and architecture after batch 11 (2026-11-06)

Fixed point `63d4b15` to `083003f`, reviewed on two axes, then fixed and refactored at the owner's request ("Fix everything"). Uncommitted. Report: [architecture-audit-2026-11-06-1959.html](architecture-audit/architecture-audit-2026-11-06-1959.html); proof: [verification](verification/2026-11-06-review-fixes.md); recorded in CHG-0048.

### Fixed, test-first

- P1 Stop at a budget and Stop both on chatter now return a parent left Waiting to Idle, as every Stop does.
- P2 Deleting threads or a mission keeps their spending (migration 0015).
- P3 Threads held at the global limit are released when the period starts over.
- P4 The budget line is given with each turn's message, not in the system prompt, so it no longer restarts Claude Code.
- P5 The no-ask off-topic setting matches on the service side.
- P6 Tests cover withdrawal on Interrupt and on restart; a thread not at work is told it was not asked.
- P7 Ending a mission refuses Done again and Archived to Done.
- P8 Holding at a lowered budget leaves another reason, or a failure, in place.
- R1 (found while checking P8) A message to a Failed thread under a reached budget waits in Attention and runs once the budget is raised.

### Provisional, until the owner decides

- The budget window shows spending of deleted threads as one part "Deleted threads", and of deleted missions as "Deleted missions".
- The budget line is the first paragraph of the turn's first message to Claude Code.
- "Archived automatically" keeps the user as its author: the journal's authors are a thread or the user.
- The global period release checks at each period start and at least hourly.

### Still open

- A failed turn's suggestion withdrawal has no automated test: the fake harness cannot fail during a call.
- Files over about 250 lines: `claude.ts`, `threads.ts`, `approvals.ts`, `requests.ts`, `conversation.tsx`, `service.ts`, `store.ts`, `records.ts`, `suggestions.ts`. Most of `claude.ts`, `threads.ts`, `approvals.ts`, and `store.ts` predates this work.
- Not verified live: a Claude Code turn with the budget line in its message.

## Batch 12: built, awaiting the owner

Scoped intel (scoped-intel specifications), chosen by an agent under the owner's instruction of 2026-11-06 ("build what is next", no questions this session); not yet agreed by the owner. Built test-first and driven in the window on the fake harness: [proof](verification/2026-11-06-scoped-intel.md). Uncommitted, on `554a28c`. Recorded in CHG-0049.

### Behavior

- **Scopes**: an intel belongs to a thread (and the threads beneath it), a workspace, or global; intel on the mission's top thread applies to the whole mission.
- **Thread tools**: `save_intel` (text, scope `thread`, `mission`, `workspace`, or `global`), `search_intel` (query, optional scope), `update_intel` (id, text, wider scope, or both), `forget_intel` (id).
- **Saving**: thread, mission, and workspace intel are saved at once and shown in the thread as a line; a global save answers "Awaiting approval" and shows as a card with **Approve** and **Decline** in its thread and in the intel panel. At most 200 tokens per intel (4 characters per token). Workspace intel is refused for a thread without a workspace.
- **Recall**: every turn's context carries all the intel in the thread's scope, most specific first, saying the first listed wins a conflict, with the rules: narrowest scope, a rule the owner gives in a chat saved without asking, correct, delete, propose widening, and where the mission stands belongs in the journal.
- **Correcting and deleting**: a thread changes or deletes thread and workspace intel in its scope at once; a change to or deletion of global intel waits for approval; intel outside its scope is refused.
- **Widening**: `update_intel` with a wider scope waits for approval; a narrower or equal scope is refused.
- **Size warning**: Settings **Intel warning** (default 10%); the thread header's **Intel · N · P%** turns red when the intel in scope takes more than that share of the model's context window, and opens the intel panel for that thread.
- **Intel panel**: from the thread's intel icon (that thread's scope, most specific first, with its gauge) or the dashboard's **Intel** link (all intel). Changes awaiting approval first, then each intel with scope, saver, time, and size; filters All, Thread and mission, Workspace, Global; **Edit** and **Delete** on any intel.
- **Deleting a thread** erases its own intel and its changes, awaiting or done.

### Provisional, until the owner decides

- Every model counts a 200,000-token context window until harnesses report theirs (backlog, Thread panel and context gauge).
- `mission` is a scope name for threads: thread intel on the top thread. Widening counts thread, mission, workspace, global in that order.
- A global change waits without blocking the thread, which carries on; the thread is not told the owner's decision, and an approved intel reaches it at its next turn.
- Approving a change to an intel deleted meanwhile records it as declined.
- The owner's edits and deletions apply at once and leave no line in a thread; the owner cannot add intel from the panel.
- `search_intel` matches shared words, as `find_missions` does; no full-text index yet.
- Intel recall is part of every turn's context, like the journal, not only a new thread's first turn.

### Staged

- **Tidy up intel** from the panel (scoped-intel, Intel panel).
- The warning before a thread starts with too large a starting context (thread-tree, Opening a thread).
- Standing permissions for global intel changes (scoped-intel, Requirements).

### Checks

- Automated with the fake harness: 19 checks in `intel.test.ts`; 2 label checks.
- `bun run test` (237 passed, 5 skipped), `bun run typecheck`, `bun run check`, desktop build, Metro web export; 12 of 12 mutations caught.
- Driven in the window on the fake harness: see the proof.
- Not run: a live Claude Code thread using the intel tools.

## Batch 13: built, awaiting the owner

Part of the agreed intel-over-time rules (CHG-0050, scoped-intel Kinds, Recall, Fading, intel panel, ranked search), chosen by an agent under the owner's instruction of 2026-11-06 ("build what is next", no questions this session). Starts from `5901f13`, uncommitted. Built test-first on the fake harness and its test clock and driven in the window: [proof](verification/2026-11-06-intel-over-time.md). Recorded in CHG-0051.

### Behavior

- **Kinds**: `save_intel` takes a kind (rule, preference, decision, fact, temporary). Half-lives in Settings (**Intel half-lives**, days): preference 90, decision 45, fact 45, temporary 3; a rule never fades. The context tells threads to save a rule the owner gives in a chat as a rule.
- **Pinning**: the owner pins or unpins any intel in the panel; a pinned intel never fades.
- **Fading**: strength = 0.5 ^ (days since last use or save ÷ (half-life × (1 + log2(1 + uses)))). Below 0.15 dormant, below 0.05 archived. Worked out when read, so nothing runs on a timer.
- **Uses**: each intel `search_intel` returns counts one use and becomes active again. Being in the context is not a use.
- **Recall**: every turn's context carries active thread, mission, and workspace intel in full, most specific first; active global intel as an index, one line each (identifier, kind, a short summary), oldest first so a new one is added at the end; then how many dormant intels in scope are not listed.
- **Search**: `search_intel` takes words, identifiers, or both, optionally a scope; it searches active and dormant intel in scope, never archived, ranks by shared words with a word found in three intels or fewer counting three times, then by scope, most specific first; it answers with each intel's identifier, scope, kind, and full text.
- **Gauge**: counts what the context carries: active intel in full plus the index lines.
- **Intel panel**: each intel shows kind, strength, state, uses, and whether pinned; filters by state (All, Active, Dormant, Archived, Pinned) next to the scope filters; **Pin**/**Unpin** and, for dormant or archived intel, **Restore** (strength back to full, not counted as a use).

### Provisional, until the owner decides

- A short summary is the text's first 80 characters, cut at a word, with "…".
- Restoring sets the last use to now without counting a use.
- An owner edit, a correction, or a widening is not a use.
- A global save awaiting approval keeps its kind; approval saves it with that kind.

### Staged, next intel batch

- Duplicates saved as replacements; history with undo, including fading steps; widening and narrowing proposed from evidence; Tidy up intel and its routine; a thread saying it relied on an intel counting as a use; the journal entry or message an intel rests on.

### Checks

- Automated: 15 checks in `intelOverTime.test.ts` on the test clock; 1 label check; batch 12's intel checks save as fact; a migration check of 0017 in the proof's folder.
- `bun run test` (253 passed, 5 skipped), `bun run typecheck`, `bun run check`, `git diff --check`, desktop build, Metro web export; 20 of 20 mutations caught in a separate worktree; the proof reproduced by a fresh-context agent.
- Driven in the window on the fake harness, days simulated in the database: see the proof.
- Not run: a live Claude Code thread using kinds, the index, and search.

## Batch 14: built, awaiting the owner

Replacing duplicates, origins, and relying on intel (scoped-intel Duplicates, Saving, Fading), chosen by an agent under the owner's instruction of 2026-11-07 ("build what is next", no questions this session). Starts from `7b6ee2e`, uncommitted. Built test-first on the fake harness and its test clock and driven in the window: [proof](verification/2026-11-07-replacing-intel.md). Recorded in CHG-0052.

### Behavior

- **Replacing**: before a save, the service compares it with the active and dormant intel in the thread's scope, in the save's scope or wider. One in the same scope that is close enough is replaced: it keeps its identifier and uses, takes the new text and kind, and is at full strength again. The answer says "Replaced intel <id>" with the old text. A global replacement waits for approval; its card shows "Was:" with the old text and the new one. The change is a new kind, Replace, shown in the thread as "Replace intel in <scope>".
- **Close intels**: a save that replaces nothing still names up to 3 close intels in its answer, in the same or a wider scope, so the thread can correct or delete one that is outdated.
- **Origins**: `save_intel` takes an optional `journalEntry`, the number of the journal entry it rests on; a number that does not exist refuses the save. Without one, the latest message delivered to the thread is recorded, from the owner or a thread. The origin is copied as an excerpt of at most 80 characters, so it outlives the message's thread. A global save keeps its origin until approved. The panel shows "From journal entry N: …", "From your message: …", or "From a message by "<thread>": …".
- **Relying**: `relied_on_intel` with ids counts one use of each intel in the thread's scope that is not archived; the rest are named as refused, and a call where none counts is an error. The context asks threads to call it when an intel from their context shaped what they did.

### Provisional, until the owner decides

- Closeness is shared meaningful words, as `search_intel` matches them: twice the shared words over both texts' words. A replacement needs 0.6 and at least 2 shared words; a close intel needs 0.3. There is no semantic matching.
- Only an intel in the same scope is replaced. A narrower intel that differs from a wider one is an override, since the most specific scope wins, so a wider intel is named, not replaced. The specification says "the same scope and the scopes above it"; this reads it as where to look, not what to replace.
- An archived intel is never replaced; a new intel is saved beside it.
- A replacement restates the intel: its last use becomes now, without counting a use, and its origin becomes the new one.
- A replacement's kind is the new save's kind.
- Each `relied_on_intel` call counts, even for an intel already searched in the same turn.
- `relied_on_intel` is a fifth intel tool, not listed in the specification's contract before this batch; the contract now lists it.

### Staged, next intel batch

- History with undo, including fading steps and which intel replaced which; widening and narrowing proposed from evidence; Tidy up intel and its routine.

### Checks

- Automated: 13 checks in `intelReplacing.test.ts` on the test clock; 2 label checks; a two-step migration check of 0018 in the proof's folder.
- `bun run test` (267 passed, 5 skipped), `bun run typecheck`, `bun run check`, `git diff --check`, desktop build, Metro web export; 20 of 20 mutations caught in a separate copy; the new checks fail on `7b6ee2e`.
- Driven in the window on the fake harness: see the proof.
- Not run: a live Claude Code thread using replacements, `journalEntry`, and `relied_on_intel`.

## Batch 15: built, awaiting the owner

Intel history with undo (scoped-intel, History and undo), chosen by an agent under the owner's instruction of 2026-11-07 ("build what is next", no questions this session); not yet agreed by the owner. Starts from `7b6ee2e` with batch 14 still uncommitted on top; uncommitted. Built test-first on the fake harness and its test clock and driven in the window: [proof](verification/2026-11-07-intel-history.md). Recorded in CHG-0053.

### Behavior

- **History**: every intel keeps its history, newest first: saved, replaced, corrected, widened, deleted (by a thread, approved or not), edited, deleted, pinned, unpinned, restored (by the owner), became dormant, became archived (by fading), and undone. Each entry says who or what made it (a thread with its title as then, you, or fading) and when; a thread's global change says when the owner approved it. A replacement shows the text it replaced ("Was: …") and the thread whose save replaced it.
- **Fading steps**: worked out from the intel's strength, so nothing runs on a timer. The time an intel crossed dormant or archived is recorded when something resets its fading (a use, a restore, a replacement, a pin, a deletion), so a step stays in the history after the intel is active again; steps not yet recorded are shown from the current strength.
- **Undo**: **Undo** on any entry the owner or a thread made puts back what that change changed, as a new entry "Undid …" by the owner, itself undoable. Undoing a save deletes the intel; undoing a deletion restores it with its identifier, uses, and origin. An entry already undone shows no Undo. Undoing a change to an intel that is deleted is refused until its deletion is undone. Fading steps have no Undo: Restore covers them.
- **Panel**: each intel has **History**, which lists its entries with Undo; the state filter gains **Deleted**, listing deleted intels with their history and **Undo deletion**.
- **Thread deletion** erases its own intel's history, deleted ones included.

### Provisional, until the owner decides

- Undo restores the fields the change changed (text, kind, scope, pin, origin) whatever happened since; its last use is put back only when no use came after the change; uses are never taken back.
- Fading steps are worked out with the current half-lives, so changing a half-life moves steps not yet recorded.
- Intel saved before this batch starts its history with one "Saved" entry; earlier changes are not in it.
- A thread's change awaiting approval is not in the history until approved; a declined one never is.
- History entries a deleted thread made on a workspace or global intel stay, with the thread's title as then.
- Deleting an intel by undoing its save declines its changes awaiting approval, as the owner's deletion does.

### Checks

- Automated: 16 checks in `intelHistory.test.ts` on the test clock; 2 label checks; a two-step migration check of 0019 in the proof's folder.
- `bun run test` (285 passed, 5 skipped), `bun run typecheck`, `bun run check`, `git diff --check`, desktop build, Metro web export; 22 of 22 mutations caught in a separate copy.
- Driven in the window on the fake harness, days simulated in the database: see the proof.
- Not run: a live Claude Code thread whose intel changes appear in the history.

### Staged, next intel batch

- Widening and narrowing proposed from evidence; Tidy up intel and its routine.

## Batch 16: built, awaiting the owner

Widening and narrowing proposed from evidence (scoped-intel, Widening and narrowing), chosen by an agent under the owner's instruction of 2026-11-07 ("build what is next", no questions this session); not yet agreed by the owner. Starts from `b94771f`, uncommitted. Built test-first on the fake harness and its test clock and driven in the window: [proof](verification/2026-11-07-intel-proposals.md). Recorded in CHG-0054.

### Behavior

- **Uses by workspace**: each use (`search_intel`, `relied_on_intel`) is recorded with the using thread's workspace, or none.
- **Widening proposal**: when workspace intels in two or more workspaces say the same thing (the replacement closeness of batch 14), the intel panel proposes one global intel in their place, with the newest text and kind, listing each.
- **Narrowing proposal**: when a global intel was saved at least its kind's half-life ago and every use recorded over the last half-life came from threads of one workspace (at least one use), the panel proposes moving it to that workspace.
- **Nothing before approval**: a proposal changes nothing; **Approve** applies it, **Decline** removes it for good.
- **Applying a widening**: the newest intel becomes global ("Widened"), takes the sum of uses and the latest use; the others are merged into it ("Merged"), listed under Deleted, and their uses count for it.
- **Applying a narrowing**: the intel moves to the workspace ("Narrowed").
- Both are undoable from History like any change; a proposal no longer backed by evidence is refused.

### Provisional, until the owner decides

- Proposals are worked out from evidence when the panel is read, like fading; only decisions are stored. A declined proposal is the same set of intels (widening) or the same intel and workspace (narrowing); a new intel joining the set makes a new proposal.
- "Its whole half-life" is the kind's half-life in Settings, without the growth from uses; a rule never fades, so it is never narrowed. Uses before this batch have no workspace and do not count.
- No widening is proposed when a global intel already says the same thing.
- History entries of an applied proposal are the owner's, since the owner approved them.
- Archived intel is left out of both.

- A merged intel shows under Deleted as deleted; its history says merged.

### Checks

- Automated: 15 checks in `intelProposals.test.ts` on the test clock; 2 label checks; a two-step migration check of 0020 in the proof's folder.
- `bun run test` (302 passed, 5 skipped), `bun run typecheck`, `bun run check`, `git diff --check`, desktop build, Metro web export; 17 of 17 mutations caught in a separate copy; the new checks fail 15 of 15 on `b94771f`.
- Driven in the window on the fake harness, days simulated in the database: see the proof.
- Not run: a live Claude Code thread whose uses become evidence.

### Staged, next intel batch

- Tidy up intel from the panel; its routine waits for routines.

## Batch 17: built, awaiting the owner

The warning before a thread starts with too large a starting context (thread-tree, Opening a thread; agreed in CHG-0007), chosen by an agent under the owner's instruction of 2026-11-07 ("build what is next", no questions this session); not yet agreed by the owner. Starts from batch 16's uncommitted state on `b94771f`. Built test-first on the fake harness and driven in the window: [proof](verification/2026-11-07-starting-context.md). Recorded in CHG-0055.

### Behavior

- **Preview**: while the owner types the first message of a thread opened beneath another, the form shows what it would start with (`PreviewStartingContext`): the request, the briefing and 20 latest entries, the intel in scope (scoped intel in full and the global index), the opener's messages since the journal's latest entry, and, since the architecture pass (CHG-0062), the workspace's own instructions, the instructions every thread receives, and the title and budget lines, each in estimated tokens. It measures the same sections the thread then receives, headings included (`startingContext.ts`).
- **Warning**: past 25% of the chosen model's context window, the form says the size, the share, and each part, and offers a model with a larger window, **Trim intel**, and **Start anyway**.
- **Trim intel** opens the intel panel of the parent's scope inside the form; the typed request stays, and the preview follows each change.
- **Refusal**: `OpenThread` is refused over the warning unless the owner chose Start anyway (`shouldStartAnyway`); the refusal names the share.

### Provisional, until the owner decides

- The warning share is fixed at 25%, as specified; it is not a setting.
- Every model counts 200,000 tokens (Batch 12), so no larger model is ever offered: the form says "No model has a larger context window."
- Threads opened by agents (`open_thread`) and asides are not warned: no owner is there to answer before they start.
- Starting a mission is not warned yet; its context is the first message, the workspace's and global intel.
- Skills are not counted: threads have none until tool-and-skill-loading.
- The parts are measured as tokens of their text (characters / 4), like the briefing limit. Since CHG-0062 the instructions every thread receives, the workspace's instructions, and the title and budget lines are counted too, so the warning measures what the harness receives; this reverses the earlier choice not to count the instructions and awaits the owner.
- The preview is asked for 300 ms after typing pauses.

### Checks

- Automated: 9 checks in `startingContext.test.ts`; 2 label checks.
- `bun run test` (311 passed, 5 skipped), `bun run typecheck`, `bun run check`, `git diff --check`, desktop build, Metro web export; 13 of 13 mutations caught in a separate copy; the new checks fail 8 of 9 on the batch 16 state.
- Driven in the window on the fake harness: see the proof.
- Not run: a live Claude Code thread.

### Staged

- Summarizing the oldest part when a starting context exceeds the model's window (thread-tree, Opening a thread).
- The warning when starting a mission.

## Open questions, settled when a batch needs them

- Dependency gates and fake-first live launch (first-slice-design, Dependency gates).
- Recovery of turns interrupted by a crash or restart, and uncertain delivery.
- Idle as the mission state when no thread is urgent, including all Done or Stopped.
- Claude Code protocol verification; installed version 2.1.302.

## Batch 18: built, awaiting the owner

Harnesses and provider accounts ([provider-accounts](capabilities/provider-accounts/specifications.md)), chosen by an agent under the owner's instruction of 2026-11-07 to make Iskios usable to build Iskios with Claude Code (several accounts), Codex, and OpenCode, without questions. Starts from `ab85b66`. Built with stand-in checks first, then probed and driven live: [proof](verification/2026-11-07-harnesses-and-accounts.md). Recorded in CHG-0059.

### Behavior

- **Harness per thread**: Claude Code, Codex, or OpenCode, chosen at mission start and when opening a thread; `open_thread` takes `harness`. Kept for the thread's life.
- **Accounts**: the computer's own sign-in and accounts added in Settings, each a folder the harness uses as its home (ADR 0011). Sign in opens the harness's own login in Terminal. Remove refused while a mission not ended uses the account.
- **Models**: free identifiers per harness (`ModelChoice` is now a string), listed by each harness; "default" is the harness's own.
- **Adapters**: `codex.ts` (app server, JSON-RPC without the `jsonrpc` field) and `opencode.ts` (ACP), over `rpcProcess.ts`; `routeHarnesses` picks the adapter per turn.

### Provisional, until the owner decides

- Codex runs `workspace-write` with `on-request` approvals at the default level and `untrusted` at "Also commands and edits"; its escalations go to `answer_prompt` as a Bash prompt, file changes as Edit, sandbox widenings as "Permissions".
- OpenCode asks for every shell command (no sandbox) and, at the stricter level, every edit; its subagents are denied. Its starting context is written to `$TMPDIR/iskios-opencode/<thread>.md` and given as `instructions`.
- The owner's own Codex and OpenCode settings (their MCP servers, skills, agents) still load in threads; Claude Code's stay off as before.
- Codex threads are not ephemeral: they appear in the owner's Codex history; OpenCode sessions in OpenCode's.
- OpenCode takes no effort; a steered message waits for its next turn.
- Codex and OpenCode report no cost: their turns count as subscription tokens (budget-control, Batch 11).
- Every model counts a 200,000-token window (Batch 12); larger-window suggestions come from the chosen harness's model list, which only Claude Code has, so Codex and OpenCode suggest none (CHG-0062).
- The Codex model list is cached 10 minutes per account; sign-in states are read when Settings or a picker opens, and on Refresh.
- Sign-in on Linux and Windows answers with the command to run in a terminal.
- `approvals.ts` still tells an allowed thread to set `dangerouslyDisableSandbox` for Bash, which only Claude Code has; the instructions themselves leave it out for Codex and OpenCode.

### Checks

- Automated: 21 checks in `harnesses.test.ts` on stand-ins; 3 opt-in live checks in `liveHarnesses.test.ts` (`ISKIOS_LIVE_HARNESSES=1`, `ISKIOS_LIVE_OPENCODE_MODEL`).
- `bun run test` (332 passed, 8 skipped), `bun run typecheck`, `bun run check`, `git diff --check`, desktop build, Metro web export; 12 of 12 mutations caught in a separate copy.
- Driven in the window with the real harnesses: see the proof.
- Not run: signing in an added account; live Codex escalation and steering; live OpenCode permission prompts.

### Staged

- Thread-handover: changing a thread's harness, account, or model mid-thread (built in CHG-0096).
- Accounts for Control, routines, and workflows.
- Harness installs and updates offered from the app (architecture, Integrations).

## Review, refactor, and architecture pass (2026-11-07): committed (CHG-0062)

Started at HEAD `26bbb1d`, with the empty tree as the fixed point. Ran Standards and Specifications reviews and an architecture scan ([report](architecture-audit/architecture-audit-2026-11-07-1830.html)). The behavior-preserving refactors sit uncommitted in the working tree. Both reviewers verified them: no behavior, owner-facing wording, or contract changed. Checks after the refactor: `bun run test` 339 passed, 8 skipped, the same as before. After the architecture pass: 371 passed, 8 skipped. Typecheck, `bun run check`, `git diff --check`, and the desktop build pass.

### Open, for implementation (red/green): found by the Specifications review, not changed

- Done in CHG-0063, awaiting the owner ([proof](verification/2026-11-07-approval-fixes.md)):
  - **High**: the quote check now requires whole words, no negation before them in their sentence, and words naming the action (a verb of its sensitive kind, or a word an unlisted command shares).
  - **High**: commands wrapped in a shell `-c` script, `eval`, `env`, variable assignments, or a launcher (`time`, `nohup`, `exec`, `nice`…) now meet the sensitive list. Still to probe live: the exact command format Codex sends.
  - **Medium**: one-time allowances end with their turn (`Approvals.endTurn`).
- Done in CHG-0064, awaiting the owner ([proof](verification/2026-11-08-edits-and-pattern-kinds.md)):
  - **Medium**: OpenCode asks Iskios for every edit; at the default level an edit inside the thread's folder (after `..` and links) runs unasked, any other asks. Proven live on OpenCode 2.2.0.
  - **Medium**: a standing permission covers only actions of its own kind (`kindOfPermission`), and the question shows the pattern Always allow will save.
  - **High, found live**: Codex escalates as `/bin/zsh -lc '…'`, which asked the owner twice for one push and escaped standing patterns; `targetOf` now unwraps one whole shell `-c` script. This also closes CHG-0063's open probe of the Codex command format.
- Done in CHG-0065, awaiting the owner ([proof](verification/2026-11-08-opencode-refusals.md)):
  - **Medium, found live**: rejecting an OpenCode permission ended its whole prompt (`stopReason: "cancelled"`). OpenCode 2.2.0 has no setting to continue and ACP carries no message, so the adapter now sends the refusals, with the owner's message, as a new prompt in the same turn; an interrupt still ends it. Proven live.
- **Medium**: Codex sandbox widenings ("Permissions") are granted without a question.
- **Medium**: Codex and OpenCode threads load the owner's own MCP servers and skills (against CHG-0022 and CHG-0031; listed as provisional above).
- **Medium**: the widened sandbox hosts may let `git push` or `npm publish` run without a prompt. Probe first, and ask the owner before changing anything.
- Done in CHG-0066, awaiting the owner ([proof](verification/2026-11-08-low-findings.md)), **Low**:
  - a change inside the thread's folder, asked at "Also commands and edits" on any harness, is asked as "Change a file." rather than as outside the workspace;
  - the running limit counts threads in Attention inside a turn (provisional: thread-tree's "At most 8 threads run at once" read as threads inside a turn);
  - the opener-message cap line gives its count;
  - a turn on a removed account fails with the reason before the harness starts (provisional: the owner may prefer refusing the reopen, or moving the thread to the harness's own sign-in);
  - interrupted OpenCode turns count usage: already true when OpenCode answers the cancel (CHG-0065); a process dying during an interrupt now keeps the earlier prompts' usage.
- **Low**, still open:
  - The desktop notification fires only for approval questions.
  - The depth and running limits are not adjustable.
  - Claude Code rules come from `~/.claude/settings.json` only, not from an added account's folder or the workspace's settings, and nothing tests that they are forwarded.
  - The model can call `answer_prompt` directly.

### Awaiting the owner

- The architecture pass's behavior changes (CHG-0062, [proof](verification/2026-11-07-architecture-pass.md)). All six audit candidates were applied at the owner's request. Still to accept:
  - the wider restart key;
  - `answer_prompt` hidden from Codex and OpenCode;
  - a failed prompt answer ending the turn;
  - open harness questions withdrawn at turn end;
  - the fake harness's new prompt echo;
  - the starting-context size now counting the instructions, workspace, and title and budget lines (Batch 17 above);
  - one announcement for SetMissionBudget and the auto-archive sweep;
  - one transaction each for the account, browsable-root, permission, and dismiss-prompt requests.
- Every intel deletion declining its awaiting changes: today only the owner's deletion, an undone save, and a merge decline them, and a thread's `forget_intel` does not. The intel store keeps that difference in one place.
- A glossary term for the harness, account, model, and effort bundle the code calls "runner". The glossary says to avoid "runner" for a harness.

### Left open on purpose

- Files still past about 250 lines after the pass:
  - `store.ts`: append-only migrations;
  - `service.ts`;
  - `intelStore.ts`: splitting it would expose the raw writers;
  - `approvals.ts`, `threadTools.ts`, `intel.ts`, `codex.ts`, `opencode.ts`, `suggestions.ts`, `threads.ts` (261);
  - `requests.ts`;
  - the large test files.
- Import cycles between `commands.ts`, `threads.ts`, and the modules that compose operations: they are safe, since each side is used only inside functions, and the bundled service starts.
- `JSON.parse … as` casts: decoding instead would change how malformed input is handled.
- Multi-behavior test titles, the `server.test.ts` frame casts, and the app client's pending-codec cast.

Quest tree batch (CHG-0095): the Quest and Side-quests menu restyled after the owner's mockup; typecheck, lint, and 458 tests pass; the look awaits the owner ([proof](verification/2026-11-10-quest-tree-menu.md)).

Thread handover batch (CHG-0096): the owner changes a quest's harness, account, Companion, and effort between turns from the message box; a harness or account change gives the new session the whole conversation, and earlier replies keep their provider's mark and name; typecheck, lint, and 473 tests pass; driven in the web export on the fake harness; the look and a live handover await the owner ([proof](verification/2026-11-10-thread-handover.md), [specification](capabilities/thread-handover/specifications.md)).

Rituals batch (CHG-0098): scheduled runs in a quest of their own, with an ordered list of fallback Companions, a card of its own on the board, Run now, and an edit panel; typecheck, lint, and 496 tests pass; driven in the web export on the fake harness; the look and a Ritual firing on a live harness await the owner ([proof](verification/2026-11-10-rituals.md), [specification](capabilities/rituals/specifications.md)).

Rituals place (CHG-0100): Rituals leave the quest board for a place of their own, with a rail category, a screen of cards, and a compact form; typecheck, lint, and 500 tests pass; driven in the web export on the fake harness; the look awaits the owner ([proof](verification/2026-11-10-rituals.md)).


Workshop batch (CHG-0101): the settings page as the owner's mockup, with provider logos and a pinned Settings guide; format, typecheck, lint, and 505 tests pass; driven in the web export on the fake harness; the look awaits the owner ([proof](verification/2026-11-10-workshop.md)).

Message attachments batch (CHG-0102): images attached to the owner's messages by paste, drop, or file button, uploaded first and referenced by the message, handed to Claude Code, Codex, and OpenCode in their own forms, refused when the harness cannot read them. Starting revision `77d925b`, with the uncommitted Workshop work (CHG-0101) in the tree and not mine. Specification: [message-attachments](capabilities/message-attachments/specifications.md). Provisional: a Companion whose vision support is unknown (every OpenCode model) is allowed; drafts older than a restart are erased; the thumbnail has no larger view. Status: built and checked (CHG-0103; [proof](verification/2026-11-10-message-attachments.md)); the look awaits the owner. Pasting very large text no longer freezes the box, and the service starts again.

## Delete a Ritual · 2026-11-10 · built and checked, owner look pending

Starting commit `ca173da`; branch `ritual-delete`. Delete added to the Ritual card (CHG-0108). Not decided by the owner: whether deleting should offer to delete the quest too (kept as agreed: the quest stays). Full suite not run.

## Conversation terminal · 2026-11-10 · owner review pending

Authorized by the owner's request for Delta's `!` interaction, default shell, home folder without a realm, realm root with one, and shell output included in context.
Implementation and verification are on branch `bang-terminal`, based on `e770774`, in `/private/tmp/iskios-bang-terminal`.
The terminal appears as an interactive owner-message bubble in the conversation and renders as a frozen terminal block when sent.
The same serialized output travels through the existing SendMessage and harness context paths.
The progress-display side-quest fix is included: completed approvals no longer masquerade as current work.
Proof and current validation: [terminal verification](verification/2026-11-10-bang-terminal.md).
The owner requested integration onto local main, without pushing to the remote.

Terminal follow-up: the owner confirmed successful live use and requested a handoff and publication.
CHG-0120 keeps the soft blue throughout the live and saved terminal; the latest appearance awaits an explicit look.
The shared handoff is `.agents/handoffs/2026-11-10-1538-conversation-terminal.md`.

## Charter harness installation · 2026-11-11 · built and checked, owner look pending

The owner requested Install beside missing harnesses. Charter now offers it, shows Installing… during work, refreshes status/accounts afterward, and reports failures for retry. Installation uses the computer's npm and the official package's latest release; Node.js/npm and a writable global prefix on PATH are prerequisites. Existing Update remains. Full suite: 739 passed, 10 skipped; typecheck, Biome, and Expo web export pass. Driven in Aside against fake installations; real installs and Windows/Linux runs remain unverified. [Proof and screenshots](verification/2026-11-11-harness-install.md). The harness work is recorded in the [current handoff](../.agents/handoffs/2026-11-11-1200-harness-installation.md); the pre-existing rebrand/sidebar work is separate.

## Reserves usage page and plan-limit rings · 2026-11-12 · built and checked, owner look pending

The owner asked for the next feature, the Reserves usage page (CHG-0199), then for the rail's plan limits to be graphic: concentric rings per provider in a row, with a hover card of what is left and the time to each reset; Claude Code's limits are now read from its `rate_limit_event` (CHG-0198). Both are committed with their checks; neither was seen in the running app. The usage page has gaps against its specification, listed in CHG-0199 and in the [handoff](../.agents/handoffs/2026-11-12-0726-reserves-usage-and-plan-rings.md).
## Conversation header cleanup · 2026-11-12

Follow-up: the owner chose Archive on main quests only. The conversation's Delete action is removed; a small existing Archive image beside the state dot uses the existing ending preview and confirmation. Side-quests and Rituals do not offer this action. Typecheck, Biome, and diff whitespace checks pass after this follow-up; no live visual check or repeat full suite.

Owner request, starting commit `22ac07b`: move Open side-quest to an icon beside the composer's attachment button, remove header Lore and Iskios budget, and replace conversation state labels with colored dots. Implemented without changing sidebar badges, budget enforcement, or budget-stop recovery.

Checks: workspace typecheck and Biome pass. Full suite: 1319 passed, 14 skipped, 5 failed (four lore timeouts and an OpenCode interrupt reporting “This thread is not running”). These service failures have not been diagnosed in this UI batch. Browser appearance and interaction remain unverified; owner look pending.

## Direct WebRTC path for paired devices · 2026-11-25 · built and checked, real-NAT verification pending

Authorized by the owner on 2026-11-25 (CHG-0717, CHG-0718, ADR 0026): paired desktop and web devices upgrade their relay-established link to a direct WebRTC data channel (public STUN, no TURN) carrying a fresh Noise NK session bound to `outlore-direct/1 <room> <attempt>`, leaving the relay idle once up and falling back automatically on failure, drop, or silence. Host service and desktop controller use `werift` (`^0.28.0`, MIT, pure TypeScript); web app uses browser `RTCPeerConnection`; mobile app (Android/Hermes) stays on the relay. Default STUN is `stun:stun.cloudflare.com:3478` (`OUTLORE_STUN_SERVERS` / `OUTLORE_DIRECT`). Workshop lists direct devices as `connected now, direct`. Checks on the rebased tip (`origin/main` `de1191d1`): workspace typecheck, Biome (`bun run check`), and full test suite (`CI=1 bun run test`: 3,170 passed, 24 skipped, 0 failed) pass, including in-process loopback WebRTC with a real local relay and full host service. Not exercised in the sandbox: real NAT traversal from a phone or second network and the live Workshop window. [Verification](verification/2026-11-25-direct-p2p-path.md). Shared handoff: `.agents/handoffs/2026-11-25-0105-direct-p2p-path-verified.md`.

