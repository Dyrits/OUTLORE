# Handoff: Islands layout, Slate theme and pane notches

Supersedes: `2026-11-23-1613-islands-and-nested-buttons.md`
Workspace: OUTLORE, `main` (the work was done on `mission/explore-sidebar-designs-1496211a`, pushed to `origin/main`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Make the floating-card look a layout of the desktop window, with every conversation pane its own island, and give the mockup's colours a theme of their own.

## State

- Done, verified by file read: Islands is the default layout in every theme (CHG-0672, `7c5b8f71`). The Look card has a Layout choice (Islands or Flat), and Canvas, Gap, Radius and Lift show while it is Islands. Settings stay in `localStorage` under `outlore:islands`, which now also holds `layout`; values saved by the earlier build are read as the layout's. Phone width and Android keep the flat layout.
- Done, verified by file read: the mockup's colours are the theme Slate (`slatePalettes.ts`). A stored theme `islands` opens Slate. One, Iskios and Black & white remain.
- Done, verified by file read: Black & white keeps grey surfaces, text, borders and canvas, but its state colours are coloured again, with a new blue Underway (`underway`, `underwaySoft`, `underwayText`).
- Done, recorded verification: the sidebar, each conversation pane (realm, quest or Ritual, errand) and screens without panes are separate islands, including a folded errand. See `documentation/verification/2026-11-23-islands-layout.md`, which has the screenshots.
- Done, by file read and the typecheck only: a pane's notch takes the canvas colour, with the island's hairline around it, so it reads as a bite out of the island (CHG-0673, `f3bf73b9`). The owner asked for this after seeing the first version, which used the island's own colour. It was not looked at in a running app.
- The owner pulled `7c5b8f71` into the main checkout and ran it; the earlier handoff's checkout state no longer applies.
- Not checked: phone width and Android, the plan-limit rings, a Waiting (violet) indicator, dragging the edge between two panes, the sidebar pinned on the right, and the notch in the canvas colour in a running app.
- Not built: the mockup's realm letter tiles, running-quest dots and search box in the sidebar.
- `architecture.md`, `requirements.md` and `outline.md` do not name Islands, so nothing was edited there.

## Decisions

- Islands is a layout and not a theme; the new theme is named Slate (the owner may rename it).
- A notch on a pane's outer edge takes the canvas colour (owner's request, 2026-11-23, replacing the island-colour version in CHG-0672). The realm icon was not changed.
- Black & white keeps colour only where it carries meaning: the activity indicator, status dots, usage rings and graph, the Mana bar and diff colours.
- The owner has not chosen among the five sidebar designs; none was applied.

## Next

1. Run the desktop app and look at the notch in each theme, in light and dark, with an errand pane folded and open.
2. Check phone width, Android, the right-pinned sidebar and dragging the edge between panes.
3. Ask the owner whether to build the realm letter tiles, running-quest dots and search box from the mockup, and which sidebar design, if any, to apply.
4. When "The service failed unexpectedly." appears again, read the service log line it now leaves and fix that request.

## Open questions

- Is the name Slate right for the theme?
- Does the canvas-coloured notch look as the owner wants in every theme?
- What request makes the service fail unexpectedly? The log line will answer.

## Sources

- `documentation/changelog/0.2.3-Pre-Alpha.md` (CHG-0668, CHG-0671, CHG-0672, CHG-0673)
- `documentation/verification/2026-11-23-islands-layout.md`
- `documentation/art-direction/islands-prototype.html`
- `apps/app/src/foundation/islands.ts`, `islandsRules.ts`, `slatePalettes.ts`, `monoPalettes.ts`
- `apps/app/src/shell/paneHost.tsx`, `paneStrip.tsx`, `paneNotches.ts`
- Commits `7c5b8f71`, `f3bf73b9`
