# Handoff: Force host update over running turns

Supersedes: none
Workspace: Outlore, main

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

A paired device (phone, browser, second computer) can force the host's update when turns are still running, instead of waiting or stopping the turn by hand on the host. Done means the owner taps Force update on a phone one release ahead of a packaged macOS host and finds the phone reconnected after the host restarts.

## State

Commit `32a7b9bf` (CHG-0664) is on main; it was fast-forwarded from `mission/update-during-running-turn-b6198594`. Verified: `git log` shows it on main.
It adds a `ForceUpdateHost` request, separate from `UpdateHost`, so a host older than this feature fails with InvalidInput instead of ignoring a flag and waiting. The service skips the wait on force, and the app shows a **Force update** button only in the WaitingForTurns state, behind a confirmation. The app-updates specification and `documentation/changelog/0.2.3-Pre-Alpha.md` are updated.
The errand reported that the service, contracts and app foundation tests pass (256 passed, 6 skipped), Biome is clean, and the commit hook ran the typecheck. I did not rerun them (assumed).
Not tried: a real phone, a packaged macOS update, the confirmation dialog on screen, and the full repository test suite.
Turns are cut by the host quitting at install, as in the desktop's Restart and update: at the next start `threads.ts` marks running turns interrupted. The tests use a fake updater, so real harness shutdown is untested.
Pushing to the remote needs the owner's approval. This handoff's commit and the push were requested after the merge.

## Decisions

Force is its own request, `ForceUpdateHost`, not a flag on `UpdateHost`, so that older hosts fail readably (shown as "This host is too old to force an update from here…").
Force reuses the existing quit-at-install path and adds no second way to stop turns, so turns are cut abruptly and recovered at startup. This is recorded in the app-updates specification.
A plain Update host still waits for turns to finish.

## Next

1. On a phone one release ahead of a packaged macOS host with a turn running, tap Force update, confirm, and check the host installs, restarts and the phone reconnects.
2. Look at the confirmation dialog on the phone and on desktop.
3. Check on the host that the interrupted turns show as interrupted after the restart.
4. Write the missing verification note in `documentation/verification/`, which the changelog entry refers to.
5. A host from before this feature cannot be forced; update it by hand once.

## Open questions

Whether cutting turns without a graceful harness shutdown is acceptable, or the host should interrupt its harnesses before installing. The owner decides.

## Sources

- `documentation/capabilities/app-updates/specifications.md`, section "Updating a host from a paired device"
- `documentation/changelog/0.2.3-Pre-Alpha.md`
- `packages/service/src/update/hostUpdate.ts`
- `packages/contracts/src/requests.ts`
- `apps/app/src/updates/hostUpdateOffer.tsx`
- `apps/app/src/foundation/hostUpdate.ts`
- tests: `packages/service/test/update/hostUpdate.test.ts`, `packages/service/test/update/deviceUpdate.test.ts`, `apps/app/test/foundation/hostUpdate.test.ts`
- commit `32a7b9bf`
