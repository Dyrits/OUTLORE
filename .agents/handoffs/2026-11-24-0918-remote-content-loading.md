# Handoff: Remote content loading

Supersedes: none
Workspace: Outlore, `worktree/remote-query-refresh` rebased onto `origin/main` at `2207ba4b`.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Verify that a phone already paired with an active host can load content while the host publishes changes and continue using the saved pairing.

## State

- Verified in the query regression fixture: the previous hook discarded a successful reply when a host change preceded it, and the fixed hook shows the reply and queues one follow-up read.
- Verified before the rebase: workspace typecheck, Biome, and 16 focused tests passed, including paired-browser reconnects.
- Verified before the rebase: the interrupted full suite reported failures in `tracking.test.ts` and `codeExecutor.test.ts`, and all 41 tests in those files passed in three focused runs, including twice with retries disabled.
- Verified by the rebase diff: both changelog entries survived, and the application and test changes are identical to the original fix.

## Decisions

- Keep one read in flight per mounted query and coalesce changes received during it.
- Keep the existing pairing and transport paths.

## Next

1. With a build containing the fix, open a quest or Chronicle on an already paired phone while the host is publishing changes and verify that the first content appears and continues updating.
2. If it still stalls, capture the screen and the approximate time, then trace request completion and delivery for that window to distinguish a slow or missing reply from a rendering issue.

## Open questions

- Does the installed phone reproduce the stall with this fix, and on which screen?
- What caused the two service failures under the broader suite run?

## Sources

- [Release entry CHG-0681](../../documentation/changelog/0.2.4-Pre-Alpha.md#chg-0681--2026-11-24--content-loads-while-the-host-keeps-changing)
- [Query hook](../../apps/app/src/foundation/useServiceQuery.ts)
- [Regression test](../../apps/app/test/foundation/useServiceQuery.test.ts)
- [Pairing and reconnect coverage](../../packages/service/test/remote/browserDevice.test.ts)
