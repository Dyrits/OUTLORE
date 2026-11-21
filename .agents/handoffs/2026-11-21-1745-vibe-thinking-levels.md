# Handoff: Mistral Vibe's reasoning levels in the Companion menu

Supersedes: none
Workspace: Outlore, branch `worktree/vibe-thinking-levels` (worktree `.worktrees/vibe-thinking-levels`), landing on `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Mistral Vibe shows its reasoning levels in the Companion menu again (CHG-0618), and every commit names the provider and model that wrote it.

## State

- Verified by a live probe run 2026-11-21: the installed `vibe-acp` 3.1.3 answers `session/new` with five models, none carrying the `_meta["mistral.ai/thinking"]` levels Outlore read alone; the levels it does offer (`low`, `high`, `max`) sit on the session's own `thinking` config option.
- Verified red-green, run 2026-11-21 in the worktree: the model-list test in `packages/service/test/harness/vibe.test.ts` first failed expecting the level-less model to carry the session's levels (1 failed, 10 passed), then passed after the fix (11 passed). Through the fixed code, the live `listVibeModels` returned all five models with `low`, `high`, `max`.
- Verified by the pre-commit hook on committing `7056efb7` (CHG-0618): 1311 tests passed, 14 skipped, 0 failed across the affected files; Biome and every workspace typecheck pass.
- Verified by the commit just before this handoff: `7056efb7` on `worktree/vibe-thinking-levels` holds the fix (`packages/service/src/harness/vibeAccount.ts`), its test, the changelog entry, the provider-accounts spec line, the research-note follow-up, and `documentation/verification/2026-11-21-vibe-thinking-levels.md`. The landing push to `main` is part of this handoff's batch; confirm `git log origin/main` holds it (assumed until then).
- The main checkout holds another session's uncommitted Rituals work; local `main` there is behind and was never touched. All work happened in the worktree.

## Decisions

- A Vibe model that says no thinking levels of its own takes the levels of the session's `thinking` config option, which `vibe-acp` 3.1.3 offers for every model alike; a model that carries its own `_meta["mistral.ai/thinking"]` levels keeps them, so a newer Vibe release takes over per model with no change (CHG-0618, recorded in the provider-accounts specifications and the research note).
- Owner, 2026-11-21: every commit message in this repository ends with a standalone attribution line in the form `<Provider> - <Model>`, such as `Mistral - Z.ai GLM 5.3`, naming the provider and model that wrote it; added to AGENTS.md's Tooling and Git section with the same push.

## Next

1. Confirm the landing: `git fetch origin && git log origin/main -3` shows the CHG-0618 commit and the handoff commit on `main`.
2. Window check (the one evidence still missing): launch the desktop app against this `main`, pick Mistral Vibe in the Companion menu, and see the reasoning level offered as low, high, max with a model chosen.
3. When a newer `vibe-acp` release ships, re-run the live probe in the research note: models carrying their own `_meta` levels then override the fallback per model, which the code already handles.

## Open questions

None beyond the window check in Next.

## Sources

- `packages/service/src/harness/vibeAccount.ts` — the fallback in `modelOptionListOf` and `sessionThinkingLevelsOf`
- `packages/service/test/harness/vibe.test.ts` — the model-list test asserting the fallback
- `documentation/verification/2026-11-21-vibe-thinking-levels.md` — recorded checks and how to re-run them
- `documentation/research/mistral-vibe-acp-2026-11-18.md` — the 2026-11-21 live-probe section
- `documentation/changelog/0.2.1-Pre-Alpha.md` — CHG-0618
- `AGENTS.md` — the commit attribution line in Tooling and Git; this handoff's pointer
