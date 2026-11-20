# Handoff: cross-harness file diffs in Steps

Supersedes: none
Workspace: Outlore repository, branch main

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner wants the unified file diff in the conversation Steps view, which CHG-0531 built for Claude Code only, to work for Codex, OpenCode, and Vibe as well, including in folders without Git. Done means each harness's completed edit shows a diff row in Steps through its real adapter, with accurate attribution and documented limits.

## State

The patch is CHG-0593, written by an errand in an isolated worktree and copied into the main checkout. It adds `packages/service/src/harness/fileEditEvents.ts`, adapter changes in `codex.ts`, `opencode.ts`, and `vibe.ts`, shared changes in `fileChanges.ts`, `threads.ts`, and `core/execution.ts`, stand-in fixtures, and `packages/service/test/work/harnessFileChangeSteps.test.ts`.

Verified on 2026-11-20 in the main checkout: the 5 tests in `harnessFileChangeSteps.test.ts` pass (run with `ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron node_modules/vitest/vitest.mjs run <file>`), and `bun run typecheck` exits 0 for all 7 workspaces.
Reported by the errand and not rerun here: 26 focused file-diff tests, workspace lint, and diff whitespace check passed in its worktree; a wider run of 7 files had 76 passes and 2 failures in the plan-limit tests of Codex and OpenCode.
Assumed: the plan-limit failures are unrelated to this patch, since no source for them was inspected.
Not verified: no real Codex, OpenCode, or Vibe binary was run; the tests use stand-in harnesses, and no desktop visual check was recorded for the new harnesses.
The commit of this patch was started in the main checkout; check `git log` for its presence before anything else. The working tree also holds unrelated uncommitted edits to `apps/app/src/shell/paneChain.ts`, `paneHost.tsx`, `paneStrip.tsx`, and `apps/app/test/shell/paneChain.test.ts` from another session; they are not part of this work.

## Decisions

Capture stays per adapter, translating each harness's reliable native edit events into the shared diff pipeline, rather than a global file watcher. A watcher would also catch shell edits but would lose attribution when edits overlap; the owner raised the question and requested no change.
A Vibe edit keeps its original step and a completed diff upserts that same step by native tool-call ID, so edits with no diff or denied edits never vanish from Steps.
Limits and availability are recorded in `documentation/capabilities/action-approval/specifications.md`, the changelog `documentation/changelog/0.1.13-Prototype.md`, and `documentation/verification/2026-11-20-cross-harness-file-diffs.md`.

## Next

1. Confirm the CHG-0593 commit exists on main, and push it to origin main only with the owner's approval.
2. Run the full test suite on the owner's machine to confirm the 2 plan-limit failures are unrelated.
3. Do a visual check of a diff row for each new harness in the desktop app.
4. Decide whether shell-made edits need a separate capture path.

## Open questions

Whether the owner wants a global watcher for shell edits in addition to adapter capture; the owner decides.
Whether the plan-limit failures predate this patch; a run on the base commit answers it.

## Sources

`documentation/capabilities/action-approval/specifications.md` (A modified file's diff), `documentation/verification/2026-11-20-cross-harness-file-diffs.md`, `documentation/verification/2026-11-19-file-diff.md`, `.agents/handoffs/2026-11-19-1615-file-diff-in-steps.md`, `packages/service/src/work/fileChanges.ts`, `packages/service/src/harness/fileEditEvents.ts`, `packages/service/test/work/harnessFileChangeSteps.test.ts`, `apps/app/src/conversation/callStep.tsx`, baseline commit `0bf4c2aa` (CHG-0531).
