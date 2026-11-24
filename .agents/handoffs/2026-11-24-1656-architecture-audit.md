# Handoff: Architecture audit of 2026-11-24 (waves 1–2 and S6 landed)

Supersedes: `2026-11-24-1612-architecture-audit.md`
Workspace: `/Users/dgerrits/Codelab/Dyrits/OUTLORE`, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Finish the remaining approved candidates from the 2026-11-24 architecture audit (`documentation/architecture-audit/architecture-audit-2026-11-24-0731.html`).
Waves 1 and 2 (P1, P2, P5 chevron, H3, S1, S2, S3, S4, S5, budget-card harness label) and S6 (Chronicler's app guide) are merged on `origin/main`, and the owner's notes for P3, P4, P5, and H2 are recorded in `documentation/backlog.md`.
What remains next is the chained harness wave (H1, H4, H5) and H2 (unified ACP module with dialects, after primary-source research on T3 Code and Paseo).

## State

- **Verified** on `origin/main`:
  - `3576092c` and `8c4ba3ca` landed **P1, P2, P5 chevron** (`CHG-0690`), **H3** (`CHG-0691`), **S3** (`CHG-0692`), **S1** (`CHG-0693`), **S5** (`CHG-0694`), **S2** (`CHG-0695`), **S4** (`CHG-0696`), and the `accountBudgetsCard.tsx` harness-label fix (`CHG-0697`), passing Biome, full 7-package typecheck, 264/267 related service test files (2,129 passed, 3 sandbox-skipped), and 330 app tests (`conversation`, `shell`, `labels`).
  - `67f69147` landed **S6** (`CHG-0698`): `packages/service/src/work/appGuideTopics.ts` derives all 12 harness labels from `harnessNames`/`harnessLabels`, all 4 permission modes from `modeTerms`, and realm inactivity Missive hours from `inactivityMissiveHours` (moved to the `packages/service/src/core/activity.ts` leaf to avoid a module cycle).
  - `packages/service/test/work/appGuide.test.ts` (34/34) pins every `HarnessName`, every permission mode in `modeTerms`, and the Missive quiet hours; pre-commit passed Biome, full 7-package typecheck, and 205/208 related test files (1,646 passed, 3 sandbox-skipped).
  - `documentation/backlog.md` now records the owner's notes for **P3** (live layout-editing toggle as a separate quest), **P4** (state machine option for window composition), **P5** (sidebar rework with multiple display modes), and **H2** (primary-source research on T3 Code and Paseo).
  - Checked `README.md`, `AGENTS.md`, `documentation/architecture.md`, and `documentation/glossary.md`: no stale references to removed wave 1–2 identifiers (`inactivityDays`, `DismissMissionPrompt`, `settingsKeptFromChronicler`, `compareUrgency`).
- **Assumed / not checked**:
  - Visual appearance of P1/P2/P5 chevron and `accountBudgetsCard.tsx` in a running desktop build.
  - Primary-source commits and file paths in `pingdotgg/t3code` (Antigravity ACP and `clientInfo.name` model-catalog gating) and `getpaseo/paseo` (`packages/server` `acp-agent.ts` / `generic-acp-agent.ts` and `tiezbro/paseo-agy-acp`) have not yet been inspected directly or written into `documentation/research/`.
  - Live `initialize` probes for Hermes, Cursor, Copilot, Cline, and Devin (not installed on this machine; Antigravity CLI 1.5.16 was probed and advertises no `mcpCapabilities`, so it still receives no Outlore MCP tool server even after H3).
- **Not yet started**:
  - Chained harness wave: **H1** (one harness definition with derived lists), **H4** (launch, sign-in, and version stated once and read by production and tests), **H5** (test routers built through the real registry).
  - **H2** (one deep ACP module with dialects replacing the three protocol copies in `vibe.ts`, `acpProviders.ts`, and `opencode.ts`).
  - Deferred UI refactors recorded in `documentation/backlog.md`: **P3**, **P4**, **P5** row anatomy.

## Decisions

- **H1, H4, H5**: The owner wants each of H1, H4, and H5 tackled (as separate errands if running from a harness with `open_thread`, or chained sequentially because they touch the same harness registration files: `harnesses.ts`, `harnessCatalog.ts`, `acpProviderProfiles.ts`, `standIns.ts`).
- **H2**: The owner wants H2 done carefully, checking how T3 Code (notably Antigravity over ACP) and Paseo implement ACP before designing the unified module; record primary-source findings with commit and path citations in `documentation/research/`.
- **P3**: Deferred; the owner also wants a separate quest later for a live layout-editing toggle usable anywhere in the app (recorded in `documentation/backlog.md`).
- **P4**: Deferred; consider a state machine for `windowViewOf` if helpful (recorded in `documentation/backlog.md`).
- **P5**: Deferred beyond the already-landed `RitualRow` chevron; pair row-anatomy cleanup with a future sidebar rework exploring different display modes (recorded in `documentation/backlog.md`).
- **S6**: Done (`CHG-0698`).

## Next

1. Confirm with the owner whether to run **H1 → H4 → H5** first (chaining them because they edit the same harness files) and, in parallel or right after, run primary-source research on `pingdotgg/t3code` and `getpaseo/paseo` for **H2**.
2. Execute **H1** (one harness definition deriving labels, order, router, models, commands, and test routers), then **H4** (one provider definition for launch, sign-in, probe, and version gate), then **H5** (test routers via the registry with a launch override).
3. Write primary-source research notes in `documentation/research/` for T3 Code's Antigravity ACP implementation and Paseo's ACP client (including how MCP / tool servers and modes are handled with `agy`), then design and build **H2**.
4. Visually verify P1/P2/P5 chevron and `accountBudgetsCard.tsx` in a running desktop build when convenient.

## Open questions

- Does Antigravity CLI support stdio MCP servers (even though `agy 1.5.16` advertises no `mcpCapabilities.http`), or do T3 Code and Paseo pass tools to Antigravity another way? Answering this during H2 research determines whether Antigravity can receive Outlore's thread tools (`open_thread`, `report_result`, etc.) in a future release.
- Do Hermes, Cursor, Copilot, Cline, or Devin advertise `mcpCapabilities.http` on a machine where those CLIs are installed?

## Sources

- `documentation/architecture-audit/architecture-audit-2026-11-24-0731.html`
- `documentation/changelog/0.2.5-Pre-Alpha.md` (CHG-0690 through CHG-0698)
- `documentation/backlog.md` (P3, P4, P5, and H2 entries at the top)
- `documentation/architecture-decision-record/0005-thread-tools-over-mcp.md` and `0008*`, `0011*`, `0020*`
- `documentation/research/t3code.md` and `documentation/research/paseo-daemon.md`
- Commits `3576092c`, `8c4ba3ca`, and `67f69147`
