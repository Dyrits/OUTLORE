# Handoff: review integration CI dependency fix

Supersedes: `2026-11-17-0930-review-and-refactor-phase-2-fixes.md`
Workspace: OUTLORE, branch `worktree/ci-controller-dependency` in `.worktrees/ci-controller-dependency`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Fix the failed GitHub CI run after the review integration. The wider review quest still has deferred work; this fix restores installation and typechecking without changing application behavior.

## State

- Verified with local Git and `git ls-remote`: the previous integration is on local and origin main at `c6472c7`. The previous handoff's statement that it awaits merge is obsolete.
- Verified by `gh run view 44047901516 --log-failed`: CI failed in typecheck because `packages/controller` could not resolve `effect`; errors in app and service followed from it.
- Verified from manifest and history: `1ad0f0a` removed the controller's development dependency while moving browser integration tests. The Effect migration imports the library at runtime, but integration left it absent from the manifest. The lockfile already lists runtime `effect` 4.1.4 for the controller.
- Fixed `packages/controller/package.json` to declare runtime `effect` 4.1.4. No lockfile change or source change.
- Verified on a clean `git archive` export in `/private/tmp/outlore-ci-suFowl`: the controller typecheck first failed with TS2307. With only the corrected manifest copied in, `bun install --frozen-lockfile --ignore-scripts`, all seven package typechecks, Biome (843 files), and `bun run site` from `packages/relay` passed. Lifecycle scripts were disabled because the export has no Git directory and the root prepare script configures Git hooks. The first install had installed dependencies before failing that prepare step.
- Verified in that clean export: 20 channel/controller/service-remote test files, 177 tests passed with `--retry=0`, inside the sandbox. Used the original checkout's Electron executable with the export's freshly installed Vitest and package dependencies. No full suite rerun for this manifest-only correction.
- The task worktree was prepared with `.agents/worktree-setup.sh`; copied packages were stale (channel Effect and relay channel link absent), so a frozen installation replaced them. This corroborates why copied dependency folders are insufficient evidence of a clean install.
- CHG-0433 records the correction. Commit, local main integration and publication are pending at writing; confirm their current state in Git and the quest journal.

## Decisions

- Keep Effect as a runtime dependency, as ADR 0010 requires for the controller's public operations.
- Use a clean installation plus the existing controller typecheck as the regression check. An extra test asserting a manifest string would duplicate the configuration without checking module resolution.
- Before any push to main, obtain approval for the exact push command; the pre-push hook protects main.
- Preserve `.worktrees/rr-reports/`, which is ignored by Git and contains the review evidence.

## Next

1. Confirm the correction is committed and on main; obtain approval and push it if pending, then inspect the new GitHub run. Do not claim CI is green before GitHub reports it.
2. Continue the wider quest only within the owner's chosen scope. Outstanding work remains SP-C-09 (token presence needs a migration), the remaining SP-C-20 cases, OpenCode image-refusal timing (SP-C-17), a queued image at Ritual `beginRun`, and a failed Codex model-list read skipping a backup.
3. Other deferred work: relay CSP with a real browser, review of the remaining app folders, F/G Standards triage, and the human acceptance list from the superseded handoff (live harnesses, narrow question cards, pairing, packaged desktop/fuses, Windows, relay deployment).
4. Before merging `worktree/context-window`, renumber its migration 0054 above main's latest migration (0055 at this fix). An existing database that ran 0055 would skip a later-added 0054. This task changes no migrations or real data.

## Open questions

The full wider quest remains unfinished. Refer to the superseded handoff's open questions for the unresolved product decisions and human checks. No product decision is needed for this dependency fix. A Linux GitHub run remains the final CI proof.

## Sources

- https://github.com/Dyrits/OUTLORE/actions/runs/44047901516
- `packages/controller/package.json`, `bun.lock`, `.github/workflows/package.yml`
- `documentation/architecture-decision-record/0010-effect-in-the-service-and-relay.md`
- `documentation/changelog/0.1.6-Prototype.md`, CHG-0433
- `.agents/handoffs/2026-11-17-0930-review-and-refactor-phase-2-fixes.md`
- Quest journal entry 300 (previous integration pushed), and later entries recording this fix
