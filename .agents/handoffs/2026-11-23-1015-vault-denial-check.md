# Handoff: Vault read-denial check without owner steps

Supersedes: none
Workspace: /Users/dgerrits/Codelab/Dyrits/OUTLORE, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The Vault card in Settings must show a verified read denial for Claude Code, Codex and OpenCode at start, with no step from the owner and no model turn. Done means the card reads "protected" on a normal owner machine, and a sandboxed service says plainly why nothing was tried.

## State

- Merged into local `main` (merge commits `3601a392` and `33f2718c`, verified with `git log`): the implementation branch `mission/vault-sandbox-check-without-owner-steps-910f3d35` (CHG-0657, commit `3ee918e4`) and the research branch `mission/vault-sandbox-check-without-owner-steps-8367aa46` (commits `1965fb66`, `ac9bc2ad`). Both merged without conflict (verified, merge output).
- Cause of the Codex message "The marker could not be read outside the sandbox": all harness probes wrote the same `probe-marker` file in the Vault folder and overwrote or deleted each other's. Each probe now writes `probe-marker-<random>`. Reported by the implementation errand, which reproduced it with two concurrent Codex probes; I did not rerun it.
- Claude Code is probed at start through `@anthropic-ai/sandbox-runtime` 0.0.83 (Apache-2.0, new pinned dependency, used in-process) with the adapter's own filesystem settings. The Verify button is removed; `VerifyClaudeVaultDenial` stays as an optional request no screen offers. Reported by the errand, not rerun by me.
- A service that is itself sandboxed cannot start a second sandbox (`sandbox_apply: Operation not permitted`) and says so in plain words; it stays Unverified. ADR 0022's rule (no secret stored without verified denial) is unchanged.
- The errand reported `bun run check`, the workspace typecheck and the full suite green on its branch (2893 passed, 0 failed). I did not rerun them on merged `main`.
- The main checkout still holds uncommitted changes from another task (provider install: `apps/app/src/settings/providers.tsx`, `packages/service/src/harness/harnessInstallation.ts`, `documentation/changelog/0.2.3-Pre-Alpha.md` and others). They are not part of this work and were left untouched (verified with `git status`).
- Not pushed at the time of writing; see Next.

## Decisions

- Use the sandbox library in-process instead of the `srt` command or a vendored file: the packaged service runs in Electron's utility process with no Node to run a command; the library is pure JS (+1.2 MB bundle). Its licence is in `packages/service/vendor/sandbox-runtime.LICENSE` and the vendor README.
- The live-turn stamp stays an optional stronger proof; it never lifts the rule by itself.
- The ADR 0022 amendment of 2026-11-23 is written but awaits the owner's confirmation.
- Other products in the inspirations file avoid the question by where the secret lives; no design change was taken from them (`documentation/research/sandbox-handling-2026-11-23.md`).

## Next

1. Ask the owner to confirm the ADR 0022 amendment of 2026-11-23.
2. Run `bun run check` and the typecheck (about 4 minutes, background) on merged `main`; the library was added to `node_modules` by hand in the errand's copy, so run `bun install` first.
3. Start the desktop app from a terminal (not from a thread) and read the Vault card: all three harnesses should read as protected.
4. Optionally add: a retry from a clean child process when the service is sandboxed, a result cache keyed by versions, and `codex sandbox macos` as a model-free Codex probe (research recommendation, not verified).

## Open questions

- Does the bundle work inside Electron's utility process in a packaged app, on Linux (needs bubblewrap and socat) and on Windows? Not tested; the owner or a packaged build can answer.
- Does the probe prove the denial of the installed Claude Code binary, not only the library's? Only the optional live turn can; it spends the owner's account and was not run.

## Sources

- `documentation/verification/2026-11-23-vault-denial-automatic.md` (real command output)
- `documentation/research/sandbox-handling-2026-11-23.md`
- `documentation/architecture-decision-record/` (0022 amendment), `documentation/capabilities/connectors/specifications.md`, `documentation/changelog/0.2.2-Pre-Alpha.md` (CHG-0657)
- `packages/service/src/harness/claudeSandboxProbe.ts`, `vaultDenial.ts`, `vaultDenials.ts`; `apps/app/src/settings/vaultCard.tsx`
- Commits `3601a392`, `33f2718c`, `3ee918e4`, `1965fb66`, `ac9bc2ad`
