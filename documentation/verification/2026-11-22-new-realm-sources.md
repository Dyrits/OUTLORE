# New realm sources verification

CHG-0645, first verified on `7026ce8769b84ede53046aab2e51e6ce52da17b6` in the New Realm Sources worktree. The branch was then rebased again after `main` moved twice (Ritual form took CHG-0643, remote terminals CHG-0644); the changelog entry renumbered to CHG-0645, and the landing checks cover the rebased tip.

## Observed

| Behavior | Check |
| --- | --- |
| The chooser presents all five sources as buttons | The app test renders the source rows through React Native Web. |
| A realm can link an existing folder or have no folder | The realm name tests create both through the service and read the realm list. |
| A new project exists on disk and is listed as a realm | The repository tests check Git's HEAD and the path returned by the realm list. |
| Git URL and GitHub owner/repo both create linked clones | The service uses real Git with a local bare repository. The GitHub URL is rewritten to the fixture and is retained as the clone's origin. |
| Git failure permits a retry | An invalid Git initialization setting and a missing clone source both return Git's error. The tests check that no destination or realm remains. |
| Existing folders and name confirmation are preserved | An occupied destination stays untouched. A duplicate name prompts before any folder appears. |
| A paired device cannot provision outside its browsable roots or use Git's local file transport | The tests send the requests with the paired device source and check the refusal. |

## Reproduce

- `CI=1 bun run test apps/app/test/realms/realmSourceChoices.test.ts packages/service/test/work/realmRepositories.test.ts packages/service/test/work/realmNames.test.ts` passed all 14 tests.
- `bun run check`, `bun run typecheck`, and `git diff --check` passed.
- From `apps/app`, `CI=1 bunx expo export --platform web --output-dir /tmp/outlore-new-realm-web-0b321042` passed.

## Pending

Desktop and paired-device interaction, including focus, narrow layouts, and the active host's Git credentials. Automated checks use local repositories.
