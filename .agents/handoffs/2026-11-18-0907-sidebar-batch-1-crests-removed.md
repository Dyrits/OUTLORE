# Handoff: Simpler sidebar, batch 1 (crests removed)

Supersedes: [2026-11-18-0126-simpler-navigation.md](2026-11-18-0126-simpler-navigation.md)
Workspace: OUTLORE, worktree `.worktrees/sidebar`, branch `worktree/sidebar` cut from `main` at `ffb370e`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Implement the simpler sidebar, errands and crest removal of CHG-0449 in four batches (see the blueprint). The owner said "work on the sidebar as planned"; the first batch is done, the rest is not started.

## State

- Verified by running: commit `932d1af` on `worktree/sidebar` removes realm crests from `packages/contracts`, `packages/service` and `apps/app` (CHG-0452). Biome, the typecheck of seven workspaces, and the full suite (`CI=1 bun run test`: 2,055 passed, 56 skipped) pass; the pre-commit hook passed too.
- The `crest` database column and its migrations stay, unread and never written. A service test stores a crest and checks it is ignored.
- Realm recovery now compares the name only (`realmRecovery.ts` `RecoveryPicks = { name }`).
- Not checked: the app in a window or on a phone; the packaged-app check (`apps/desktop/scripts/check-package.ts` lost its credits step, otherwise unchanged and still waits for the text "Guild Hall"); a database that really held crests.
- The branch is committed, not merged, not pushed. The checkout `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS` is on `effort-title-case` with unrelated uncommitted work from other sessions; it was not touched.
- CHG-0452 was the next free number in `documentation/changelog/0.1.8-Prototype.md` when written; another branch may have taken it (CHG-0447 was once taken twice and renumbered to 0449).

## Decisions

- Base the worktree on `main`, not on `effort-title-case`, so the work merges on its own.
- `RealmAppearance` and `NewRealmAppearance` stay as name-only structs rather than being removed, to keep the request shapes stable.

## Next

1. Batch 2: sidebar rows and the footer menu (`placeCatalog.ts`, `sidebar.tsx`), the Guild Hall hub retired, the Charter's Code Mode switch moved to a Connectors section of Settings, Gild removed with a saved Gild selection falling back to One (plan the theme selector, saved preference and assets before editing). `check-package.ts` waits for "Guild Hall" in the page text; change it when the hub goes.
2. Batch 3: ungrouped quests in the Realms overview, retire the Borderlands page and drop target, update quest moves. Settle first how to take a quest out of a realm.
3. Batch 4: the errand rename and its guard test.
4. Run Biome, typecheck and the suite after each batch; ask the owner to look in a window and on a phone.

## Open questions

- How an existing quest leaves a realm without a sidebar drop zone (before batch 3).
- Budget rings (Reserves), the stored `@side-quest:` token with a relabelled chip, and the Workshop's section icons (blueprint proposals, unconfirmed).
- Whether to merge batch 1 alone: merging needs the checkout's matching uncommitted documentation hunks to be committed or dropped first.

## Sources

- `documentation/changelog/0.1.8-Prototype.md`, CHG-0449 and CHG-0452.
- `documentation/capabilities/mission-tracking/specifications.md#simplified-left-navigation` and the blueprint section for CHG-0449.
- Commit `932d1af` and `documentation/work-in-progress.md`, Simpler app.
