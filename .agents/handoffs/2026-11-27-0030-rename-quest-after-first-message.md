# Handoff: a new quest renames itself after its first message (CHG-0776)

Supersedes: none
Workspace: OUTLORE repository, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

A quest is created as "Quest" and is renamed once its first message is sent, by its own top thread. Done when a new quest, on a real harness turn, is named by its top thread without the owner's help, the change is committed and pushed to `origin/main` with the owner's approval, and the quest journal records it.

## State

- Done in code (CHG-0776, in `0.2.10-Pre-Alpha.md`):
  - `set_mission_title` is a direct tool, listed to the model and not reachable only through `run_code` (`packages/service/src/work/threadTools.ts`, `directToolNames`). Cause found: with Code Mode on, the tool was hidden inside `run_code`, so the top thread never saw it. Verified: `file read` of the diff.
  - The naming nudge: while a quest's top thread is still "Quest", or an errand is still "Errand", the turn's note asks for a name (`namingLineOf` in `packages/service/src/work/titles.ts`, used by `readSections` in `packages/service/src/work/startingContext.ts`). It is in the per-turn note, not the system prompt, so the prompt cache is not restarted. It is skipped when `is_title_by_user` is set, so an owner rename, even to "Quest", stops it (`SPEC-02`, fixed test-first).
  - `startingContext.ts` was split: token and sizing helpers moved to `packages/service/src/work/startingContextSizing.ts` (new file; `startingContext.ts` 156 lines, sizing 118 lines), and `threadPanel.ts`, `tree.ts`, `questsHandlers.ts` import from it.
  - Specifications and glossary updated: `documentation/capabilities/connectors/specifications.md` (five direct tools), `documentation/capabilities/mission-tracking/specifications.md`, `documentation/glossary.md` ("Five thread tools").
  - Verified now (run at 00:28 UTC, 2026-11-27): `CI=1 bunx vitest run` on `threadTools`, `startingContext`, `titles`, `dashboard` and `codeMode` tests: 5 files, 59 tests passed. `bunx biome check` on the 11 touched TypeScript files: clean. `bun run --filter @outlore/service typecheck`: exit 0.
- Not verified: a live turn on Claude Code, Codex or OpenCode with Code Mode on, that sees `set_mission_title` and names a new quest. Assumed to work from the code and the tests only.
- In flight: the commit of CHG-0776 only. It is staged, not yet committed, when this file was written. The staged set is the CHG-0776 files listed in Sources. `documentation/changelog/0.2.10-Pre-Alpha.md` and `documentation/glossary.md` were staged in part: only the CHG-0776 entry and the "Five thread tools" line, built from the `HEAD` versions. Other quests' hunks in those two files are not staged.
- Not part of this commit, left uncommitted by design: another quest's API key account work (CHG-0775: `apps/app/src/settings/keyAccountForm.tsx`, `packages/service/src/work/keyAccounts.ts`, `packages/service/src/harness/accountKeys.ts`, `packages/service/src/work/accountKeys.ts`, `documentation/architecture-decision-record/0029-…`, `documentation/research/provider-api-keys-2026-11-27.md`, and many modified files), and another quest's message-marks work (CHG-0777: `#`, `+`, `$`, and their tests). Those hunks are in the same working tree and are not touched here.
- Push: not done. `origin/main` was not compared with local `main` in this session. Assumed: a fetch and `git rev-list --left-right --count origin/main...main` are needed first.
- Sandbox git quirk: the environment sets `GIT_CONFIG_COUNT=5` without `GIT_CONFIG_VALUE_0`, so every `git` call fails with "missing config value GIT_CONFIG_VALUE_0". Workaround used here: `GIT_CONFIG_COUNT=0` in front of each git command. Verified: `git status`, `git diff --cached --stat` ran with it.
- Quest journal entries #1 to #3 (thread "Rename quest after first message") record the decisions and the SPEC-02 fix.

## Decisions

- The lighter fix was chosen by the owner over a service-side fallback that would name a quest with a separate model call. Every model call goes through a harness, so the fallback would start its own process. Reconsider only if quests still stay "Quest" on a harness with no tool server.
- Naming is a per-turn note line, not a system prompt change, so renaming does not restart the prompt cache. Chronicler and asides are not asked to name themselves.
- An owner rename stops the nudge and also stops `set_mission_title` (`is_title_by_user`), even if the owner renames a quest back to "Quest".
- The nudge says "now", so the model acts on the turn it sees it.

## Next

1. Owner decision: commit only CHG-0776 (as staged) or also the other quests' work. This handoff assumes CHG-0776 only.
2. Commit the staged set with the hand-off attribution line from the repository instructions, after the pre-commit hook passes. Do not bypass the hook.
3. Push to `origin/main` only after the owner approves in the same thread. Run `git fetch origin` and compare with `origin/main` first.
4. Start a new quest on a real harness (Claude Code first) and check that its first turn calls `set_mission_title` and the title changes from "Quest". Record the result in the quest journal and in the changelog Validation line.

## Open questions

- Whether the owner wants the other quests' work committed in the same commit or separately. Owner of the working tree decides.
- Whether a live Claude Code, Codex or OpenCode turn names the quest. Only the owner or a run on a real harness can settle it.

## Sources

- `packages/service/src/work/threadTools.ts` (`directToolNames`)
- `packages/service/src/work/titles.ts` (`namingLineOf`, `set_mission_title` guard)
- `packages/service/src/work/startingContext.ts` (`readThreadSubject`, `readSections`)
- `packages/service/src/work/startingContextSizing.ts` (split from `startingContext.ts`)
- `packages/service/test/work/titles.test.ts`, `packages/service/test/work/threadTools.test.ts`, `packages/service/test/connectors/codeMode.test.ts`
- `documentation/capabilities/mission-tracking/specifications.md` (Title), `documentation/capabilities/connectors/specifications.md` (Code Mode)
- `documentation/glossary.md` (thread tools entry), `documentation/changelog/0.2.10-Pre-Alpha.md` (CHG-0776)
- `packages/service/src/harness/instructions.ts` (the thread instruction that tells the top thread to call `set_mission_title`; not changed)
- Commit: the commit that adds this handoff (`git log --oneline -1`)
