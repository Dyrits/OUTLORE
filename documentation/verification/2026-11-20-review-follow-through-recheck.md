# Review follow-through recheck

The app suite and the Chronicle, quest move, wake admission and Git grant suites ran on commit `896d3aa0` with 690 passing and eight skipped.

```sh
bun run test apps/app/test packages/service/test/work/chronicle.test.ts packages/service/test/work/questMoves.test.ts packages/service/test/work/turnAdmission.test.ts packages/service/test/harness/codexGitGrants.test.ts
```

The pane extraction passed all 43 focused tests, including the three new folded-errand cases, and the workspace typecheck.
The app typecheck also passed after the Companions layout extraction.
The wake and Git grant suites passed 23 checks with two live checks skipped.
To opt in to the latter on a Mac with Codex and Seatbelt available, set `OUTLORE_LIVE_CODEX=1`.

```sh
bun run test apps/app/test/shell/paneNotches.test.ts apps/app/test/shell/childNotches.test.ts apps/app/test/shell/paneChain.test.ts
bun run test packages/service/test/harness/harnessProcesses.test.ts packages/service/test/harness/codexGitGrants.test.ts
bun run check
bun run typecheck
```

Desktop verification remains open for the Fulfilled errand's open, fold, and reopen sequence and the Companions layout.
The Chronicle's row handler opens the conversation and still needs to use the target message or request.
