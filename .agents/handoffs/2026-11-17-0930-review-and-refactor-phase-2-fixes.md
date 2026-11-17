# Handoff: Review and refactor of the whole codebase (behaviour fixes of slices A to E integrated, not yet on main)

Supersedes: `2026-11-16-2230-review-and-refactor-merged.md`
Workspace: ISKIOS repository; the work is on branch `worktree/rr-integration` (`.worktrees/rr-integration`), 70 commits above `main` (`e785faa`, equal to `origin/main`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm with the owner what you will do next before changing anything, and ask before pushing.

## Goal

Review the whole codebase against its standards and agreed specifications and fix what was found: mechanical refactors (done and on `main`), behaviour fixes (red then green, one commit per finding), the Effect migration of the non-UI code (on `main`), and the owner's decisions kept apart. Baseline for every finding is `d767f75`. The owner's instruction for this phase: "just fix what is needed and put everything on main", with no new sandbox-related asks in the product (SP-A-02, SP-B-02, SP-B-08 are specification-only) and a release mismatch at pairing must leave no phantom device and burn no code (SP-A-03).

## State

- Verified (git, this session): `main` and `origin/main` are at `e785faa`. `worktree/rr-integration` holds 70 commits above it: slice A (6 commits: folder search filter, quoted paths, French requests, saved settings per field, release check at pairing, two specification clarifications), slice B (12: tool-server load failure fails the turn, question wait cap, image refusal for OpenCode, OpenCode edits decided by the service, pinned harness behaviours, specification and ADR 0011 amendments), slice C (20), slice D (17), slice E (10), an integration fix for the channel refusal sentence and its test, the changelog renumbering, and the documentation pass. Nothing of this is pushed; the integration branch is the only copy of the integrated tree besides the `rr-fix-a` to `rr-fix-e` branches.
- Verified (run in this session on `11a9d68`, before the renumbering and documentation commits): Biome clean (825 files), typecheck 7/7, `CI=1 bun run test` once in the sandbox with `XDG_DATA_HOME` unset and the pty tests skipped: 240 files passed, 4 skipped, 1937 tests passed, 0 failed, 54 skipped, 1991 in total. Compare results only within that variant: with pty available the skipped count drops by 4; with `XDG_DATA_HOME` set an old Codex assertion used to fail (fixed in a slice-B follow-up, check the variant first).
- Verified (re-run on the code tip `716f4e1`, same variant: sandbox, `CI=1`, `XDG_DATA_HOME` unset, pty tests skipped): Biome clean (825 files); full suite exit 0, 240 files passed, 4 skipped, 1939 tests passed, 0 failed, 54 skipped, 1993 in total (+2 tests: the two app guide tests).
- Independent reviews (read-only, by a coordinator thread, targeted tests only, isolated copies): slices A, B, C, D, E and the integration fixes were each read and cleared. These reviews re-ran targeted tests, not the full suite. Defects they found were fixed before integration: stale lore approvals (migration `0055`, `previous_*` snapshot columns), the narrow-screen truncation of a question's source thread, the orphan image files after a deletion, the scratch failure killing `deleteThread`, the Chronicler lore reads counting uses, and several texts.
- Changelog `documentation/changelog/0.1.6-Prototype.md`: the 62 provisional entries of this phase are numbered CHG-0371 to CHG-0432 in slice order (A 0371 to 0376, B 0377 to 0387, C 0388 to 0406, D 0407 to 0422, E 0423 to 0432). Earlier provisional numbers of the previous phase (CHG-0336, 0358, 0362 to 0364, 0370) are unchanged.
- Documentation pass done on the integrated tree (README, architecture, conventions, glossary, `AGENTS.md`, ai-tooling, the app guide topics for Rituals and pairing, the specifications of mission tracking and thread tree for "Done stays").
- Not pushed, not merged into `main`. The `rr-*` worktrees and branches still exist locally; `.worktrees/rr-reports/` (git-ignored) holds the reports and ledgers.
- The handoff commit and the `AGENTS.md` pointer sit on top of `716f4e1` and change no code.

## Decisions

- Recorded owner decisions of this phase (journal and lore): Q1 to Q11 recommendations stand, with the two overrides above. Done stays "Done". The `@` file list keeps 5 mixed and 12 per category. The clock follows the device locale. Effect for all non-UI code except the parts listed in ADR 0010. SP-F-01 specification only. SP-H-06 reworded and documented. SP-H-13 retries reported. The CSP stays deferred (needs a real browser).
- A stale lore approval is refused with `InvalidInput` and an explicit reason; targeted cards from before migration `0055` fail closed.
- SP-E-01: a scheduled Ritual run that cannot start fails visibly (thread Failed with the reason), its partial writes are rolled back, including its trigger message (deliberate, documented, differs from the first brief); no automatic retry policy.
- SP-D-05 covers the two fallback calls only; the switch to the primary Companion at the start of a Ritual run is not covered (the run's own message has no image).
- SP-C-17: for OpenCode, an image is refused at turn start (the capability is only known at session start), not when the message is sent.
- SP-C-09 is deliberately not done (needs a migration; the owner said no migration and no workaround).

## Next

1. Ask the owner whether to merge `worktree/rr-integration` into `main` and push. Before any database that ran migration `0055` meets `worktree/context-window`, resolve the migration order (Open questions). The push needs the owner's explicit approval and the exact list of what goes out.
2. After the merge, run `bun install` outside the sandbox and `CI=1 bun run test` on `main`, naming the variant. The checkout of `main` itself has never been run (it lacks `@electron/fuses` and the relay's link to `@outlore/channel` until installed).
3. Remaining behaviour work: SP-C-09 (presence of token categories, needs a migration above `0055` coordinated with `context-window`), the rest of SP-C-20 (period renewal and release of an account budget, exact answer count in an interrupted turn, install failure reason, Tidy up, the model-specific window), SP-C-17 admission decision, the Ritual `beginRun` queued-image case, a failing Codex `listModels` skipping a fallback candidate, SP-G-03, 04, 06 (already integrated earlier), SP-G-01 packaging half, SP-G-05 specification fix, SP-H-10 CSP with a real browser check.
4. Review never done: the rest of `apps/app` (about 130 files: shell, conversation, settings, editors, realms, lore, quests, rituals); triage of the slice F and G Standards findings on the merged tree (reports in `.worktrees/rr-reports/slice-f-*.md` and `slice-g-*.md`; `rr-f` and `rr-g` sit at `d767f75`).
5. Final report with the human acceptance list.

## Open questions

- Migration order: `worktree/context-window` (migration `0054_usage_context_window`) is not merged and `main` holds `0055`. The migrator skips a migration whose id is at or below the latest applied one, so a database that ran `0055` would never run `0054`. Recommended: renumber `context-window`'s migration above `0055` (and above any later one) when that branch merges; the owner agreed in principle. Nothing in this phase added a migration beyond `0055`.
- Lot 4 thresholds to confirm: 60 requests per minute and 600 per hour per address, 200 frames per second with a burst of 400, 10,000 node rooms, idle rooms dropped after 7 days; legacy claim end date 2027-02-01 (`legacyClaimUntil`). The owner accepted them in principle; confirm they stay.
- SP-C-17: does message-attachments require refusing an image for OpenCode when the message is sent, or is refusal at turn start enough?
- Open specification decisions: SP-D-06 was settled by removing the lines; check the journal for any still open among SP-C-18 follow-ups; the "Own copy" glossary entry describes an unbuilt button; the app guide's workshop topic lists sections approximately (see `settingsSections.ts`); no per-package READMEs exist (recommended: none); `work-in-progress.md` has no entry for this quest (the handoff carries the state).
- Human-only acceptance: a look at the changed screens (question cards with a long quest name on a narrow screen, failed-image tile with long text, credits), live harness runs (Claude, Codex, OpenCode: tool-server load failure, image capability, OpenCode worktree edit, the probe turn cost), a paired browser from another network, web pairing after the Effect migration, the pairing refusal between two releases (a real old app against a new host was not tested), the packaged desktop app with the flipped fuses, a real Windows run (terminals, installer), a Wrangler dry run or deploy of the relay bundle, the Chronicler lore search across scopes, and a scheduled Ritual under an unavailable primary.

## Sources

- `.worktrees/rr-reports/` and the quest journal of the "Review and refactor codebase" quest (entries up to 296 and later)
- `git log e785faa..worktree/rr-integration`, branches `worktree/rr-fix-a` to `worktree/rr-fix-e`, `worktree/context-window`; baseline `d767f75`
- `documentation/changelog/0.1.6-Prototype.md` (CHG-0371 to CHG-0432), `documentation/backlog.md`, `documentation/architecture.md`, `documentation/conventions.md`, `documentation/architecture-decision-record/0010-effect-in-the-service-and-relay.md` and `0011`
- Earlier handoffs of this thread: `.agents/handoffs/2026-11-16-2230-review-and-refactor-merged.md`, `.agents/handoffs/2026-11-16-2205-review-and-refactor-integration.md`
