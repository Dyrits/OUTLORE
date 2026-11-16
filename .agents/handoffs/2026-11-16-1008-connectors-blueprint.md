# Handoff: connectors blueprint and the Vault's ADR (proposed), nothing built

Supersedes: `2026-11-16-0835-connectors-specification.md`
Workspace: ISKIOS repository (Outlore), branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Design how connectors are built (connector gateway, tool classification, the Vault, keeping secrets out of the harnesses' sandboxes) so the owner can review and authorize a first build step. Done for this stage means the blueprint and ADR 0022 are agreed; building has not been authorized.

## State

- **Verified by reading the files on 2026-11-16**: `documentation/capabilities/connectors/blueprint.md` (the design, acceptance table, build order, open items) and `documentation/architecture-decision-record/0022-the-vault-encrypts-secrets-and-hides-its-folder-from-sandboxes.md` (status: proposed) exist. They are recorded as CHG-0328 and CHG-0330 in `documentation/changelog/0.1.6-Prototype.md`, and linked from the specification, draft, architecture, backlog and work in progress.
- **CHG-0330** revised both after a second-opinion review (a separate quest, read-only): a key file beside the records is no second layer (no secret stored on a key file unless every available harness is verified to hide the Vault's folder); the key holder is chosen once at creation and written with a format version and key id, so an existing Vault is Locked, Lost or Corrupt and never makes a new key; plus a timing contract for switching off during a call, the Borderlands as an alternative to a realm (not a chain), Apple apps enforced in listing and call, sanitized backend errors, serialized Vault writes, three-step connector removal. One claim of mine was wrong: `policy/patterns.ts` `matchesPattern` already compares literally (audit SA-10 was fixed).
- **Verified by reading source** (2026-11-16, no harness run): connector tools can be served from each thread's own endpoint in `work/mcp.ts` (`core/endpoints.ts` binds token to thread); asking can be built on `work/approvals.ts` and `policy/permissions.ts` with a new capability kind in `policy/patterns.ts`; OpenCode's Seatbelt profile is `(allow default)` with writes denied (`harness/openCodeSandbox.ts`); Claude Code's `sandbox.filesystem.denyRead` exists in the 2.1.322 binary; Codex 0.169.0's generated schema has `read`/`write`/`deny` filesystem entries, while Outlore's Codex adapter uses `workspace-write` (`harness/codex.ts`).
- **Assumed, nothing run**: that each sandbox actually denies the Vault's folder and cannot read the Keychain key; that `security -i` adds a key without exposing it in a command line; that harnesses re-list tools on a reused process and run Outlore's connector tools without a question of their own (Codex accepts its own server's elicitation, OpenCode asks only for shell and edit, Claude Code needs the names in `--allowedTools`; all from source).
- **Not built**: no connector, Vault, gateway, switch, Charter page or setting exists in code. Nothing was run against Composio, Apple apps or any connector server.
- **New Vault states and failure behavior** (Locked, Lost, Corrupt, Not protected from a harness; only rejected credentials mark a connector Needs connecting; a cancelled write may have happened; Removing with Retry) are proposals in `capabilities/connectors/draft.md`, not in the specification.
- **Git**: the two documentation files, the edits above and this handoff are committed on `main` together; `apps/app/src/conversation/*` and `foundation/styles.ts` were modified by another thread and are not part of that commit. A push needs the owner's approval; check `git status -sb` and `git log origin/main..main` for whether it happened.

## Decisions

- All decisions of the superseded handoff still stand (Charter, switches, classification by the catalog, per-tool switches, Composio and `mcp-icloud` first, Code Mode last).
- The blueprint and ADR 0022 are **proposed, not agreed**; the owner has not yet reviewed the revision. Recorded in CHG-0328 and CHG-0330.
- Build order proposed: (1) read-denial probes with a **disposable** secret, authorized separately from the build; (2) the Vault; (3) the gateway with a fake connector; (4) the backends (Composio, Apple); (5) the app; (6) Code Mode.
- Second-opinion findings were checked against source before use; changes are listed in CHG-0330.

## Next

1. Ask the owner to review blueprint and ADR 0022 as revised, and whether to put the proposed Vault states and failure behavior into the connectors specification (they are only in the draft).
2. If they authorize it, run the read-denial probes with a disposable secret (an outside control that reads the Vault's folder and an inside run under each harness's sandbox that cannot; the Keychain read from inside each sandbox; `security -i`), following `documentation/verification/2026-11-14-token-isolation.md` as the model. Do not store a real secret first.
3. Then the Vault, then the gateway with a fake connector, per the blueprint's Order section.
4. Settle the blueprint's Open items before slice 3 or 4: harness re-listing, no harness question on connector tools, the warning path, macOS Automation attribution under a login service, backups.

## Open questions

- Owner: accept the proposed Vault states and the revised ADR? Authorize the probes?
- Owner: which group of the thread panel holds the tools line; whether The Vault holds other secrets later.
- Whether the Codex permission profile can keep today's `workspace-write` behavior while denying the folder (needs its own test; may be refused).
- Whether a sandboxed command can read the Keychain key on macOS under each harness's profile.
- Whether the backup feature copies the data directory and so the Vault.
- How `mcp-icloud` behaves on the owner's Mac (speed, Messages, a headless host, permission prompts); whether Composio's session can be narrowed to read-only toolkits.
- The remote moved to `git@github.com:Dyrits/OUTLORE.git`; `origin` still names the old address, which works.

## Sources

- `documentation/capabilities/connectors/blueprint.md`, `specifications.md`, `draft.md`
- `documentation/architecture-decision-record/0022-the-vault-encrypts-secrets-and-hides-its-folder-from-sandboxes.md`
- `documentation/changelog/0.1.6-Prototype.md` (CHG-0321 to CHG-0330)
- `documentation/research/code-mode-autonomy-connectors-2026-11-16.md`, `documentation/verification/2026-11-14-token-isolation.md`, `documentation/security-audit/security-audit-2026-11-14-0233.md`
- `documentation/architecture.md`, `backlog.md`, `work-in-progress.md`, `conventions.md`
- `packages/service/src/work/mcp.ts`, `work/approvals.ts`, `work/threadTools.ts`, `core/endpoints.ts`, `policy/permissions.ts`, `policy/patterns.ts`, `harness/claudeArgs.ts`, `harness/codex.ts`, `harness/opencode.ts`, `harness/openCodeSandbox.ts`
- Superseded: `.agents/handoffs/2026-11-16-0835-connectors-specification.md`
