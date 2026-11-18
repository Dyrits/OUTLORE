# Handoff: A paired device updates its host

Supersedes: none
Workspace: OUTLORE, branch `mission/remote-update-of-hosts-33903a26` rebased onto `origin/main` (`32e1ae7`), to be pushed to `origin/main` with this handoff

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

When a device (phone, browser, another desktop) runs a later release than its paired host, the owner taps **Update host** on the device; the host installs the new release once no turn is running, restarts, and the device reconnects by itself with its stored pairing. Done means the owner has run it on a real phone against a packaged macOS host.

## State

- Verified now: the work is one commit on top of `origin/main` `32e1ae7`, "Let a paired device update its host (CHG-0517, CHG-0518)". The rebase had a conflict in `documentation/changelog/0.1.10-Prototype.md`, several times, because `main` took CHG-0508 to CHG-0516 (phone menu foot, context window, sign-in, plan-limit rings, summons ring, teal dot, archiving). Both sides were kept and this work was renumbered to CHG-0517 (agreement) and CHG-0518 (delivery), including every reference in the specifications, architecture, verification record and work in progress. `git range-diff` shows no code change from the rebase.
- Verified now, on the rebased tip: `bun run check` clean; `bun run typecheck` clean on all workspaces; `CI=1 bun run test` 270 files (266 passed, 4 skipped), 2,222 tests (2,167 passed, 55 skipped).
- Verified now (by reading the tests): a real relay and real databases prove a browser device and a desktop device are refused on the plain link (close 4003), served on the update link, and that after the host restarts on the same database the same pairing resumes with no new code (`packages/service/test/update/deviceUpdate.test.ts`).
- Assumed: the old-host case is a stand-in (an unknown request tag, which the real host fails with `InvalidInput`), not a real older host.
- Assumed, never run: a real phone, a packaged macOS host installing through `UpdateController.install()` from this request, the look of the banner, button and question, and retry timing against the real relay over a real install. They are listed in `documentation/verification/2026-11-18-host-update.md`.
- Verified now: the main checkout's uncommitted Vibe harness and usage chart edits are not part of this work and were not touched.

## Decisions

- Trigger is one tap, never automatic; the question says running turns finish first. The host waits for zero running turns and never stops a turn for this (CHG-0517).
- A device of another release uses a second, update link that carries only `ReadHostUpdate` and `UpdateHost`; its own link is untouched. The host cannot tell a resuming device's release, so it trusts that device to send only those two (device-pairing specification).
- A forced check ignores the owner's "check automatically" switch, because the owner asked for this update.
- Retry keeps the existing back-off (1 s doubling to 30 s) and gives up only on code 4002; a flat 1 s was refused because every try costs a relay connection from the shared allowance.
- No ADR: the desktop-to-service channel through the utility process's parent port is a reversible detail.
- Limits agreed: a host older than this feature must be updated by hand once; the browser on the relay's one deployed build offers the update only when that build is newer than the host; no forced install over running turns; the armed install is in memory and is lost if the host restarts on its own.

## Next

1. Ask the owner to try it: a phone one release ahead of a packaged macOS host, tap **Update host**, watch the progress, the host quitting and returning, and the phone reconnecting by itself.
2. Check a packaged macOS host installing through `UpdateController.install()` from this request, and the look of the banner, button and question on a phone and in a window.
3. If the real relay's allowance bites during a long install, revisit the retry back-off with that evidence.
4. Consider a forced install over running turns only if the owner asks.

## Open questions

- Does the real install keep the phone connected for the whole restart on a packaged build? Only the owner's phone check can answer.
- Is the banner wording and placement right? The owner decides.

## Sources

- `documentation/capabilities/app-updates/specifications.md#updating-a-host-from-a-paired-device` and `documentation/capabilities/device-pairing/specifications.md`.
- `documentation/changelog/0.1.10-Prototype.md` (CHG-0517, CHG-0518) and `documentation/verification/2026-11-18-host-update.md`.
- `packages/contracts/src/hostUpdate.ts`, `packages/service/src/update/`, `apps/desktop/src/serviceUpdates.ts`, `apps/app/src/foundation/hostUpdate.ts`, `apps/app/src/shell/hostUpdateOffer.tsx`.
- The commit "Let a paired device update its host (CHG-0517, CHG-0518)".
