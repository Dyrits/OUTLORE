# Handoff: Workshop and errand permission modes (CHG-0617)

Supersedes: `2026-11-21-1227-thread-permission-modes.md`
Workspace: Outlore repository, branch `worktree/workshop-permissions` (worktree `.worktrees/workshop-permissions`), rebased onto `main` at `578aeefb`.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Give Outlore one permission vocabulary everywhere: the four per-thread modes T3 Code has (Supervised, Auto-accept edits, Auto, Full access), offered by the Workshop as the default for every thread without its own mode, selectable from every composer (quests and errands, host window and paired phone), and changeable at any time with the change applying from the next turn. Done means: the two commits land on `main` and are pushed, and the remaining window, phone, and live-harness checks pass.

## State

- CHG-0612 (per-thread modes in the host composer) is on `main` at `eaf8fb69`, from the superseded handoff. Assumed from the journal; the file is on `main`.
- CHG-0617 is complete on `worktree/workshop-permissions` as two commits, `8c8493ae` (the Workshop's four-mode default, migration `0071_settings_permission_mode`) and `6a321c1f` (the selector on every composer and mid-turn changes, migration `0072_turn_permission_mode`), rebased onto `main` at `578aeefb`. Verified: `git log main..HEAD` shows exactly these two commits and a clean working tree.
- The batch was renamed CHG-0614 → CHG-0617 during the rebase (another session's CHG-0614, the architecture-audit entry, landed on `main` first). Verified: the only remaining `CHG-0614` mentions under `packages/`, `apps/`, and `documentation/` are main's own architecture-audit record in `documentation/changelog/0.2.1-Pre-Alpha.md`.
- Verified after the rebase (runs on 2026-11-21, recorded in [verification](../../documentation/verification/2026-11-21-workshop-permission-modes.md)): `bun run typecheck` exit 0; `bunx biome check` clean on `packages/service/src`, `apps/app/src`, `packages/contracts/src`; focused tests (`turnAdmission`, `guildmasterSettings`, `hostOnlyRequests`, `approvalsSandbox`, `frames`) 38 passed; full suite `CI=1 bun run test` 2,725 passed, 24 skipped, 0 failed.
- The rebase's nontrivial conflict was `packages/service/src/work/turnAdmission.ts`: `main` had refactored admission into a shared `admit` helper (with `admitTurn` and `admitBackgroundWake` calling it); the resolution keeps that shape and restores the batch's additions into the helper — `permission_mode` in the thread SELECT, the effective-mode computation with `effectiveModeOf(thread.permissionMode, (yield* readSettings).defaultPermissionMode)`, and the `permission_mode` column in the turns INSERT. Verified by the passing typecheck and tests.
- Not checked (carried from the whole thread): the Workshop's Permissions page and the composers in a desktop window, the phone composer, and a live Mistral Vibe turn against the new modes.

## Decisions

- One vocabulary: the four modes replace the two approval levels and the sandbox-escape toggle everywhere; only Full access lets commands leave the sandbox unasked. Recorded in `documentation/capabilities/action-approval/specifications.md` ("Permission modes") and CHG-0617 in `documentation/changelog/0.2.1-Pre-Alpha.md`.
- The Workshop's default applies to threads without their own mode, errands included — a global Full access therefore lets errands run unapproved; the owner chose this knowingly (CHG-0612 decision, restated in the journal).
- A mode change mid-turn follows runner-change semantics: the running turn keeps the mode it was admitted with (snapshot in the turn row, migration 0072) and the next turn applies the change. Owner's ask, 2026-11-21.
- `change_setting` still refuses `defaultPermissionMode`; only the owner sets the Workshop default.
- Renumbered CHG-0614 → CHG-0617 because main's CHG-0614 became the architecture-audit entry; recorded in the changelog and the verification note.

## Next

1. Land the branch: in the main checkout, `git merge --ff-only worktree/workshop-permissions`, then push `main` to origin (the owner has asked for the push; the Git guard may still ask — obtain the owner's confirmation if it blocks).
2. Run the open window checks: the Workshop's Permissions page with the four-mode picker, a quest's and an errand's composer showing "Default permissions (Auto)", and a mid-turn mode change applying on the next turn.
3. Check the phone composer shows the selector.
4. Run a live Mistral Vibe turn: under Full access its shell requests should be approved without prompting; under Default permissions (Supervised) it should ask again.
5. Record the results in `documentation/verification/2026-11-21-workshop-permission-modes.md` and update the work-in-progress entry.

## Open questions

- None blocking. The owner has approved the full scope, including the Workshop-level Full access with its errand implication.

## Sources

- `documentation/capabilities/action-approval/specifications.md` — "Permission modes" section (the behavior of record).
- `documentation/changelog/0.2.1-Pre-Alpha.md` — CHG-0617 entry (with the amendment folded in).
- `documentation/verification/2026-11-21-workshop-permission-modes.md` — everything run, including the post-rebase re-verification.
- Commits `8c8493ae` and `6a321c1f` on `worktree/workshop-permissions`; base `main` at `578aeefb`.
- Superseded handoff `2026-11-21-1227-thread-permission-modes.md` — the CHG-0612 background and the T3 Code comparison.
