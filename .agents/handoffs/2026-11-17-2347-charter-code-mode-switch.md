# Handoff: the Charter's Code Mode switch

Supersedes: none
Workspace: OUTLORE, branch `worktree/charter-switch` (worktree `.worktrees/charter-switch`, from `main` at `dfd11d3`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Let the owner see and use the Code Mode option: the Charter place, minimally, with one global switch "Code Mode for connectors". Done when the owner sees it in a window and a change is stored.

## State

- Verified by the final local run: Biome, the seven workspace typechecks, and `CI=1 bun run test` inside the sandbox (2,045 passed, 54 skipped) pass.
- Built: `apps/app/src/charter/charterScreen.tsx` draws the Charter (a heading, then a Connectors card with the switch, an Experimental tag, a state line and a plain-words explanation). It reads and writes `shouldUseCodeMode` through `ReadSettings` and `ChangeSettings` as the Workshop does. `codeMode.ts` holds the words. `appScreen.tsx` shows the page instead of the unbuilt line; `placeCatalog.ts` lets the Charter resume on a restart; `SettingsHeading` takes a title, line and icon.
- Not checked: the page in a window or on a phone (the same app, so the place catalog is shared), and a stored change surviving a restart.
- Not built: connectors, the Vault, per-quest or per-realm switches. With no connector gateway the setting changes nothing visible.

## Decisions

- Minimal Charter at the owner's request of 2026-11-17: only the Connectors section. The Charter's sidebar note still says "Devices and relays", while remote access still lives in the Workshop; not touched here.
- The page copies the Workshop's heading and card, so the two read alike.

## Next

1. The owner looks: from the worktree run `bun run dev`, open the Charter in the sidebar, switch Code Mode on and off.
2. Merge into `main` with the owner's approval; push only with it.
3. Check on the Android app, and that the change applies from a thread's next turn once a gateway exists (see the [review handoff](2026-11-17-2316-release-review.md)).

## Open questions

- Should the Charter's sidebar note, "Devices and relays", change now that it holds Connectors?
- May Chronicler and Rituals change Code Mode (also open in the review handoff)?

## Sources

- [Connectors specification, Code Mode](../../documentation/capabilities/connectors/specifications.md#code-mode) and [blueprint](../../documentation/capabilities/connectors/blueprint.md).
- [Changelog](../../documentation/changelog/0.1.7-Prototype.md) CHG-0444 and [work in progress](../../documentation/work-in-progress.md).
- `apps/app/src/charter/`, `apps/app/test/charter/codeMode.test.ts`.
