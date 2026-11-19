# Handoff: code simplification across the codebase

Supersedes: none
Workspace: repository `OUTLORE` (`/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`), branch `code-simplification` (one commit on top of `main`, pushed to `origin`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

A behavior-preserving review of the whole codebase against `documentation/conventions.md`, then the refactors it found. Done when the branch is merged and the 28 sandbox-only test failures are seen to pass on the owner's machine.

## State

- **Done, committed on branch `code-simplification` and pushed (not merged into `main`; the commit hash is in `git log`):** shared helpers, `switch` statements removed, files past 512 lines split, single-letter names replaced. CHG-0529 in `documentation/changelog/0.1.12-Prototype.md` lists each change.
- **Verified now:** `bunx biome check .` clean (968 files); `bun run typecheck` passes on all workspaces; `TMPDIR=<repo>/.tmp-test CI=1 bun run test` gives 2160 passed, 55 skipped, 28 failed, 2243 tests in 282 files. A clean checkout gives 2157 passed, 55 skipped, 28 failed, 2240 tests, with the same 28 failing: `git init` in a thread's sandbox cannot copy its hook samples, so the `worktrees`, `claudeWorktrees`, `approvalsFolders`, `folderPicker` and `ownCopies` tests and one `.gitignore` test fail there.
- **Assumed:** that the app and desktop window behave as before; nothing was opened in a window or on a phone. The 28 failures were not run on the owner's machine.
- **Test run leaves a `.tmp-test` folder** in the repository root (made for the run, deleted after); Biome reads it as source if it is left.
- **Left as they were:** 40 production files between 257 and 512 lines (the soft limit); `isRecord` in `packages/channel` (it cannot import `contracts`) and in `apps/desktop/scripts`; the per-harness `usageOf` (each reads other field names).

## Decisions

- In `apps/app`, tagged unions are branched with `if` chains, not `Match.valueTags`: Biome's React lint rejects capitalized handler keys there (`noComponentHookFactories`). The convention's `Match.valueTags` stays for Effect code in `packages/service`.
- The new shared type is `AppUpdateSettings`, not `UpdateSettings`: `UpdateSettings` is already the settings request in `packages/contracts/src/settingsRequests.ts`.
- The desktop imports contracts sources by relative path (`../../../../packages/contracts/src/...`), as `updates/releases.ts` already does, not through the package.
- A split keeps every export; `packages/contracts/src/index.ts` re-exports the new files with `export *`.

## Next

1. Have the owner review the branch `code-simplification` and merge it into `main`.
2. Run the full suite on the owner's machine, where `git init` works, and confirm the 28 failures pass.
3. Optionally continue with the 40 files over 256 lines, the largest first: `shell.tsx`, `codex.ts`, `threadTools.ts`, `questPanel.tsx`; and `roomCore.test.ts` (348 lines).

## Open questions

- Should the new `isRecord` in `contracts` also serve `packages/channel`, by moving it to a package both depend on? Nothing decides it yet.

## Sources

- `documentation/conventions.md` (Naming, Size, Branching).
- `documentation/changelog/0.1.12-Prototype.md` (CHG-0529).
- `git log main..code-simplification` and `git diff main...code-simplification`.
