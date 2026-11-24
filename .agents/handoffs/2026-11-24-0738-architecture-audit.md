# Handoff: Architecture audit of 2026-11-24

Supersedes: none
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Find deepening opportunities in the code that changed after the 2026-11-21 audit, and present them to the owner. The work then builds the candidates the owner chooses, after an interview on each: its constraints, the shape of the deepened module, what sits behind its seam, and which tests survive. This part is done when the owner has picked candidates and each one is built and verified.

## State

- The report is committed as `documentation/architecture-audit/architecture-audit-2026-11-24-0731.html`. It holds 15 candidates:
  - H1–H5, harness roster
  - P1–P5, shell and panes
  - S1–S6, service work

  It also has a check of the 2026-11-21 audit's follow-through, a "Checked, not proposed" list, and the top recommendation: H2, one ACP module with dialects, carrying H3. The candidates came from three read-only explorer errands; their full results are in the quest journal (entries 2–4).
- **Verified** by reading the code at 94f1bace, before the report was written:
  - Hermes, Antigravity, Cline, Copilot, Cursor and Devin start with no tool server. `acpProviders.ts:285` uses `mcpServers ?? []`, and `harnesses.ts` passes none for those six.
  - `apps/app/src/settings/accountBudgetsCard.tsx:71` is a three-way ternary, so every other harness shows "OpenCode".
  - `shouldAllowRemoteTerminals` is missing from `settingsKeptFromChronicler` (`packages/service/src/work/guildmasterSettingNames.ts:9-17`).
  - `inactivityDays` is read only by `promptOf` (`missions.ts:208`) and the Workshop field.
  - The pane notches re-sort errands by their index in `ReadMission.threads` (`paneNotches.ts:157-164`).
  - The Cursor and Copilot sign-in, executable and spawn constants are read only by their own tests (`git grep`).
- **Verified** at a0ad5f37: CHG-0679 (92fa82e3), which landed during the audit, now sorts sidebar siblings by latest activity (`questTree.ts:92`). The notches still follow tree order, so P1 still holds. The report's P1 card says so.
- **Assumed**, as reported by the explorers and not rechecked:
  - The diff and drift figures for H2 (vibe.ts against acpProviders.ts).
  - The paths in S1 by which a paired device could reach `change_setting` or a Ritual scope.
  - The counts for S2 (47 `Schema.Null` results; 4 handler groups outside `satisfies OwnerHandlers`).
  - The six sweep loops in S4 and their error boundaries.
  - The 22 Islands branches in P3.
- Nothing is built. No code changed.

## Decisions

- The audit is scoped by recent change: commits since 2026-11-21. That leaves out apps/desktop, packages/controller, the relay, and the phone-only screens; the report says so.
- The report flags two decision records:
  - H3 contradicts ADR 0005 (thread tools reach ACP harnesses over MCP). Either wire the tool server or amend the record.
  - P3 follows the owner's `Island` building-block direction from `.agents/handoffs/2026-11-23-2015-notch-colour.md`, not an ADR.
- Lore fc08b908 was corrected: the Cursor and Copilot constants are test-only.

## Next

1. Ask the owner which candidate to explore. The report ends by asking "Which of these would you like to explore?"
2. For the chosen candidate, interview the owner on its decision tree before designing its interface. Settle any new term in `documentation/glossary.md`. If the owner rejects a candidate for a reason future audits need, offer a decision record.
3. If S1 is chosen, or before any other build, write a failing test first. Send a paired-device message to Chronicler that names `shouldAllowRemoteTerminals`, then call `change_setting`. Do the same through a Ritual scope. If the gap is real, it outranks the rest.
4. Build in `.worktrees/<name>`, run `bun run typecheck`, `bun run check` and the focused tests, and record a CHG entry in `documentation/changelog/0.2.4-Pre-Alpha.md`. First grep the CHG id against a fresh `origin/main`.

## Open questions

- H3: should the six ACP harnesses get Outlore's tool server, or should ADR 0005 be amended so they run tool-less, like Pi? The owner decides, after one live harness check.
- S3: should the orphaned "Inactive" prompt, its request and the `inactivityDays` setting be deleted, or should the setting drive the Missive hours? The owner decides.
- P5: is the missing `isAlwaysShown` fold chevron on `RitualRow` intended? Ask the owner, or check CHG-0635's specification.

## Sources

- `documentation/architecture-audit/architecture-audit-2026-11-24-0731.html`
- `documentation/architecture-audit/architecture-audit-2026-11-21-0702.html` and `architecture-audit-2026-11-19-0825.html`, the earlier audits
- `documentation/architecture-decision-record/0005*`, `0008*`, `0011*`, `0020*`
- `documentation/capabilities/conversation-terminal/specifications.md:23` and `documentation/capabilities/mission-tracking/specifications.md:78,197`
- Commits 908f57c5, 96e0103a, 8ece9dd9, 89e5a655, e572b6c2, 92fa82e3, 94f1bace and 42d8bec7
