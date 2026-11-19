# Handoff: Codex turns failing on the Vault's permission profile

Supersedes: none (forked from `2026-11-19-2008-connectors-on-main.md`)
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Every Codex turn in Outlore failed with "failed to load workspace requirements: invalid input parameter". Done is a Codex turn that answers with the Vault's folder still hidden, and the owner having seen it in the Outlore window.

## State

- Cause, verified by a direct `codex app-server` session (Codex 0.170.0): the Vault's profile (`permissions.outlore.*`, ADR 0022) was sent in `thread/start`'s `config`; a later turn reloads settings without that thread's overrides, finds no profile named `outlore`, and fails after five retries. `workspace-write` and the built-in `:workspace` profile pass.
- Fix, committed on `main` (CHG-0559): `packages/service/src/harness/codex.ts` now starts `codex app-server -c default_permissions="outlore" -c permissions.outlore.…` (arguments from `vaultProfileArgsOf`); `thread/start` only names the profile. A profile in the process settings needs `default_permissions`, or Codex refuses to start.
- Verified: with the exact arguments the code generates, a live turn answers "ok" and a read of a file in the hidden folder is refused ("Access denied by the active filesystem policy"); `packages/service/test/vault/adapterDenial.test.ts` passes (10 tests); `bun run typecheck` passes on all workspaces.
- Not verified: a turn from the Outlore window (the running app still has the old code until restarted); the full suite. The stand-in Codex in the tests does not reload settings between turns, so no test fails on the old behavior; only a live Codex shows it.
- Diagnostic scripts and their temporary folders were deleted; no debug tags remain.

## Decisions

- The profile is defined on the process, not per thread: a per-thread definition does not survive a turn. Recorded in CHG-0559 and in lore for this realm.

## Next

1. Ask the owner to restart Outlore, open a Codex errand and send a message (or press Retry on the failed turn).
2. If a turn still fails, run a direct `codex app-server` session with the same arguments and read the error before changing code.
3. Consider a live-Codex check (skipped when Codex is absent) that runs two turns on the Vault profile, so the stand-in's blind spot is covered.

## Open questions

- Does the owner want the live-Codex check from Next 3, given it needs a signed-in Codex and spends a little quota?

## Sources

- `documentation/changelog/0.1.13-Prototype.md`, CHG-0559
- `packages/service/src/harness/codex.ts`, `packages/service/src/harness/codexVaultProfile.ts`
- `packages/service/test/vault/adapterDenial.test.ts`
- `documentation/architecture-decision-record/0022-the-vault-encrypts-secrets-and-hides-its-folder-from-sandboxes.md`
- `documentation/verification/2026-11-19-vault-read-denial.md` (the earlier check, which ran no live turn)
