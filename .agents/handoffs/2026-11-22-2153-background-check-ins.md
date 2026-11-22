# Handoff: Daily background check-ins

Supersedes: `2026-11-22-1100-background-check-ins.md`
Workspace: Outlore, `worktree/background-check-ins`, at `0cbceb12` (CHG-0640).

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Finish opt-in daily check-ins that review selected realms and post linked quest updates in their Missives when there is something to report.

## State

- Verified by commit and tests. The settings slice (`7026ce87`) and the day-admission slice (`0cbceb12`, CHG-0640) are committed on `worktree/background-check-ins`. The admission operation claims the local calendar day in one transaction before any review runs, reusing the Ritual local-time calculation. Both commits are intended to be pushed to `origin/main` with this handoff's commit; on resume, confirm `git merge-base --is-ancestor worktree/background-check-ins origin/main` before building on them.
- Verified by `bun run check`, `bun run typecheck`, and `CI=1 bun run test` on the admission slice: 2,715 tests passed, 64 skipped, one connector memory-limit test passed on retry. The pre-commit hook re-ran all workspace typechecks and the related tests at the commit.
- Verified by offline probes, recorded in the research note: the strongest Companion candidate is OpenCode v2's stateless `POST /api/experimental/generate/text` on a private loopback server against an owner-installed local model (LM Studio). No live inference, model download, or quest data left this machine. The loopback mock proof is open: nested Seatbelt blocked the isolated process boundary in this sandbox, so it needs the owner's terminal or another process boundary.
- The host scheduler wiring, Workshop controls, and linked check-in Missives are not built. Nothing calls `runDueBackgroundCheckIn` in production yet; production inference stays unwired until the isolation proof passes.

## Decisions

- One admission attempt per local calendar day, stored transactionally under the `backgroundCheckInAttemptDay` settings key; a failed or interrupted attempt consumes the day, so the host never repeats unattended inference on later sweeps. Recorded in CHG-0640.
- Production inference stays unwired until the chosen Companion is proven to run with tools disabled, create no sessions, and reach only loopback (or another accepted boundary). Fail closed. Recorded in the research note.
- Check-ins need inference with tools disabled; the Ritual runner itself is not reused, only its local-time calculation.
- Settings are initially unset and only the owner changes them (CHG-0633).

## Next

1. Run the loopback mock proof for the OpenCode v2 stateless endpoint from the research note's "Evidence and release decision" section (mock OpenAI-compatible decoder on loopback, no tools in the provider request, no session created, fail closed on an unavailable model). The owner's terminal can provide the process boundary the sandbox cannot.
2. Wire the hourly sweep to `runDueBackgroundCheckIn` with a stand-in Companion; publish reportable changes as linked realm Missives the way `inactivityMissives.ts` does, with no duplicate for unchanged input.
3. Build the Workshop controls, surface Companion availability and quota failures, and review them with the quest links on desktop and a paired device.

## Open questions

- The owner has yet to choose between one verified Companion in the first build and support across all Companions.
- No provider is selected for built-in free inference; OpenCode's hosted free models are temporary and not cleared.
- If the OpenCode path cannot be isolated: restrict a Claude CLI release to verifiably isolated owner-configured Console environments, or approve a dedicated inference path with a revised credential boundary.

## Sources

- [Check-in specification](../../documentation/capabilities/background-check-ins/specifications.md) and [provider questions](../../documentation/capabilities/background-check-ins/draft.md)
- [Companion research](../../documentation/research/background-check-in-companion-2026-11-22.md)
- [Admission operation](../../packages/service/src/work/backgroundCheckInSchedule.ts) and [its controlled-clock test](../../packages/service/test/work/backgroundCheckInSchedule.test.ts)
- [Changelog entries CHG-0633 and CHG-0640](../../documentation/changelog/0.2.2-Pre-Alpha.md)
- [Inactivity Missives as the publication pattern](../../packages/service/src/work/inactivityMissives.ts)
