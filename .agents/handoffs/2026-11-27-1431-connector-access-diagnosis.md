# Handoff: Connector access diagnosis

Supersedes: none (forked from `2026-11-27-1133-connectors-oauth-review-and-fixes.md`)
Workspace: /Users/dgerrits/Codelab/Dyrits/OUTLORE (branch `main`, commit `b4fe3d2f`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Find and document why a thread receives no connector tools although the owner connected them, so a later session can debug further and fix the causes. Done means the diagnosis is recorded in the repository with reproduction steps and this handoff, and the next session can pick up each cause without redoing the investigation.

## State

- **Diagnosed, documented and committed on `main` (verified 2026-11-27, debug only — nothing in the app, the database, the Vault or the code was changed).** The full claims-and-evidence record, with the exact probes and reproduction commands, is [documentation/verification/2026-11-27-connector-access-diagnosis.md](../../documentation/verification/2026-11-27-connector-access-diagnosis.md). In short, each of the four installed connectors is unusable for its own reason:
  - **composio** — installed 2026-11-23 but never given its API key: the Vault holds no record for it, so its `Needs connecting` is correct (install is not connect).
  - **gitlab** — a PAT is stored (2026-11-26 14:28 local) but the server refused it, setting the stored mark `GitLab refused its sign-in or permission. Connect it again.`; the connector hardcodes `https://gitlab.com/api/v4/mcp` while the owner's GitLab is self-hosted (`gitlab.hipay.org`), so this token can never work (verified from the 2026-11-26 diagnosis recorded in the Outlore database, quest `e9d7883c-9e38-453f-bbf1-8e4fb51c88a5`).
  - **github** — a PAT is stored (2026-11-26 14:30 local), `needs` is null and the live panel state computes Ready, yet it offers no tools: at each turn start the sessionless `tools/list` fails (class `Failed`, HTTP 400) and that class is silent — `warningOf` returns null, so no thread warning and no mark is written and the listing cache stays empty. This is open item 3 of the 2026-11-26 diagnosis and the one code defect found.
  - **atlassian** — installed 2026-11-27 10:14 local; its browser sign-in stored no OAuth session (the Vault's last write is the github PAT); the sign-in ran under the pre-CHG-0785 app, whose failure paths swallowed the reason.
- The quest journal (entry 1) and three realm lore entries carry the same findings.
- The running app is 0.2.12-Pre-Alpha (built 13:12, launched 13:57 local) and includes CHG-0785 and the warm-session restart-key fix — verified: `git merge-base --is-ancestor 69723d9b 0.2.12-Pre-Alpha` and the tag's `turnRunner.ts` carry the fix's comment.
- The restart-key fix cannot help here — verified by reasoning over the live state: the per-turn snapshot never becomes non-empty, so a warm harness process has nothing to re-list.
- Nothing was fixed; no branch or worktree was created; `git status` was clean before this commit.

## Decisions

- Debug only: the owner asked for the cause, not a change, so no code, configuration, data or credentials were touched, and the throwaway probe script was deleted after use.
- The diagnosis is recorded as a claims-and-evidence document under `documentation/verification/` with no CHG number, because nothing was built or delivered; the work-in-progress file points at it.
- The four connectors are treated as four independent causes, not one shared fault: the shared snapshot path only hides them, and the single code defect in it is the silent `Failed` listing.

## Next

1. Retry the Atlassian OAuth sign-in in the running desktop window: the exact RFC 6749 error code or HTTP status now stays visible on the connector's card (CHG-0785's pending live check C6), and the error decides whether the fix is a scope pin in `entries/atlassian.ts` or something else; record what it says.
2. Fix the silent `Failed` tools/list (open item 3 of the 2026-11-26 diagnosis): decide whether static-key HTTP entries should send the MCP session handshake (`shouldUseSessionFor` in `packages/service/src/connectors/backends/httpMcp.ts`), whether `warningOf` should warn for `Failed`, or both, and add the regression test at the listing seam (`packages/service/test/connectors/`).
3. Decide GitLab self-hosted support (a configurable instance URL in `entries/gitlab.ts`) or a GitLab.com token; the stored PAT can never work against the hardcoded endpoint.
4. Have the owner add the Composio API key in the Charter's Vault section, or remove the connector.
5. Settle the screenshot's github row (stale client read?): re-open the Quest tab and compare it with the live computation; if it still disagrees, debug the panel's read path.

## Open questions

- The exact failure of the 2026-11-27 morning Atlassian sign-in (token exchange HTTP 4xx, a store refused as NotProtected by the protection probe — the 10:28 vault-folder touch points that way but proves nothing — or a post-sign-in tools/list refusal); only the retry in Next 1 answers it.
- Why the owner's screenshot shows github as `Needs connecting` while the live computation says Ready; a stale `useServiceQuery` read is the hypothesis, unproven from outside the app.

## Sources

- [documentation/verification/2026-11-27-connector-access-diagnosis.md](../../documentation/verification/2026-11-27-connector-access-diagnosis.md) — the full record with reproduction commands.
- [.agents/handoffs/2026-11-27-1133-connectors-oauth-review-and-fixes.md](2026-11-27-1133-connectors-oauth-review-and-fixes.md) — CHG-0785, the thread this one forked from; its open question this diagnosis partly answers.
- `packages/service/src/connectors/` — `connectorState.ts` (the Ready/NeedsConnecting rules), `connectorChoiceCards.ts` (the quest panel's state), `connectors.ts` (`beginTurn` and `refreshFor`), `toolListing.ts` (the in-memory cache), `connectorErrors.ts` (`warningOf`'s null for `Failed`), `backends/httpMcp.ts` (`shouldUseSessionFor`), `entries/gitlab.ts`, `entries/github.ts`.
- `packages/service/src/work/` — `turnRunner.ts` (the turn scope and restart key), `turnScopes.ts`, `vaultWiring.ts` (`holds`).
- `packages/service/src/vault/` — `inspection.ts`, `records.ts`, `keyCustody/macKeychain.ts`, `protection.ts`.
- The 2026-11-26 diagnosis recorded in the Outlore database, quest `e9d7883c-9e38-453f-bbf1-8e4fb51c88a5`, message of 14:53 local.
- `documentation/capabilities/connectors/specifications.md` — install, connect, enable; where a connector is available; what a thread can do with a connector.
