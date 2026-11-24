# Handoff: Architecture audit of 2026-11-24 (harness wave, H2, unknown usage, and context readings landed)

Supersedes: `2026-11-24-1656-architecture-audit.md`
Workspace: `/Users/dgerrits/Codelab/Dyrits/OUTLORE`, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Close out the 2026-11-24 architecture audit (`documentation/architecture-audit/architecture-audit-2026-11-24-0731.html`) and its follow-up decisions.
Every approved audit candidate is now landed on `origin/main` except the three deferred UI refactors (`P3`, `P4`, and `P5` row anatomy) and optional follow-ups (live one-prompt verification on `agy` and Vibe, `SSH_CONNECTION` per-profile Antigravity token storage, and merging `opencode.ts` into the unified ACP module).

## State

- **Verified** on `origin/main` (checked via `git log` and `documentation/changelog/0.2.5-Pre-Alpha.md` in this session):
  - Waves 1–2 and S6: **P1, P2, P5 chevron** (`CHG-0690`), **H3** (`CHG-0691`), **S3** (`CHG-0692`), **S1** (`CHG-0693`), **S5** (`CHG-0694`), **S2** (`CHG-0695`), **S4** (`CHG-0696`), budget-card label fix (`CHG-0697`), and **S6** Chronicler app guide + backlog notes (`CHG-0698`).
  - Primary-source H2 research: `documentation/research/acp-antigravity-t3code-paseo-2026-11-24.md` (commit `673af434`, pinning T3 Code `93a7cfe7`, Paseo `cf1a5a9e`, and `paseo-agy-acp` `0a47967c`).
  - **H1** (`CHG-0704`) and **stdio-to-HTTP MCP bridge** (`CHG-0705`, commit `c3b17449`): one harness definition in `packages/contracts/src/harnesses.ts` drives every closed list, and `packages/service/src/harness/acpMcpBridge.mjs` gives stdio-only ACP harnesses (including `agy 1.5.16`) access to Outlore's thread tools.
  - **H4** (`CHG-0706`) and **H5** (`CHG-0707`, commit `9a9eb10e`): one `AcpProviderDefinition` per ACP provider owns launch, sign-in, probe, and version gates, and `makeHarnessRouter` takes a `LaunchOverride` so test routers run through the real registry.
  - **H2** (`CHG-0708`, commit `06faea9c`): `packages/service/src/harness/acpHarness.ts` owns the ACP protocol with small dialects for Vibe and the generic ACP providers (restoring file edits and context window to generic providers, adding `session/resume`, `interaction_*` owner questions, and `thought_level` for Antigravity, and replacing six copied fakes with `acpFake.mjs`).
  - **Unknown ACP usage** (`CHG-0709`, commit `e7361035`) and **context readings table** (`CHG-0710`, commit `40a419b7`): ACP providers that report no token counts record `usage: null` (unknown) instead of zero, while migration `0077_context_readings` (`packages/service/src/core/contextReadingsMigrations.ts`) stores `(thread_id, turn_id, model, used, size, recorded_at)` separately so context-only turns (such as `agy 1.5.16`) keep their context gauge, window limit, and soft-limit warnings.
- **Assumed / not verified in this session** (reported by the errands that produced `40a419b7` and `06faea9c`, not re-run here):
  - Biome (0 errors), 7-workspace typecheck, and pre-commit `vitest related` (213/216 files passed, 3 sandbox-skipped, 1,730 tests passed, 0 failed) on `40a419b7`.
  - Live protocol smoke checks (without prompts) on `vibe-acp` 3.1.4 and `agy` 1.5.16, and the earlier live `agy 1.5.16` stdio MCP bridge check recorded in ADR 0005.
  - Visual appearance of P1/P2/P5 chevron and `accountBudgetsCard.tsx`, and end-to-end full-turn runs with tokens on real `agy`, Vibe, or uninstalled CLIs (Hermes, Cursor, Copilot, Cline, Devin).
- **Deferred (recorded in `documentation/backlog.md`)**:
  - **P3** (Island layout geometry + separate quest idea for a live layout-editing toggle).
  - **P4** (data-driven window composition / optional state machine).
  - **P5** (unified sidebar row anatomy, to pair with a future sidebar rework exploring display modes).

## Decisions

- **Unknown usage vs. zero (`CHG-0709`, `CHG-0710`)**: The owner decided unreported ACP token usage must count as unknown (`null`), not zero, and approved storing context readings in a dedicated `context_readings` table so context-only providers keep their gauge without polluting `usage`.
- **OpenCode (`opencode.ts`)**: Recommended and kept on its own loop for now because it already shares the ACP helpers and its sandboxed launch, config-based MCP wiring, and refusal re-prompt loop would become single-harness dialect hooks; revisit after a live turn on `agy` and Vibe.
- **Antigravity model list**: Keeping the 27 suffixed model IDs (`gemini-4-neon-high`, etc.) as probed is acceptable to the owner.
- **H4/H5 defaults kept**: Strict Cursor and Copilot version-line gates in `inspect`; Kimi's provider definition kept (parked, unregistered) for its audit record; `readModels` and `readSignIn` have no `LaunchOverride` yet.
- **Vibe plan quota**: Checked live via `_account/read` (no prompt); Mistral exposes only `usagePercentage`, `resetAt`, and `paygEnabled` (no monetary figure), so Outlore keeps displaying the percentage and reset date without inventing a currency estimate.

## Next

1. Confirm with the owner which follow-up (if any) to take next:
   - Run a one-prompt live turn on `agy 1.5.16` and `vibe-acp` (spends tokens) to verify file edits, context gauge (`context_readings`), and the stdio MCP bridge end to end.
   - Test `SSH_CONNECTION` on `agy 1.5.16` (needs a fresh sign-in) for per-profile Antigravity token storage instead of the shared OS keyring.
   - Start one of the deferred UI refactors in `documentation/backlog.md` (**P3**, **P4**, or **P5** / sidebar rework).
   - Optionally fold `opencode.ts` into `acpHarness.ts` after live-turn verification.
2. Visually verify the desktop app for P1/P2/P5 chevron, `accountBudgetsCard.tsx`, and the context gauge on a context-only Antigravity turn.

## Open questions

- Does the owner want to run a one-prompt live turn on `agy` and Vibe, or test `SSH_CONNECTION` for multi-account Antigravity sign-in?
- Should Cursor and Copilot version-line gates in `inspect` stay strict or relax to generation-number checks once those CLIs are tested on a machine that has them?
- Should `readModels` and `readSignIn` get a `LaunchOverride` matching `makeAdapter`?

## Sources

- `documentation/architecture-audit/architecture-audit-2026-11-24-0731.html`
- `documentation/changelog/0.2.5-Pre-Alpha.md` (`CHG-0690` through `CHG-0710`)
- `documentation/research/acp-antigravity-t3code-paseo-2026-11-24.md`
- `documentation/architecture-decision-record/0005-thread-tools-over-mcp.md`, `0008*`, `0011*`, `0020*`
- `documentation/backlog.md`
- Commits `c3b17449`, `9a9eb10e`, `06faea9c`, `e7361035`, `40a419b7`, and `b6e44825`
