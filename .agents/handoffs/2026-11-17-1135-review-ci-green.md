# Handoff: review and refactor, CI green on main

Supersedes: `2026-11-17-1120-review-ci-dependency.md`
Workspace: OUTLORE, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Finish the whole-codebase review and refactor. The mechanical work, the behaviour fixes of slices A to E and the CI dependency fix are done and published; the deferred work below remains.

## State

- Verified with `git ls-remote origin main` and `git rev-parse`: local and origin `main` are both at `6c198f7` ("Fix clean CI installs by declaring controller Effect dependency"). The working tree was clean when this was written.
- Verified with `gh run view 44063954500`: the GitHub run for `6c198f7` is completed with conclusion success. It covered frozen install, Biome, the seven typechecks, the test suite and the web export. The previous failing run was 44047901516 (controller did not declare `effect`).
- Verified earlier in the session: the full suite on `716f4e1` gave 1939 passed, 0 failed, 54 skipped of 1993 (sandbox, `CI=1`, `XDG_DATA_HOME` unset, pty tests skipped). The manifest-only fix did not rerun the full suite; 177 targeted tests passed on a clean export.
- Assumed, not run: the `main` checkout itself (it needs `bun install` outside the sandbox).
- The `rr-*`, `worktree/*` and `.worktrees/rr-reports/` folders are kept; `rr-reports` is ignored by Git and holds the review evidence.

## Decisions

- Effect stays a runtime dependency of the controller (ADR 0010).
- The owner wants no new sandbox-related approval asks in the product, and a release mismatch at pairing must not leave a device or burn the code (quest lore, round 6).
- Any push to `main` needs the owner's approval of the exact command; the pre-push guard refuses plain pushes, so past approved pushes used `git push --no-verify origin main`.
- Done keeps the word "Done"; CSP stays deferred until a real browser is available.

## Next

1. Before merging `worktree/context-window`, renumber its migration 0054 above main's latest (0055). A database that already ran 0055 would otherwise skip 0054 silently.
2. Open behaviour items: SP-C-09 (token presence, needs a migration above 0055), the rest of SP-C-20, SP-C-17 (image refusal happens at turn start for OpenCode, not at send; owner to confirm), a queued image at Ritual `beginRun`, a failing Codex `listModels` skipping a fallback candidate.
3. Never done: relay CSP (needs a real browser), review of the remaining `apps/app` folders (about 130 files: shell, conversation, settings, editors, realms, lore, quests, rituals), triage of slice F and G Standards findings against the merged tree (reports in `.worktrees/rr-reports/slice-f-*.md` and `slice-g-*.md`).
4. Human acceptance: narrow question cards, live harness runs, pairing across two releases, packaged desktop with the Electron fuses, a real Windows run, a relay dry-run deploy.

## Open questions

- SP-C-17: does the owner accept refusal at turn start for OpenCode images?
- Which of the deferred reviews the owner wants next, and when.

## Sources

- https://github.com/Dyrits/OUTLORE/actions/runs/44063954500
- `.agents/handoffs/2026-11-17-0930-review-and-refactor-phase-2-fixes.md` (full list of decisions and human checks)
- `.agents/handoffs/2026-11-17-1120-review-ci-dependency.md`
- `documentation/changelog/0.1.6-Prototype.md` (CHG-0371 to CHG-0433)
- `.worktrees/rr-reports/`
