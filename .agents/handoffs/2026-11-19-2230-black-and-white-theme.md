# Handoff: A black and white theme

Supersedes: none (forked from `2026-11-19-2008-connectors-on-main.md`)
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner asked for a black and white theme. Done is a third theme in the Workshop's Look card, with a dark and a light look, that reads well and that the owner has seen in a window.

## State

- Built, committed on `main` (CHG-0552): theme `mono`, shown as "Black & white", in `apps/app/src/foundation/monoPalettes.ts` (new), registered in `themeName.ts`, `themeRules.ts`, `palettes.ts`, `settings/lookCard.tsx`, and in the desktop's `apps/desktop/src/appIcon.ts` (same icon as One). Glossary entry added. Verified: Biome clean on those files; `bun run typecheck` passes on all workspaces; `apps/app` foundation tests 208 passed, 6 skipped; the desktop `appIcon` test passes. New tests: the theme is offered and read, contrast thresholds for text, accent and state colors in both looks, no color has a hue.
- Assumed, not seen: how it looks in a window or on a phone; every screen that uses a state color still reads without hue.
- `bun run check` at the repository root fails on the `.tmp-test/` scratch folder (test leftovers), not on source files; verified by running Biome on the touched files alone.
- The commit also carried, by choice, the connector panels' changelog entry (CHG-0551), its handoff and the `AGENTS.md` pointer, which were staged by another errand; that errand's code was left staged and uncommitted.

## Decisions

- Strictly no hue in the palette, state colors included (differ by a step of grey): the owner asked for black and white; a hue for danger and success is one line per token if they want it. Recorded in CHG-0552.
- One stays the default; picker order One, Iskios, Black & white.

## Next

1. Ask the owner to look at the theme in a window, dark and light, on the Workshop, a conversation, and the rail.
2. Adjust state colors if danger and success are hard to tell apart.

## Open questions

- Should state colors keep a hue? The owner answers.

## Sources

- `documentation/changelog/0.1.13-Prototype.md`, CHG-0552
- `apps/app/src/foundation/monoPalettes.ts`, `apps/app/test/foundation/palettes.test.ts`
- `documentation/glossary.md`, "Black & white"
