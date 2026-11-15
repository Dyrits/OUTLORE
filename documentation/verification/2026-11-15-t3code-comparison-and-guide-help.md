# T3Code comparison and Chronicler's corrected help

## Verdict

Partly proven. The four corrected help claims in Chronicler's guide are proven by tests that fail on the old text and pass on the new. The documentation corrections and the T3Code findings are source reading, not runtime behavior, and are unproven in the sense of this record: no code observes them. The reproduction was by the same agent, not a fresh one.

## Scope

- Starting revision `1d664b3`; rebased onto `origin/main` `6f61706` (CHG-0286 and CHG-0287, browser pairing and the relay serving the web app) before committing; the batch is CHG-0288.
- Changed code: `packages/service/src/work/appGuideTopics.ts` (help text only) and four tests in `packages/service/test/work/appGuide.test.ts`. Everything else is documentation.
- The app was not started.

## Claims

| Claim | Evidence | Verdict |
| --- | --- | --- |
| The guide no longer promises own copy or a merge button | `current-state claims` test 1 | proven |
| The guide says updates are checked and downloaded and install on "Restart and update" | test 2 | proven |
| The guide lists the host folder picker as built and only the terminal as unbuilt | test 3 | proven |
| The guide does not say Outlore is one user on one computer | test 4 | proven |
| Own copy, `clone_repository` and `list_workspaces` are not in the code | `grep -rIl -i -e clone_repository -e CloneRepository -e ownCopy -e list_workspaces apps packages --exclude-dir=node_modules --exclude-dir=dist` printed nothing, run before the help text change | observed, not shown able to fail |
| T3Code findings | Reading its README, docs and file names at `0de6ddb` and `3e7f5ec`; see [the note](../research/t3code.md) | unproven (not run) |

## Checks

From the repository root, Bun 1.4.3:

```sh
bun install --frozen-lockfile --ignore-scripts
bun run check        # Biome: no fixes applied
bun run typecheck    # exit 0, all workspaces
CI=1 bun run test    # 159 files passed, 1 skipped; 1622 tests passed, 18 skipped
git diff --check
```

Before and after: in a clean worktree of the rebased `HEAD` with only the new test file copied in, `bun run test packages/service/test/work/appGuide.test.ts` reported 4 failed, 22 passed, the four `current-state claims` tests. On the working tree it reports 26 passed. Earlier in the session the same four were red before the text edit and green after.

Not done: mutation checks beyond the before/after, a fresh-context reproduction, the Electron window, and any live provider.

## Failures and pre-existing issues

None. After rebasing, the app and controller packages first failed typecheck and tests because the workspace was not installed for the new `@outlore/controller` package; `bun install --frozen-lockfile --ignore-scripts` fixed it.
