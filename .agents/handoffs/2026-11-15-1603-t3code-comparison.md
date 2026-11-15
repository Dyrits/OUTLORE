# Handoff: T3Code comparison and documentation accuracy

Supersedes: none
Workspace: ISKIOS repository (the Outlore app), branch `main`, started from `1d664b370ae350aabbcd34aec6209a89b43e6a2c`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Compare Outlore with T3Code (`pingdotgg/t3code`) to see how much of what Outlore plans already exists there, and make Outlore's documentation and in-app help say accurately what is built and what is only agreed. Done means the comparison and upstream notes exist, the overview documents separate built behavior from plans, and the owner has decided what the comparison implies for the independent host and browser batch.

## State

- Written and checked in the working tree (verified now: `bun run check`, `bun run typecheck`, `git diff --check`, and `CI=1 bun run test packages/service/test/work` with 39 files and 444 tests passing, all run before the last small note edits; `bun run check` and `git diff --check` were rerun after them): `documentation/research/t3code.md`, `documentation/research/outlore-t3code-comparison.md`, implementation-status sections in the thread-tree, thread-handover, tool-and-skill-loading, thread-panel and workspace-attachment specifications, notes in the outline, glossary, architecture and inspirations, README and `apps/app/AGENTS.md` corrections, a changelog entry CHG-0288 in `documentation/changelog/0.1.4-Prototype.md`, and an updated work-in-progress entry.
- Chronicler's guide (`packages/service/src/work/appGuideTopics.ts`) no longer claims own copy or a merge button, no automatic update, an unbuilt host folder picker, or one-computer-only use. Verified: the new tests in `packages/service/test/work/appGuide.test.ts` failed on four claims before the text change and passed after.
- The T3Code findings come from its README, user documentation, internals notes and source file names; nothing was installed or run. Not read: its worktree and merge logic, the staged service update flow, scheduled-task retry rules, and budgets. The first pass used pinned commit `0de6ddb8235debee8c7119343e1a4da9cd8b5de8`; the memory and no-project check used the newer HEAD `3e7f5ecc55c532ce60e6b1c48f210e17f3c8c9d1`, which the note says.
- Findings the owner asked about, assumed correct pending a real read: T3Code has threads without a project (per-thread scratch folder, promotable to a project) but no per-project or per-thread memory was found.
- Not verified: the full test suite and the Electron window were not run. Nothing was committed or pushed when this file was written; the commit and push follow in this session, so check `git log` and `git status`.
- CHG-0288 and the work-in-progress entry say the review and commit are pending; they predate the owner asking to commit and push.

## Decisions

- Documentation was corrected to distinguish built from planned without reducing any requirement or removing planned behavior; dated records and older handoffs keep their original claims. Recorded in CHG-0288.
- Only the stale help text in `appGuideTopics.ts` was changed in code, because Chronicler reads it as documentation. No planned capability was implemented.
- The comparison does not authorize a fork, migration, release or push of upstream code; it recommends evaluating "extend T3Code" and "borrow parts" before building the host and browser batch. Recorded in the comparison note.
- T3 Connect is not a substitute for Outlore's relay as inspected: it needs an account and a hosted control plane and the tunnel path was not found to be end-to-end encrypted; this follows the requirements in `documentation/requirements.md`.

## Next

1. Confirm with the owner whether to evaluate T3Code (extend, borrow, or keep building) before the independent host and browser batch, and record the answer in the backlog, work-in-progress and a changelog entry.
2. If yes, read the unread T3Code parts that the choice depends on (host lifecycle and update flow, worktree logic, scheduled-task rules, budgets, multiple accounts per harness) at one pinned commit, and add them to `documentation/research/t3code.md`.
3. Compare T3Code's local, Tailscale and SSH routes against Outlore's access requirements; only its managed route was compared.
4. Check the pending claim that the owner confirmed the commit: update the CHG-0288 and work-in-progress "pending" wording once the commit and push are verified.

## Open questions

- Extend or fork T3Code, borrow selected parts, or keep building the overlapping features: the owner decides.
- Whether per-project and per-thread memory is really absent in T3Code's server: answered only by reading its code, not just its documentation.
- Whether T3Code's self-hosted routes meet the no-additional-VPN requirement.

## Sources

- `documentation/research/outlore-t3code-comparison.md`, `documentation/research/t3code.md`
- `documentation/changelog/0.1.4-Prototype.md` (CHG-0288), `documentation/work-in-progress.md`, `documentation/inspirations.md`
- `documentation/requirements.md`, `documentation/architecture.md`, `documentation/architecture-decision-record/0018-host-service-runs-on-its-own.md`, `0019-browsers-use-the-relay-served-web-app.md`
- `.agents/handoffs/2026-11-14-1953-host-browser-architecture.md` (the host and browser batch this affects)
- https://github.com/pingdotgg/t3code (commits `0de6ddb8235debee8c7119343e1a4da9cd8b5de8`, `3e7f5ecc55c532ce60e6b1c48f210e17f3c8c9d1`), MIT licensed
