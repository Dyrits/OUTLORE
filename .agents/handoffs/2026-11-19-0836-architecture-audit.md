# Handoff: architecture audit 2026-11-19, report written, no candidate picked yet

Supersedes: none
Workspace: OUTLORE repository, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Run a full architecture-audit pass over the codebase and hand the owner a visual report of deepening candidates (shallow modules, seam leakage, locality failures) with a top recommendation. Done means the owner has picked one candidate from the report and the refinement of that candidate has started; the report alone is not done.

## State

- The report exists and was opened for the owner: [documentation/architecture-audit/architecture-audit-2026-11-19-0825.html](../../documentation/architecture-audit/architecture-audit-2026-11-19-0825.html) (40,304 bytes, self-contained HTML with Tailwind/Mermaid via CDN, eight candidate cards with before/after diagrams, a top recommendation, and a "checked, not proposed" section). Verified now: `ls -la` shows the file; `git status` showed it as the only untracked file before this handoff was committed. `AGENTS.md` already pointed at `documentation/architecture-audit/` (line 27), so no pointer edit was needed there; seven earlier audit reports sit in the same folder.
- No source code changed this session. Verified now: `git status --short` listed only the new HTML file.
- Method: scope was set from commit history (hot spots: `packages/service/src/work/` with 104 modules, `apps/app/src/shell/`); glossary, conventions, architecture.md and ADRs 0002/0003/0005/0008/0010/0016/0018/0020 were read first and not re-litigated. Three read-only exploration passes ran in parallel over `work/`, `apps/app/src/`, and `core`/`harness`/`remote`/`lore`/`contracts`/`channel`/`controller`/`relay`; their findings were merged into the eight cards.
- The eight candidates, strongest first: (1) one Chronicler structural-action module — the `guildmaster*` 14-file sprawl in `packages/service/src/work/`, four tool handlers hand-wiring `consumeReceipt`; (2) break the `work/` folder's 43-file import ring at the `commands.ts` seam (leaf `FollowUps` data module + runner receiving `Threads`/`Approvals`/`Suggestions` as layer inputs; removes the double runner in `threads.ts:259-267`) — the report's top recommendation; (3) one realm-resolution module owning the name-collision rule (copied in six SQL sites) and the two `findRealm` variants; (4) one `acp.ts` session module behind the already-deep `HarnessAdapter` seam (`opencode.ts`/`vibe.ts` duplicate the ACP session skeleton); (5) `index.ts` seam per folder in `apps/app/src` plus five upward imports fixed, including the `foundation/shellContext ↔ editors/companionPicker` ring over `CompanionPickerProps`; (6) sidebar hot spot: action logic out of `sidebar.tsx` into a tested pure module, `questTree.ts` split by job; (7) inline label derivations in tsx (runner line ×3, your-turn dot color ×2, suggestion label ×2) moved into deep modules in `foundation/labels.ts`; (8) one `core/run.ts` for the six `Effect.runPromiseWith` escape hatches, and `ownRelay.ts`'s thrown-`Stop` control flow into typed Effect failures.
- The owner answered the report's closing question ("which candidate to explore?") with: commit and push, work on it later. So no candidate is selected; nothing is in flight beyond the committed report.
- Committed and pushed to `origin/main` with this handoff (this session).
- The audit ran against `main` at c71a867d. While this handoff was being pushed, another session landed CHG-0529 (code simplification: shared helpers, smaller files) and CHG-0530 (sidebar corner marks) as 8d4b7677; this handoff was rebased on top. Re-check the report's file:line evidence against the new tip before building on it — the simplification batch may have moved or shrunk some of the named files.

## Decisions

- Handoffs are shared and committed (AGENTS.md Handoffs section); this handoff starts a new thread, so `Supersedes: none`.
- The audit used the modules vocabulary (module, interface, depth, seam, adapter, leverage, locality, deletion test) and the glossary's domain names (quest, thread, errand, realm, lore, Chronicler; code keeps `guildmaster`/`sideQuest`/`intel`).
- Decision-record conflicts were not surfaced except where real: candidate 8 applies ADR 0010's "Effect wherever possible" rather than reopening it; candidate 4 does not conflict with ADR 0008; no candidate reopens 0002/0015/0018.
- AGENTS.md keeps only the three newest current handoffs linked; adding this one dropped the 2026-11-18-2105 link (the file remains in the folder).

## Next

1. Ask the owner which of the eight candidates in the report to explore (the report's top recommendation is candidate 2, breaking the `work/` ring at the `commands.ts` seam).
2. For the chosen candidate, walk its decision tree with the owner before any code: constraints, dependencies, the shape of the deepened module, what sits behind the seam, which tests survive; settle glossary terms or record a decision record inline if a load-bearing choice appears.
3. When implementation is authorized, take the next free CHG number (check the newest changelog file under `documentation/changelog/` and the backlog), implement test-first, and append the delivery to that release's changelog file.

## Open questions

- Which candidate the owner wants first (they deferred the choice).
- Whether candidate 2's ring-break is enough on its own or should land together with candidate 1 (the `guildmaster*` merge), since both touch `work/` wiring.
- Whether the app-side candidates (5-7) should be scheduled as their own batch, given the sidebar is the current UI hot spot.

## Sources

- The report: [documentation/architecture-audit/architecture-audit-2026-11-19-0825.html](../../documentation/architecture-audit/architecture-audit-2026-11-19-0825.html); earlier audits in the same folder, newest `architecture-audit-2026-11-15-2323.html`.
- [documentation/architecture.md](../../documentation/architecture.md), [documentation/conventions.md](../../documentation/conventions.md), [documentation/glossary.md](../../documentation/glossary.md), [documentation/architecture-decision-record/](../../documentation/architecture-decision-record/) (0002, 0003, 0005, 0008, 0010, 0015, 0016, 0018, 0020 read), [documentation/work-in-progress.md](../../documentation/work-in-progress.md).
- Evidence paths named in the report: `packages/service/src/work/` (commands.ts, threads.ts:259-267, threadToolHandlers.ts, guildmaster*.ts, realmNames/realmChecks/realmCreation/realmActions/guildmasterPlace), `packages/service/src/harness/` (opencode.ts, vibe.ts, openCodePrompts.ts, core/execution.ts:229-274), `packages/service/src/remote/ownRelay.ts`, `apps/app/src/shell/` and `apps/app/src/foundation/`, `packages/contracts/src/requests.ts`.
