# Handoff: Whole-codebase review and refactor, merged

Supersedes: `2026-11-25-2240-codebase-review-and-refactor.md`
Workspace: outlore (repository root, branch `main`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Review the whole codebase against the conventions and the specifications, fix the owner's two reported defects (images flicker, an open panel reloads when another loads, so every panel behaves as an island), and address every finding.
Done means the owner has accepted the desktop behavior and the listed findings are fixed or deliberately deferred.

## State

- **Merged on local `main` (verified: `git log`, all six errand branches are ancestors of `main`, their worktrees are removed):** the first pass (CHG-0750), the Reply starting-context warning and Pi image-refusal tests (CHG-0751), the standalone-channel merge into `PaneHost` and the shell memoization, and the standards sweeps of the app, desktop, contracts, channel, relay, controller and service (CHG-0752).
- **Checks on the merged result (verified: run this session):** Biome 0 errors; the 7-workspace typecheck passed; `bun run test` passed 3355 tests in 399 files.
- **One flaky test (verified: run alone this session):** `packages/service/test/core/idleTraffic.test.ts` ("a reply written in small deltas") failed with "Did not settle" in the full parallel run and passes alone in about 4 seconds; assumed to be load-sensitive, not a regression.
- **Assumed:** the flicker and the panels behave as islands in the desktop window; nothing was observed there.
- **Not committed:** `bun.lock` carries an unrelated local edit that predates this work and stays out of every commit.

## Decisions

- Panels are islands: a panel re-renders only when its own data or its parent changes (the owner, 2026-11-25).
- Wire and stored field names (for example `multiple` in `contracts/questions.ts`) are not renamed by the boolean-prefix sweep.
- Pi's image refusal stays a `harness === "pi"` check until a harness capability field exists in the contracts and the service harness catalog.
- Files outside the sweeps' split limit are split when next touched, not in one pass.

## Next

1. Ask the owner to check the flicker, the realm panel, and opening the first quest from a standalone realm channel in the desktop window, then record Delivery for CHG-0750 to CHG-0752.
2. Get the owner's decision on Fresh or Resting for an empty errand opened by Reply (SPEC-07); update `mission-tracking/specifications.md` and `packages/service/src/work/tree.ts` if Fresh.
3. Wave 2: scoped `Changed` topics (STD-PKG-01 part 2) and attachment byte caching (STD-PKG-02); rename `usesLegacyClaim`, `legacyFallback`, `acceptOtherRelease` and `allowLocalRelay` together with their callers in `packages/service` and `apps/app`; audit `QuestTitle` in `apps/app/src/conversation/threadTitle.tsx` for needless re-renders; split the 21 service files outside `work` between 257 and 434 lines; remove the remaining `as` casts, `Effect.gen` wrappers and unprefixed booleans the sweeps did not reach; add the starting-context warning check for Reply in the desktop window.
4. Re-review the result with the standards and specifications axes.

## Open questions

- Should an empty errand opened by Reply show Fresh (grey) or Resting (yellow)? The owner decides.
- Is `idleTraffic.test.ts` flaky under load or slower than before the sweeps? Compare its time on commit `269eb373` and on `main` if it fails again.

## Sources

- `documentation/changelog/0.2.8-Pre-Alpha.md` (CHG-0750, CHG-0751, CHG-0752)
- `documentation/work-in-progress.md`
- `documentation/conventions.md`
- `documentation/capabilities/conversation-panes/specifications.md`
- `documentation/capabilities/thread-tree/specifications.md`
- `documentation/capabilities/message-attachments/specifications.md`
- `.agents/handoffs/2026-11-25-2240-codebase-review-and-refactor.md` (superseded)
