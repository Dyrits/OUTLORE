# Handoff: the Charter's Code Mode switch on main

Supersedes: `2026-11-17-2347-charter-code-mode-switch.md`
Workspace: OUTLORE, branch `main` (the switch is commit `e157de8`, fast-forwarded from `worktree/charter-switch`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Let the owner see and use the Code Mode option: the Charter place, minimally, with one global switch "Code Mode for connectors". Done when the owner sees it in a window and a change is stored.

## State

- Verified now: local `main` was fast-forwarded to `e157de8` (`git log`), the branch's only commit over `dfd11d3`.
- Recorded by the superseded handoff, not re-run here: Biome, the seven typechecks and `CI=1 bun run test` (2,045 passed, 54 skipped) passed on that commit.
- The push of `main` to origin needs the owner's approval; check `git status -sb` to see whether it happened.
- The main checkout holds the release quest's uncommitted version bump to `0.1.7-Prototype` (`apps/app/package.json`, `apps/desktop/package.json`, `bun.lock`). It is not part of this work and was not committed here.
- Not checked: the page in a window or on a phone, and a stored change surviving a restart. With no connector gateway the setting changes nothing visible.

## Decisions

- Minimal Charter at the owner's request of 2026-11-17: only the Connectors section. The Charter's sidebar note still says "Devices and relays"; not touched.
- The owner wants the "Release new tag" quest to run its release only after this is on `main`; that quest was asked to pause earlier and told to go on once the push succeeded.

## Next

1. The owner looks: `bun run dev` from the checkout, open the Charter in the sidebar, switch Code Mode on and off.
2. Decide the sidebar note and whether Chronicler and Rituals may change Code Mode (see the [review handoff](2026-11-17-2316-release-review.md)).
3. Check on the Android app, and that a change applies from a thread's next turn once a gateway exists.

## Open questions

- Should the Charter's sidebar note, "Devices and relays", change now that it holds Connectors?
- May Chronicler and Rituals change Code Mode?

## Sources

- [Superseded handoff](2026-11-17-2347-charter-code-mode-switch.md).
- [Connectors specification, Code Mode](../../documentation/capabilities/connectors/specifications.md#code-mode).
- [Changelog](../../documentation/changelog/0.1.7-Prototype.md) CHG-0444.
- `apps/app/src/charter/`, `apps/app/test/charter/codeMode.test.ts`.
