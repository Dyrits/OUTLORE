# Handoff: A modified file's diff in its step

Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS, branch `mission/diff-view-for-modified-files-9978e8a0` (own worktree `.worktrees/diff-view-for-modified-files-9978e8a0`), not merged, not pushed

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner wants to see the diff when a file is modified, with or without git, folded in the thread. Done is: built, verified, recorded, and merged into `main`.

## State

- Built and committed on the branch (CHG-0531, [changelog 0.1.12-Prototype](../../documentation/changelog/0.1.12-Prototype.md)): Claude Code `Edit`/`MultiEdit` (from the call's input) and whole-file `Write` (previous text read in memory just before the write) give a step with `+added −removed` that unfolds to the diff. Code: `packages/service/src/work/fileChanges.ts` (what a call changed, the stored form), `lineDiffs.ts` (the line diff), `activities.ts` (`saveActivityChange`, `readFileDiff`, the list with counts only), the call site in `work/threads.ts`, migration `0060_thread_activity_diffs`, the `ReadFileDiff` request in `packages/contracts`, and in the app `conversation/callStep.tsx`, `diffView.tsx`.
- Verified 2026-11-19: Biome clean; `bun run typecheck` clean; `TMPDIR=<repo>/.tmp-test CI=1 bun run test` gives 2192 passed, 55 skipped, 28 failed, the same 28 sandbox-only `git init` failures as on a clean checkout (CHG-0529); 32 new tests pass.
- Verified in a real throwaway window (fake harness, light look, wide and 390 px): an Edit and a Write fold open to the right diff ([verification](../../documentation/verification/2026-11-19-file-diff.md)).
- Not verified: a live Claude Code; a phone; the dark and other looks.
- The changelog number CHG-0531 was the next free one in this worktree; renumber at the merge if `main` took it. `AGENTS.md`'s handoff list in this branch links this handoff and drops the oldest; the main checkout's own uncommitted `AGENTS.md` change may conflict.

## Decisions

- Placement in the step, from the edit, storage of the diff only, loaded on demand: the owner's, recorded in the quest journal entry 1.
- The Write race: when the file already holds the text written, the step says the previous text is not known (no counts) rather than guessing. A pre-tool hook, or Claude Code's `tool_use_result` (`tool_use_result` appears in the 2.1.327 binary's stream-json user messages; its patch fields are unprobed), would remove the race.
- A call that reaches the permission prompt shows as its action and keeps no diff (it may be denied). Mine to choose; the alternative is linking a question to its tool-use id and showing the diff on an allowed action's line.
- The diff is my own line diff, no library; 64 KB per file; files over 1 MB and binary files get a note and no diff; no per-thread total cap.
- `NotebookEdit` is left out. Codex, OpenCode and Vibe are left out and recorded in the changelog.

## Next

None in flight. Candidates: probe a live Claude Code for the Write race and `tool_use_result`; a diff on an allowed action's line; show a failed call's diff differently; a per-thread cap; probe Codex's `fileChange` item and Vibe's `rawInput` for edits.

## Open questions

- The owner's look in a window and on a phone, and in the dark and other looks.
- Whether the 64 KB cap and the 1 MB limit are right.
- Whether a failed call (an `old_string` that is not in the file) should still show its diff.

## Sources

- [Changelog 0.1.12-Prototype](../../documentation/changelog/0.1.12-Prototype.md), CHG-0531
- [Specification](../../documentation/capabilities/action-approval/specifications.md#a-modified-files-diff)
- [Verification](../../documentation/verification/2026-11-19-file-diff.md) and its `drive.ts` and screenshots
