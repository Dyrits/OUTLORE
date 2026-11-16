# Handoff: Sidebar realms lose their indent

Supersedes: none
Workspace: ISKIOS repository, `main` (committed on top of `0e90106`, then pushed to `origin/main` if the owner approved; check `git log origin/main`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

In the left sidebar, a realm's crest and its quests need no indent under the "Realms" heading (the heading is enough), and the same for the Borderlands. Done means the owner has seen the new alignment in a window and accepts it.

## State

- Done: the 20 px `realmIndent` is removed from `apps/app/src/shell/railStyles.ts` (the constant and the `realmSplit` margin, now `marginLeft: 6`) and from `apps/app/src/shell/sidebar.tsx` (the import and the `paddingLeft` wrapper around each realm, now a plain `View`). Verified: diff read; `bunx biome check apps/app/src/shell` clean; app typecheck produced no errors.
- Verified (file read): the Borderlands section never had such an indent; its quests use the same `paddingLeft: 6` as realm quests now do. Nothing was changed there.
- Not done: no window check; the test suite was not run (a grep found no test or document naming `realmIndent`).
- Documents: changelog `0.1.6-Prototype.md` (CHG-0332).

## Decisions

- Owner (this session): no indent before realm crests; being under the Realms heading is enough. Recorded in CHG-0332.
- Assumed: "same for borderlands" meant its quests should align the same way, which they already do. If the owner meant the Borderlands heading or something else, ask.

## Next

1. Ask the owner to look at the sidebar in a window: realms, their quests, and the Borderlands should share one left edge, with side-quests still stepping in.
2. If the owner wants the heading to read as parent again, try a smaller indent (for example 8 px) rather than restoring 20.

## Open questions

- Did "same for borderlands" mean something beyond the quests' alignment? The owner can answer.

## Sources

`apps/app/src/shell/railStyles.ts`, `apps/app/src/shell/sidebar.tsx`, `documentation/changelog/0.1.6-Prototype.md` (CHG-0332).
