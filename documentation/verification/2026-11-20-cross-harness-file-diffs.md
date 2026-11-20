# Verification of file diffs across harnesses

The owner asked for the existing Steps file diff on every harness, including in folders without Git.
The batch started at `801e8c77`.
The stand-ins send harness notifications over their real adapters to the service, and the tests read the resulting counts through `ReadMission` and the changed lines through `ReadFileDiff`.

- Codex reports a successful three-file patch with an update, a creation, and a deletion, then reports a failed patch; the test checks the three file steps, counts, and literal leading plus in the added file.
- OpenCode sends a sparse ACP completion update with old and new text, and the test checks that it becomes a single file step.
- Vibe sends a write result whose ACP diff block omits the old text, and the test checks that the overwrite uses the previous text in the raw result and that a denied write and an edit without a reported diff each keep the original step without counts.
- Existing Claude Code tests cover edit and whole-file write capture, storage limits, and approval handling.

The Codex app-server source establishes that additions and deletions carry plain text while updates carry a unified patch. [Codex item builders](https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/src/protocol/item_builders.rs#L365)
OpenCode's ACP source reports edit blocks and result metadata on completion. [OpenCode ACP agent, v1.1.50](https://github.com/sst/opencode/blob/v1.1.50/packages/opencode/src/acp/agent.ts#L739)
The installed Vibe 3.1.3 sources `vibe/acp/session_updates.py` and `vibe/app_server/_effect_models.py` show how completed write results expose `fileExisted` and `previousContent` when available.

Shell edits and tools that provide no file data cannot supply a diff.
Legacy overwrites may lack reliable previous text and display a note with unknown counts.
The checks use stand-in harnesses, and live provider turns and a new desktop visual check remain unverified.

All 26 focused file-diff tests, workspace lint, and the whitespace check passed.
The broader seven-file run reported 76 passes and two plan-limit failures for Codex and OpenCode.

The focused file-diff files passed all 26 tests in `packages/service/test/work/{harnessFileChangeSteps,fileChangeSteps,fileChanges}.test.ts`.
A wider seven-file run had 76 passes and two failures in the Codex and OpenCode plan-limit tests before the final Vibe step-preservation change.
