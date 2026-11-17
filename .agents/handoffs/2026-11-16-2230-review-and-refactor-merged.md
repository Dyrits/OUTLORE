# Handoff: Review and refactor of the whole codebase (phase 2 merged into main)

Supersedes: `2026-11-16-2205-review-and-refactor-integration.md`
Workspace: ISKIOS repository, `main` (merge commit `48e9e5f`); `origin` now points to `git@github.com:Dyrits/OUTLORE.git`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Review the whole codebase against its standards and agreed specifications and fix what was found: mechanical refactors, behaviour fixes (red then green, one commit per finding), the Effect migration of the non-UI code, and the owner's decisions kept apart. Baseline for every finding is `d767f75`. Done means the remaining behaviour fixes, the content security policy, fault injection for slice E, the never-reviewed surfaces and the owner decisions are settled and the final report is written.

## State

- Verified (git, this session): `worktree/rr-integration` (tip `62c15c7`, 52 commits) was merged into `main` with a merge commit `48e9e5f`, no conflicts. `git diff worktree/rr-integration main` shows only the previous handoff file and its `AGENTS.md` pointer, so the merged tree is the one that was tested.
- Verified (run in this session, on `62c15c7`, the same tree apart from the handoff): Biome clean (810 files), typecheck 7/7, `CI=1 bun run test` once in the sandbox with `XDG_DATA_HOME` unset and the pty and Seatbelt tests skipped: 227 files passed, 4 skipped, 1859 passed, 0 failed, 54 skipped, 1913 total (the earlier `main` baseline in the same variant was 1685/0/54 of 1739). The merged `main` checkout was not itself tested: its `node_modules` lack the packages the new code needs (`@electron/fuses`, relay's links to `@outlore/channel`), so run `bun install` outside the sandbox before testing it. The fuses test passed in the integration worktree only because that package was copied in by hand.
- Content: tooling (CI web build before tag, git guard hardening, Wrangler pin, retried-test reporter, doc fixes), slice H fixes (credits, notices, Electron version, update User-Agent, pairing drop, Windows terminals, Electron fuses, SP-H-06 documentation), service behaviour fixes (stale plan limit, lore approval checked against the target's original placement and kind, migration `0055`, SP-F-02 and 03 tests, `XDG_DATA_HOME` test isolation), slice G (credits guard, failed-image Retry, Done wording, device-locale clock, @ list documentation, SP-F-01 documentation), slice B finish (title splits, shared settle, `claude.test.ts` and `opencode.test.ts` splits), Effect lots 0 to 4 (channel, relay client, controller, host reconnect, RoomCore and node relay; abuse limits; claim in a WebSocket subprotocol, legacy `?claim=` accepted until 2027-02-01; ADR 0010 amended). Read the superseded handoff and `.worktrees/rr-reports/` ledgers for the per-item detail.
- Assumed (side-quests' and reviewers' claims; reviewers reran only targeted tests): every merged commit was read independently and cleared; the relay bundle ran under `wrangler dev`; the web export grew by 1,873 bytes through lot 3.
- Not pushed from the integration branch before this merge; the merge itself is pushed with this handoff (see Next 1 if `git log origin/main` disagrees).
- Changelog `documentation/changelog/0.1.6-Prototype.md` holds provisional numbers (CHG-0336, 0358, 0362 to 0364, 0370). The ADR 0010 text cites CHG-0361; the device-pairing specification and the ADR 0016 amendment cite CHG-0358.
- Not done: content security policy (SP-H-10); relay bundle regeneration check against `bun run bundle`; slice E fault injection (SP-E-01 silent loss of a due Ritual run, SP-E-02 orphan attachment file, SP-E-03 interrupted deletion, all candidates); behaviour fixes of slices A, B, C, D (see Next); triage of the F and G Standards findings still open; review of `apps/desktop`, `packages/controller` and the remaining tooling as surfaces; `ST-G-01`, `ST-G-02`, `ST-G-09` and parts of `ST-G-03` and `ST-G-07`; a documentation re-check against the merged code.
- Reports, ledgers and the parked red test `slice-a-phase2/folderSearch.test.ts` are in `.worktrees/rr-reports/` (git-ignored). The `rr-*` worktrees and branches still exist locally.

## Decisions

- The owner asked to merge the complete branches and push, knowing the migration order was undecided. Recorded decisions of the quest (journal and lore): Done wording stays Done; the @ list keeps 5 mixed and 12 per category; the clock follows the device locale through one formatter; Effect for all non-UI code, lots 0 to 4 approved, lot 5 deferred, ADR 0010 amended only for the parts that stay plain; fixes approved for Windows terminals, Electron fuses, relay abuse limits, the claim out of the URL with a visible transition, a content security policy (not started), crest credits; SP-F-01 documentation only; SP-H-06 reworded to "before the first stable release"; SP-H-13 keep `retry: 2` and report retries, drop the dead Iskios copy step.
- A stale lore approval is refused with `InvalidInput` and an explicit reason; older targeted cards without a snapshot fail closed.
- The `[::1]` entry in the channel's `localHostnames` is functional; keep it.
- Kept as designed: authorization derived twice with the second derivation inside the transaction, single-use receipt, byte-for-byte fingerprints. `SP-A-06` keeps the `CreateRitual` vocabulary. `ST-A-19` is recommended to leave as is.
- Process: commit on branches, one commit per finding, red then green; compare test results only within one variant (`XDG_DATA_HOME`, pty, sandbox).

## Next

1. Check `git log origin/main` and `git status`: the merge `48e9e5f` and this handoff should be on `origin/main`. Then run `bun install` outside the sandbox and `CI=1 bun run test` on `main` to get the first run of the merged checkout itself, noting the variant.
2. Resolve the migration order with the owner before any database that ran migration `0055` meets `worktree/context-window` (see Open questions). Do not start a build from `main` against the owner's real data folder before that.
3. Behaviour fixes still owed, red then green, one commit per finding, on a work branch from `main`: SP-A-01, 05, 06; SP-B-01, 06, 09 to 12; SP-C-01, 02, 05, 16, 17, 19, 20; SP-D-01 to 05, 07, 10a, 11, 16, 17; SP-E-01 to 03 only after fault injection confirms them; SP-G-02 (`threadTitle` on the Question contract). Skip any whose decision is open.
4. Content security policy with a real browser check of the actual export and of pairing; a human item if no browser is available. Confirm the relay bundle matches `bun run bundle` and run a Wrangler dry run.
5. Triage the remaining F and G Standards findings on the merged tree, then review `apps/desktop`, `packages/controller` and the remaining tooling on both axes.
6. Re-check the documentation against the merged tree once, renumber the provisional changelog entries and their citations, then write the final report with the human acceptance list.

## Open questions

- Migration order (the owner did not answer when asked): `worktree/context-window` (`e00ffb2`, migration `0054_usage_context_window`) is not merged and `main` now holds `0055`. The migrator skips a migration whose id is at or below the latest applied one, so a database that ran `0055` would never run `0054` after `context-window` merges. Merge order cannot fix that now: renumber `context-window`'s migration above `0055`, or make the owner aware before its merge.
- Lot 4 thresholds to confirm: 60 requests per minute and 600 per hour per address, 200 frames per second with a burst of 400, 10,000 node rooms, idle rooms dropped after 7 days; and the legacy claim end date 2027-02-01 (`legacyClaimUntil`).
- Specifications decisions still open: SP-A-02, 03, 04, 07; SP-B-02, 03, 04, 07, 08; SP-C-03, 07, 09, 12, 13, 14, 15, 18; SP-D-06, 08, 09, 10b, 12, 13; SP-G-01 in-app credits presentation; ST-H-14, ST-H-24, ST-H-25 (check the journal for answers). Standards: ST-A-19; ST-G-02 known debt.
- Whether slice E's three candidates are real: only fault injection answers.
- Human-only acceptance: a look at the changed screens (failed-image tile, choice cards, credits), live harness runs, a paired browser from another network and web pairing after the Effect migration, the packaged desktop app with the flipped fuses, a real Windows run (terminals, installer), a Wrangler or real deploy of the relay bundle, the relay free-plan measurement before the first stable release, the CI workflow and reporter on real GitHub Actions, a live scheduled Ritual under an unavailable primary.

## Sources

- `.worktrees/rr-reports/` and the quest journal of the "Review and refactor whole codebase" quest (entries up to 235 and later)
- `git log 9b75e3f..48e9e5f`, branches `worktree/rr-*` and `worktree/context-window`; baseline `d767f75`
- `documentation/conventions.md`, `documentation/backlog.md`, `documentation/architecture.md`, `documentation/architecture-decision-record/0010-effect-in-the-service-and-relay.md`, `documentation/changelog/0.1.6-Prototype.md`
- Earlier handoffs of this thread: `.agents/handoffs/2026-11-16-2205-review-and-refactor-integration.md`, `.agents/handoffs/2026-11-16-1710-review-and-refactor-codebase.md`
