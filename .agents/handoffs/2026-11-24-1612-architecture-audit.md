# Handoff: Architecture audit of 2026-11-24 (waves 1 and 2 landed)

Supersedes: `2026-11-24-0738-architecture-audit.md`
Workspace: `/Users/dgerrits/Codelab/Dyrits/OUTLORE`, branch `main` (aggregated in `.worktrees/audit-integration`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Work through the approved candidates of the 2026-11-24 architecture audit (`documentation/architecture-audit/architecture-audit-2026-11-24-0731.html`).
Waves 1 and 2 (P1, P2, P5 chevron, H3, S1, S2, S3, S4, S5, plus the account-budget harness label fix) are now integrated together; what remains is the chained harness refactor (H1, H4, H5) and any deferred large refactors (H2, P3, P4, P5 row anatomy, S6) the owner chooses to pursue.

## State

- **Verified** in `.worktrees/audit-integration` (branch `worktree/audit-integration`, based on `origin/main` `b2bf45ef`):
  - **P1, P2, P5 chevron** (CHG-0690): `apps/app/src/conversation/errandRoster.ts` and `apps/app/src/shell/realmRoster.ts` unify errand order/folding/preview and the quest/Ritual split; `RitualRow` keeps `fold.isAlwaysShown: true`.
  - **H3** (CHG-0691): `packages/service/src/harness/acpProviders.ts` passes the thread's HTTP MCP tool server when `initialize` advertises `agentCapabilities.mcpCapabilities.http === true`, and appends `noToolServerInstructions` otherwise; ADR 0005 is updated.
  - **S3** (CHG-0692): `DismissMissionPrompt`, `promptQuestionOf`, the Workshop inactivity-days field, and `inactivityDays` are deleted while stored/legacy payloads remain harmlessly ignored.
  - **S1** (CHG-0693): `packages/service/src/core/settingAuthority.ts` maps every `keyof Settings` to its widest writer (`HostOwner`, `Owner`, `Chronicler`, `Ritual`), keeping `shouldAllowRemoteTerminals` at `HostOwner`.
  - **S5** (CHG-0694): `modeTerms` in `packages/service/src/work/threadPermissionMode.ts` is the single table of permission-mode meaning read by `approvalTerms.ts`, `promptPolicy.ts`, and `policy/containment.ts`.
  - **S2** (CHG-0695): `OwnerHandlers<RequestTag>` returns `ResultOf<Tag>`, `Service.handle` is generic, inline handlers in `service.ts` are folded into typed groups, and the test fixture encodes answers through wire schemas.
  - **S4** (CHG-0696): `packages/service/src/core/localCalendar.ts` and `packages/service/src/work/timedSweep.ts` unify local calendar math and resilient log-and-retry sweeps.
  - **Budget card label** (CHG-0697): `apps/app/src/settings/accountBudgetsCard.tsx` uses `harnessLabels[budget.harness]`.
  - **Verified checks** in `.worktrees/audit-integration`: Biome (`bun run check`, 0 errors), focused service tests (`acpProvidersHarness`, `instructions`, `tracking` 47/47; `settingAuthority`, `settingsAuthority`, `guildmasterSettings`, `backgroundCheckInSchedule`, `defaultBackups`, `presets` 27/27; `modeTerms`, `permissionModes`, `requestHandlerTypes` 30/30; `localCalendar`, `timedSweep`, `sweepFailures`, `ritualSchedule` 36/36), focused app tests (`apps/app/test/conversation` and `apps/app/test/shell`), and the full workspace typecheck (`bun run typecheck`).
- **Assumed / not checked**:
  - Visual appearance of P1/P2/P5 chevron and `accountBudgetsCard.tsx` in the running desktop app.
  - Live `initialize` probes for Hermes, Cursor, Copilot, Cline, and Devin (not installed on this machine; only Antigravity CLI 1.5.16 was probed and advertises no `mcpCapabilities`).
  - The old per-errand worktrees under `.worktrees/address-audit-feedback-*` still exist on disk and can be pruned once merged.
- **Not yet started**:
  - Chained harness wave: **H1** (one harness definition with derived lists), **H4** (launch, connect, and version stated once), **H5** (tests via the registry).
  - Deferred larger refactors: **H2** (one ACP module with dialects), **P3** (Island frame), **P4** (window composition as data), **P5** (sidebar row anatomy), **S6** (app guide derived from modules).

## Decisions

- **S3**: The owner chose to delete the orphaned inactivity question and `inactivityDays` setting rather than wiring it to Missive hours.
- **P5**: The owner confirmed `RitualRow` lacked its fold chevron by oversight (fixed here) and deferred the larger row-anatomy refactor.
- **H3**: Generic ACP harnesses receive the thread tool server only when `initialize` advertises `agentCapabilities.mcpCapabilities.http === true`, and receive `noToolServerInstructions` otherwise (recorded in ADR 0005).
- **Big refactors deferred**: H2, P3, P4, P5 row anatomy, and S6 were deferred to a later session after waves 1 and 2.

## Next

1. Confirm with the owner whether to start the chained harness wave (**H1**, then **H4**, then **H5**) or pick one of the deferred refactors (**H2**, **P3**, **P4**, **P5**, **S6**).
2. Remove the superseded per-errand worktrees `.worktrees/address-audit-feedback-*` if no longer needed.
3. Visually verify the sidebar/Errands tab/Ritual chevron and account budget labels in a running desktop build when convenient.

## Open questions

- Do Hermes, Cursor, Copilot, Cline, or Devin advertise `mcpCapabilities.http` in their `initialize` response on a machine where those CLIs are installed?
- Which remaining audit candidate should come next: the chained H1 -> H4 -> H5 harness wave, or H2 (unified ACP module)?

## Sources

- `documentation/architecture-audit/architecture-audit-2026-11-24-0731.html`
- `documentation/changelog/0.2.5-Pre-Alpha.md` (CHG-0690 through CHG-0697)
- `documentation/architecture-decision-record/0005-thread-tools-over-mcp.md`
- `documentation/architecture-decision-record/0020-conversation-terminal.md`
- `documentation/capabilities/mission-tracking/specifications.md`
