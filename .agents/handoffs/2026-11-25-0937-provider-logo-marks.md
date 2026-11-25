# Handoff: provider logo marks

Supersedes: none
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS, branch main

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The Providers list shows each harness with its real brand mark, legible at 24 px on dark and light surfaces. Done when the owner confirms in the running app that no mark reads wrong.

## State

- Committed on main as "Rebuild provider marks from their official brand assets" (rebased onto origin/main at ad838bab; the commit hash is in `git log`). Pushed: no, see Next.
- Hermes: NousResearch wing (light body and blue accent) in `apps/app/src/ui/hermesWingPath.ts`, both layers with `rule: "evenodd"` to match NousResearch `catalog-wing.svg`, so internal cutouts stay open.
- Pi: official three-colour pi.dev mark.
- Cursor: Simple Icons cube. Cline: Simple Icons robot head, in the theme text colour.
- Devin: LobeHub mark (MIT) split into its three brand layers, `#3969CA`, `#21C19A`, `#0294DE`.
- Muse: LobeHub mark (MIT) in Meta blue `#0082FB`, from LobeHub `muse-color.svg`.
- Gemini (Antigravity), Claude, Codex, Copilot, OpenCode, Mistral: unchanged.
- `ProviderMark` in `apps/app/src/ui/providerMarks.tsx` draws one or more coloured layers and takes an optional viewBox.
- Verified: `bun run vitest run apps/app/test/ui/providerMarks.test.ts` gives 16 passed (re-run on 2026-11-25 at 09:36, before the rebase).
- Verified at commit time (before the rebase): workspace typecheck and Biome passed in the pre-commit hook.
- Recorded, not re-run in this session: all 12 `ProviderMark` components were rendered in Electron at 40 px and 24 px on dark `#1c2a3b` and light `#f8f4ee`. The render mocked `react-native` with `react-native-web` and `react-native-svg` with plain `<svg>`/`<path>`, so it did not run the native app.
- Assumed: the marks look right in the running app. Not yet checked by the owner.

## Decisions

- Brand marks come from their official sources, not hand-drawn shapes: NousResearch, pi.dev, Simple Icons (Cursor, Cline), LobeHub (Devin, Muse, both MIT).
- Muse is Meta blue `#0082FB` (from LobeHub's SVG). Devin keeps its three brand colours. Cline uses the theme text colour, since its brand colour is near-invisible on dark.
- Hermes wing paths (about 50 KB) live in their own module so `providerMarks.tsx` stays readable.

## Next

1. Run `bun run typecheck` on the rebased tip (main at this commit) before pushing. The rebase replayed the commit without the pre-commit hook.
2. Push main to origin with owner approval. The pre-push hook refuses protected-branch pushes, so the push needs `--no-verify` after the owner approves it.
3. Owner opens the Providers list in the running app at 24 px and reports which marks still read wrong.
4. Fix any mark the owner flags, then add a changelog entry under the next version's file in `documentation/changelog/` (not written yet; the CHG id is not claimed).

## Open questions

- Owner: do the marks read right at 24 px in the running app? Which ones do not?
- Owner: is `#0082FB` the intended Muse colour, or should Muse stay in the theme text colour?

## Sources

- `apps/app/src/ui/providerMarks.tsx`
- `apps/app/src/ui/hermesWingPath.ts`
- `apps/app/test/ui/providerMarks.test.ts`
- Commit "Rebuild provider marks from their official brand assets" on main
- NousResearch `catalog-wing.svg` (even-odd fill reference)
- LobeHub `muse-color.svg`, `devin-color.svg` (MIT), in the LobeHub icon set
