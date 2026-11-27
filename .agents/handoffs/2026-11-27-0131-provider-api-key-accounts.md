# Handoff: Provider API key accounts (CHG-0775)

Supersedes: none
Workspace: OUTLORE repository, branch `main` (origin `git@github.com:Dyrits/OUTLORE.git`); committed on `main` (not pushed) once this file is in the log

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Let the owner connect Claude Code to Z.ai, Kimi, DeepSeek, MiniMax, Qwen (Alibaba) and OpenRouter, and to Anthropic's own API, with an API key instead of a sign-in, and let other harnesses gain key options later. Done means: a real key works end to end in the window (add, turn, replace, remove), the Specifications findings below are fixed test-first, and CHG-0775 is committed and pushed to `origin/main` with the owner's approval.

## State

Built and committed on `main` as one CHG-0775 commit on top of `0f05b3aa` (CHG-0776, committed meanwhile), not yet pushed. The working tree still holds unrelated CHG-0777 edits and `documentation/architecture-audit/architecture-audit-2026-11-27-0124.html`, which this commit left out.

- Verified (read in this session): `keyAccounts.test.ts` exists with 10 tests; the files `packages/service/src/work/keyAccounts.ts`, `packages/service/src/work/accountKeys.ts`, `packages/service/src/harness/accountKeys.ts`, `apps/app/src/settings/keyAccountForm.tsx`, `documentation/architecture-decision-record/0029-api-key-accounts-keep-the-key-in-the-vault-and-hand-it-to-one-harness.md` and `documentation/research/provider-api-keys-2026-11-27.md` are untracked (`??` in `git status`).
- Verified by the review threads' runs (recorded in the changelog, not rerun in this session): Biome clean on the touched files, typecheck clean on 7 workspaces, `CI=1 bun run test` on `keyAccounts.test.ts`, `accounts.test.ts` and `providerRules.test.ts`: 3 files, 22 passed.
- Standards review (STD-01 to STD-13): all applied and verified resolved by the reviewer, no regressions (assumed from the reviewer's report, not rerun here).
- Specifications review: SPEC-01 to SPEC-07 are open. Verified by the reviewer's read of the code; not yet fixed.
- Assumed: Claude Code 2.1.330 probe against a local stub, recorded in CHG-0775.
- Not checked: a real vendor endpoint or key; the Providers form in the window; billing in a turn (no test); that `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` keeps the key out of Bash commands; the Kimi endpoint, which came from a secondary source.

Commit scope was settled with the owner ("Go" to the recommended option): CHG-0775 only, with the shared files `glossary.md`, `work-in-progress.md` and the changelog staged by hunk. The shell in this session exports a `GIT_CONFIG_COUNT=5` with no `GIT_CONFIG_VALUE_0`, so every git command fails until `unset GIT_CONFIG_COUNT` (or `env -u`) is used.

Open findings from the review (fix test-first):
- SPEC-01: plan-limit probe still runs for API key accounts (`accountBudgets.ts`, `planLimits.ts`, `claudePlanLimits.ts`) before any turn, and when the Vault is locked.
- SPEC-02: a turn on an API key account with an unreadable key launches Claude Code unsigned instead of failing (`turnRunner.ts:134-136`, `accountKeys.ts` `prepareAccountKey`).
- SPEC-03: `ReplaceAccountKey` does not restart a pooled Claude process (`claude.ts` `restartKeyOf`).
- SPEC-04: `readHarness` in `accounts.ts` reports `SignedIn` and models for key accounts on an uninstalled harness or an unreadable key.
- SPEC-05: the Companion picker trigger reads harness-level models, not the account's (`companionPicker.tsx:139-142`).
- SPEC-06: `ReplaceKey` submits on Enter when empty or busy, and both forms accept whitespace-only keys.
- SPEC-07: automated coverage gaps: turn billing kind `ApiKey`, Vault `NotProtected` refusal, locked-Vault `SignedOut`, secret deletion on remove, replace env update, restart reload, `openrouter` env mapping. Item 8 (`keyProvidersOf` gating) is covered in `providerRules.test.ts`.

## Decisions

- Keys are sealed in the Vault and handed to one harness as an environment only, the way T3 Code, Paseo and OpenBot do it. Reason and record: [ADR 0029](../documentation/architecture-decision-record/0029-api-key-accounts-keep-the-key-in-the-vault-and-hand-it-to-one-harness.md).
- The owner agreed to loosen the standing rule against storing provider credentials, for API keys only. Recorded in ADR 0029, [requirements](../documentation/requirements.md) (Comply with provider terms, amended), the provider-accounts spec, the glossary and CHG-0775.
- Key accounts never run the plan-limit probe (it is a real turn that would bill the key); their turns are billed as `ApiKey`. Recorded in ADR 0029 and the provider-accounts spec (SPEC-01 shows the code does not yet honour this at startup).
- Only Claude Code has the API key option in this batch. Other harnesses wait until each can keep a key out of its own commands.
- Standards refactors were applied as behaviour-preserving changes (see CHG-0775's review notes in `work-in-progress.md`).

## Next

1. Push the CHG-0775 commit to `origin/main` once the owner approves.
2. Write red tests for SPEC-01 to SPEC-07, then fix them; run `bun run typecheck`, `bunx biome check`, and `CI=1 bun run test` on the touched packages (run with `env -u GIT_CONFIG_COUNT`).
3. The pre-push hook refuses protected-branch pushes without `--no-verify`, which needs the owner's approval.
4. Owner checks in the window with a real key: add, turn, replace, remove, and the Companion picker labels.

## Open questions

- Push approval for `origin/main`, and whether to bypass the pre-push hook. Owner.
- `WebSearch` on third-party endpoints: disable it, as Paseo does? Owner.
- Kimi endpoint `https://api.moonshot.ai/anthropic` and the model names: confirm against a real key. Owner.

## Sources

- Changelog: `documentation/changelog/0.2.10-Pre-Alpha.md`, CHG-0775 (line 259).
- Decision: `documentation/architecture-decision-record/0029-api-key-accounts-keep-the-key-in-the-vault-and-hand-it-to-one-harness.md`.
- Spec: `documentation/capabilities/provider-accounts/specifications.md`.
- Research: `documentation/research/provider-api-keys-2026-11-27.md`.
- Open findings: `documentation/work-in-progress.md`, API key accounts section.
- Code: `packages/service/src/work/keyAccounts.ts`, `packages/service/src/work/accountKeys.ts`, `packages/service/src/harness/accountKeys.ts`, `packages/service/src/harness/claude.ts`, `apps/app/src/settings/keyAccountForm.tsx`, `apps/app/src/settings/providerRules.ts`.
- Tests: `packages/service/test/work/keyAccounts.test.ts`, `apps/app/test/settings/providerRules.test.ts`.
