# Approval terms and question lifecycle audit

Authorized by the owner's request to implement all candidates in the 2026-11-15 architecture audit. Starting commit: `dbb3ae6`. Worktree: `.worktrees/audit-approvals`, branch `worktree/audit-approvals`. Covers candidates 1, 6 and 7 (CHG-0301–0303).

## What changed

- `work/approvalTerms.ts` reads the owner's settings, the adapter's containment and applicable stored grants for both turns and previews. The prompt names sorted distinct permission kinds; another exact grant of the same kind leaves it unchanged. This wording was the parent's choice, to redirect.
- Claude's question decoding and answer encoding live in `harness/claudeChoices.ts`; `answer_prompt` remains an MCP tool. Other adapters pass neutral choices through `HarnessPrompt.choices`. Choice answers are separate from approval decisions.
- Codex ordinary `item/tool/requestUserInput` calls wait for the owner's answers and return them by question id. The mapping follows Codex 0.169.0's generated `ToolRequestUserInputQuestion`, `ToolRequestUserInputAnswer`, `ToolRequestUserInputResponse` and `ToolRequestUserInputParams` inspected at `/private/tmp/claude-501/codex-schema/v2/`. A stand-in app-server round trip covers the real adapter and service. My choice, to redirect: secret questions continue receiving empty answers until a private input exists. OpenCode remains deferred: its ACP transport here exposes no question request.
- `work/questions.ts` owns asking, answering, validation, recording and withdrawal for Approval, Confirmation and Choice. `work/promptPolicy.ts` owns containment and exact-grant policy. `work/approvalContracts.ts` holds the service seam. Migration `0052_question_kind` classifies saved questions and keeps their outcomes. Approvals is 214 lines; the extracted files are each below 256 lines.

## Checks run here

- `CI=1 bun run test packages/service/test/work/startingContext.test.ts packages/service/test/harness/instructions.test.ts`: 20 passed before the new stored-grant check; starting context alone then passed all 14 checks, including the new one.
- `CI=1 bun run test packages/service/test/core/store.test.ts packages/service/test/harness/harnesses.test.ts packages/service/test/work/approvals.test.ts packages/service/test/work/startingContext.test.ts packages/service/test/harness/codexChoices.test.ts --maxWorkers=4`: 144 passed, 15 skipped, 5 files passed. Includes 52 approval checks and the new migration and Codex round trip.
- `CI=1 bun run test --maxWorkers=4`: 1,633 passed, 50 skipped; 162 files passed, 1 skipped, 168.31 seconds. No failures.
- `bun run typecheck`: all seven workspaces passed; service typecheck repeated after the final type cleanup and passed.
- `bun run check`: passed, 682 files checked.
- `git diff --check`: passed.

## Regression evidence

New tests were added around the resumed implementation; they were not all observed red before implementation. Three temporary mutations were applied separately to the working files, tests run, and each original file restored in `finally`:

1. Replace the distinct-kind set with all stored sentences in `approvalTerms.ts`. Starting-context suite: 1 failed, 13 passed. The stored-grant check sees two identical kinds after the second grant.
2. Force `codexAnswersOf` to always return an empty map. Codex mapping suite: 1 failed, 3 passed. The expected `build.answers` entry is missing.
3. Backfill an existing Approval as Confirmation in migration 0052. Store suite: 1 failed, 4 passed. The pre-kind record is classified incorrectly.

## Limits

No live provider run or window interaction was performed. Codex compatibility is supported by installed generated schemas and the stand-in protocol, not by a live request_user_input probe. Secret input and OpenCode choices remain open. The parent owns integration, final review, work-in-progress and the handoff. No push was made.
