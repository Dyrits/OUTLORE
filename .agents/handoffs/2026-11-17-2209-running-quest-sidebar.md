# Handoff: running quest always in the sidebar

Supersedes: none
Workspace: OUTLORE, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The sidebar's Realm and Borderlands lists show their three newest quests; a running quest must stay visible beyond that limit, as the open quest already does. Done when the owner sees a running quest in the sidebar past the three, in the running app.

## State

Goal is implemented in the working tree on `main`, not committed when this was written (the commit is the step that follows this handoff).

- Done: `visibleQuestsOf` in `apps/app/src/shell/railOutline.ts` keeps the open quest and every quest whose `state` is `Running`, each in its place in the newest-first list. Verified: file read and diff.
- Done: test "keeps every running quest past the normal placement limit, in its place in the list" in `apps/app/test/shell/railOutline.test.ts`, written first and seen failing, then passing. Verified: `bunx vitest run test/shell/railOutline.test.ts` run in `apps/app`, 3 tests passing after the change.
- Done: the shell test folder passes 108 tests. Verified: `bunx vitest run test/shell` run in `apps/app`.
- Done: spec line in `documentation/capabilities/mission-tracking/specifications.md` (Realm and Borderlands lists) now names running quests and cites CHG-0440. Verified: file read.
- Done: CHG-0440 in a new `documentation/changelog/0.1.7-Prototype.md`, since 0.1.6 is tagged. Verified: file written; not re-read.
- Biome passes on the two code files. Verified: `bunx biome check` on both files, "No fixes applied".
- Not verified: the running desktop app's sidebar with a running quest past the third. Assumed the rule behaves in the window as in the test.
- Not verified: the full test suite.
- Known unrelated failures in this checkout (verified by test output): `test/shell/pairingOffer.test.ts` and `test/shell/qrScan.test.ts` fail to load with `Cannot find package '@outlore/channel/base64url'`.
- Known unrelated typecheck failures (verified by `tsc --noEmit` in `apps/app`): 31 errors, all in `packages/relay` and `packages/channel`, with the same missing-package cause. None in the changed files.

## Decisions

- "Running" means quest state `Running` only. A quest in `Attention` (asking the owner) is not kept beyond the limit, because the spec gives Summons precedence over running (`documentation/capabilities/mission-tracking/specifications.md`, state rules). If the owner wants those kept too, it is a one-line change in `visibleQuestsOf`.
- Running quests keep their place in the newest-first list; they are not moved to the top.
- The "Show all N quests" link and its count are unchanged.

## Next

1. Commit the four changed files on `main` (the three edited files and the new changelog) with a message naming CHG-0440.
2. Push `main` to origin, after the owner approves the push.
3. Open the desktop app with a realm holding four or more quests, one of them running, and check the sidebar shows it past the third. Owner's judgment on how it looks.

## Open questions

- Should a quest in `Attention` also stay visible beyond the limit? Owner decides.
- Does the owner want the running check verified in the desktop window before the push, or after? Owner decides.

## Sources

- `apps/app/src/shell/railOutline.ts` (`visibleQuestsOf`)
- `apps/app/test/shell/railOutline.test.ts`
- `documentation/capabilities/mission-tracking/specifications.md` (Realm and Borderlands lists; state rules)
- `documentation/changelog/0.1.7-Prototype.md` (CHG-0440)
- Quest journal entry 1 (CHG-0440 summary)
