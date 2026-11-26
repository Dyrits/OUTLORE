# Handoff: Whole-codebase review wave 2, merged and pushed

Supersedes: `2026-11-26-0725-codebase-review-and-refactor-merged.md`
Workspace: outlore (repository root, branch `main`, pushed to `origin/main`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Complete review wave 2 of the whole-codebase review: scoped `Changed` topics with shared identical queries, attachment byte caching, boolean renames with cast removal and the `QuestTitle` re-render audit, the split of the twenty-one service files over the 256-line soft limit, and a re-review of the result on the standards and specifications axes.
Done means all of it merged and pushed to `origin/main` with both re-reviews passed; the owner's desktop checks (CHG-0750 to CHG-0752) and the SPEC-07 decision stay open beyond this wave.

## State

- Landed and pushed (verified: `git log origin/main` after a fetch, 2026-11-26 16:36): CHG-0757 (attachment byte caching), CHG-0758 (scoped `Changed` topics, shared queries) and CHG-0759 (boolean renames, casts, `QuestTitle` memo) merged on main earlier; the 20 file splits, renumbered CHG-0765, and the standards re-review fixes, renumbered CHG-0766, merged in `5c1f35d4`; the stray 0.2.7 changelog conflict marker removed in `cd22f943`.
- `origin/main` = `cd22f943` and local main is level with it (verified: `git rev-list --left-right --count origin/main...main` prints `0 0`); the wave-2 worktree and branch ref are deleted (verified: `git worktree list`, `git branch`).
- Renumbering at merge (verified in `documentation/changelog/0.2.10-Pre-Alpha.md`): the branch's split entry was CHG-0763 and the fixes CHG-0764, but dual-auth took CHG-0763 (`03081bc4`) and the own-copy fix took CHG-0764 (`e667e866`) on origin, so the merged entries became CHG-0765 and CHG-0766; the next free number is CHG-0768 (CHG-0767 is claimed by the phone-control entry below).
- Dual-auth was re-applied inside the split files during the merge (verified: 176 tests in `dualAuth.test.ts` and `connectorTurns.test.ts` passed on the merged tree, and the full pre-commit gate passed on the merge commit): `backends/httpMcp.ts`, `backends/httpMcpTransport.ts`, `connectorAuth.ts` and `executionTypes.ts` carry dual-auth's behavior in the split structure.
- Both re-reviews passed (verified: their results delivered 2026-11-26, quest journal entries 16 and 17): standards PASS with four wave-2 findings, all fixed in CHG-0766; specifications PASS with no behavior defect, and the stale `imageCache.ts` comment it named is fixed.
- The standards reviewer was asked to re-verify the fixes commit (`70382253`); its result had not arrived when this handoff was written. Assumed: it reports nothing beyond the pre-existing debt already recorded.
- Pre-existing debt for the next standards pass (recorded in the CHG-0766 entry): the connectors parent-child import ring, the relocated generic-result casts including `requestSharing.ts`'s `as unknown as`, and the grown `App.tsx` and `questListRows.tsx`.
- The phone-control quest's documents sit uncommitted in the root checkout (verified: `git status` shows the two files modified): its changelog entry, renumbered CHG-0767, sits after CHG-0766 and its work-in-progress section sits at the top, both left for that quest to land; its ADR 0028 and `documentation/capabilities/phone-control/` do not exist on disk, and `stash@{0}` still holds the quest's original stashed text.
- Not verified: any live desktop window (no visual check of wave 2 was made), and the phone-control quest's missing documents.

## Decisions

- Merge with conflict resolution rather than rebase: origin moved ahead (dual-auth, own-copy) while the branch was built, and the wave-2 branch's changes to `httpMcp.ts`, `connectors.ts` and `core/execution.ts` had to meet dual-auth's; recorded in merge commit `5c1f35d4`.
- Generated `core/priceSnapshot.ts` (434 lines, under the 512 hard limit) stays unsplit because `bun run --filter @outlore/service prices:snapshot` generates it as one table; recorded in the CHG-0765 entry.
- Findings the re-review attributed to code older than wave 2 stay for the next pass instead of widening this wave; each finding was compared edge-by-edge against `1e726130`; recorded in the CHG-0766 entry.
- Commit `5ee6a089`'s message says CHG-0757 for the phone shell directions whose changelog entry is CHG-0760: history was not rewritten, the changelog is authoritative.
- The stray `<<<<<<< HEAD` line in `documentation/changelog/0.2.7-Pre-Alpha.md` came from the 2026-11-25 merge `3cc7f5ca` and was removed as its own commit `cd22f943`, because it predates this thread.
- The phone-control quest's changelog entry was renumbered CHG-0764 to CHG-0767 while placing it, to clear the clash with the landed own-copy entry.

## Next

1. Ask the owner to check the desktop window for CHG-0750 to CHG-0752 (image flicker, the realm panel reloading, opening the first quest from a standalone realm channel) and the starting-context warning for Reply, then record Delivery in the changelog.
2. Get the owner's decision on SPEC-07: whether an empty errand opened by Reply starts Fresh or Resting.
3. Fold in the standards re-verify result of `70382253` when it arrives; findings beyond the recorded pre-existing debt become the next batch.
4. Take the next standards pass over the recorded debt: the connectors parent-child ring, the relocated generic-result casts, and the grown `App.tsx` and `questListRows.tsx`.

## Open questions

- SPEC-07, Fresh or Resting for a Reply-opened empty errand: the owner decides.
- The standards re-verify of `70382253`: the reviewer errand has not reported.
- Where the phone-control quest's ADR 0028 and capability documents went: only that quest knows; its placed changelog entry references them.

## Sources

- `documentation/changelog/0.2.10-Pre-Alpha.md`, entries CHG-0757 to CHG-0767.
- `documentation/work-in-progress.md`, the wave 2 section and the phone-control section.
- Quest journal entries 16, 17 and 18 (briefing version 4).
- Commits `5c1f35d4` (wave-2 merge), `cd22f943` (0.2.7 marker), `70382253` (branch tip with the fixes), `3cc7f5ca` (origin of the 0.2.7 marker), `03081bc4` (dual-auth), `e667e866` (own-copy fix).
- The two re-review results delivered by the reviewer errands on 2026-11-26.
