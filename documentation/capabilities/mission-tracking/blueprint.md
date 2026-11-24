# Mission tracking blueprint

Status: technical design under review. Uses the local-service modules and records in the [first slice design](../../first-slice-design.md). The user accepted the staged slice and package and module boundaries (CHG-0024); detailed interfaces and storage behavior remain proposed. No acceptance check has run.

## Modules and data

Missions owns mission metadata through `start`, `rename`, `list`, `read`, and `continue`. It stores title ownership separately from generated titles. `set_mission_title` accepts only the mission's top thread and refuses after a user rename. Thread creation and the first message commit with the mission before Execution starts.

Missions queries Threads for state and Usage for spending. Update, 2026-11-20 (CHG-0599): the active mission projection is the roll-up of the top thread over its tree (`work/missionStates.ts`): Failed, then Attention, then Waiting for a Resting or Waiting thread with work Underway or Waiting beneath it, otherwise its own state; Fresh for a quest holding nothing, and Fulfilled or Archived only by ending. Stopped and Fulfilled threads beneath contribute nothing. A top thread that reported leaves the quest Resting, without marking it Fulfilled automatically. The text below is the earlier proposal.

The active mission projection used Attention, Failed, Running, Waiting, then Idle in that order; Done and Stopped threads contributed no greater urgency. Ending a mission is a separate lifecycle change. The proposal used Idle when no thread had one of the urgent states, without marking the mission Done automatically.

SQLite is the production persistence adapter; temporary SQLite is the test adapter. A fake clock replaces wall time. Journal and budget behavior remains with its owning capability; Missions does not duplicate it.

## Acceptance

| Specification check | Module and test interface; stage |
| --- | --- |
| State urgency | Missions `list`, driven by fake Execution events through Threads; included. |
| Top result asks Mark as done without ending | Messaging `reportResult`, then Missions `read`; included. |
| A quiet quest raises no question | Missions query with fake clock; staged with mission ending. |
| Confirmation names running threads before Done/archive and stops them | Proposed Missions ending command through Threads; staged with journal integration. |
| Spending totals by provider unit by billing kind; an estimated cost beside them that never counts toward a limit (budget-control blueprint, Consumption) | Missions `read` after fake usage reports; included. Unknown usage remains unknown. |
| Auto-archive default and configured delay | Missions lifecycle scheduling with fake clock; staged. |
| Writing in Done/Archived reopens | Messaging `send` plus Missions lifecycle; staged until those lifecycle actions exist. |
| Reopen Archived view | Proposed Missions reopen command and list query; staged. |
| Proposed title, user rename, later tool refusal | Missions `rename` and MCP `set_mission_title`; included. |
| Prefilled starting choices | Missions `start` and defaults query; included for the slice's supported settings. |
| Dashboard order, filters, title and briefing search | Missions `list`; state order, workspace filter, and title search included; briefing search staged with journal. |
| Desktop and phone: three missions, attention first, Done, archive, reopen | App driving Missions; initial desktop start/order covered, full walkthrough staged until ending and phone transport exist. |

## Requirements

| Requirement | Design |
| --- | --- |
| Local data | Store keeps missions on the host computer; app receives projections over authenticated local transport. |
| Single user | Only the owner can call initial app commands. |
| Future multiplayer | Host and actor identifiers remain separate; guest access is staged as described in the shared design. |

## Simplified sidebar, errands and crest removal (CHG-0449)

Proposed design for the [Simplified left navigation](specifications.md#simplified-left-navigation). All four batches are built (CHG-0452 to CHG-0456). The app, contracts, and service keep their existing boundaries and storage ownership. Quest placement follows [ADR 0015](../../architecture-decision-record/0015-realms-tied-or-not-and-one-borderlands.md).

Modules and interfaces (all in `apps/app/src` unless noted):

- **`shell/placeCatalog.ts`** supplies the desktop and phone menus with one ordered list of Rituals, Lore, Archive, Reserves, and Settings. Remove the custom icon field and the retired destinations from the catalog. Test the menu order and destination mapping as data.
- **`shell/sidebar.tsx`** has a quiet **Realms** label, the realm rows and **Visit a realm** (opens `NewRealmModal`), then a line, a **Borderlands** label, the quests in no realm and **Start a quest** (the existing direct creation request). Use `shell/questTree.ts` to render quests with no realm after the realm groups as plain rows. Test the row order through the quest tree helper and exercise each button in the app.
- **Quest moves.** Remove the old Borderlands drop target. Keep the realm targets and shared placement confirmation. Update `shell/questMove.ts` to describe changes from an ungrouped quest in ordinary language and mention only realm lore that the quest gains or loses. Use the existing move tests to cover confirmation, cancellation, and refusal while a thread is running.
- **Realms overview.** Removed by CHG-0463: `shell/homeScreen.tsx` is the plain home screen, `shell/appScreen.tsx` shows it for the home place and for a realm list with no realm, and `shell/navigation.ts` routes back from ungrouped quests to it.
- **Guild Hall and Chronicler.** Remove the hub route in `shell/appScreen.tsx` and its screen components after checking callers. Keep Chronicler's panel in `shell/chroniclerDock.tsx` and route actions meant to talk to Chronicler through that panel. Use Realms as the fallback for retired saved destinations and ordinary back links that used the hub. Test fresh starts, restored destinations, and opening Chronicler from desktop and phone.
- **Settings.** Move the Charter's Code Mode switch into a Connectors section in `settings/settingsSections.ts`. Test that Settings still reads and saves the same setting.
- **Icons and arrows**: delete `shell/navIcons.tsx`, `assets/nav/`, and `ui/bowArrow.tsx` (a plain chevron replaces it in `ui/fold.tsx`); keep `settingsIcons.tsx` minus the realm emblems. Check `apps/desktop/scripts/check-package.ts` for the asset names.
- **Crest removal**: delete `apps/app/src/crest/`, `realms/newRealmCrest.ts`, the crest steps of `newRealmModal.tsx`, `realmRecoveryModal.tsx`, `realmRecovery*.ts`, the crest studio and badge uses in `dashboard.tsx`, `quests/board.tsx`, `quests/questPanel.tsx`, `conversation/guildHallHub.tsx`, `shell/railQuests.tsx`, `shell/archivePage.tsx`, `shell/questListPage.tsx`, and `apps/desktop/test/crestCredits.test.ts` with its check. In `packages/contracts`: remove `crest.ts`, the `crest` fields of `Workspace`, `MissionSummary.workspaceCrest`, `RealmAppearance`, `NewRealmAppearance` and the Ritual realm hint, and the request `SetRealmCrest`. Effect `Schema.Struct` decoding drops unknown fields, so an older host's records and an older app's requests still decode, except that an older app calling `SetRealmCrest` is refused: acceptable, the release check (close code 4003) already separates mismatched releases. In `packages/service`: remove `crestOfRow`, `setRealmCrest`, the crest argument of `createRealm`, `attachWorkspace` and the dashboard and mission projections; the `crest` column and migrations stay, unread and never written (new rows leave it null). Chronicler's realm tools and proposal card lose the crest argument. Test seam: the service requests' tests (`realmCreation`, `realmLifecycle`, `workspaces`, `missions`) lose crest cases; add one test that a stored crest is ignored.
- **Errand rename**: one string sweep of interface text, Chronicler's guide topics, thread tool descriptions and thread instructions (44 source files mention side-quest; identifiers, the `@side-quest:` token and stored values stay). Test seam: a guard test, like `hermesBuiltins.test.ts`, that fails when a file of the interface strings list contains "side-quest" outside the allowed token.
- **Docs after the build**: the older specifications that say side-quest, Borderlands, Craft, Library or Charter (about 17 files), `architecture.md` line 65 (the `crest` folder leaves the chain), the README and `apps/app/AGENTS.md`.

Build in four batches. First remove crests across contracts, service, and app. Then change the sidebar and menu, retire the Guild Hall hub, and move the Charter into Settings. Next move the ungrouped quest rows into the Realms overview, retire the old page, and update quest moves. Finish with the errand rename and guard. Run typecheck, Biome, and the suite for each batch.

Gild removal joins the implementation scope. Plan the removal against the theme selector, saved preference, and theme assets before changing code. One, the current default, is the proposed fallback for a saved Gild selection.

Before the relevant batch, settle how the owner can take an existing quest out of a realm without a sidebar drop zone. A quest-level action can reuse the placement confirmation. Also confirm the earlier proposals to show the budget rings in Reserves, retain the stored `@side-quest:` token while relabeling its chip, and keep the Workshop's section icons.

## Open

Review the interfaces and dependency gates in the shared design. Completion of this slice does not establish completion of mission-tracking.
