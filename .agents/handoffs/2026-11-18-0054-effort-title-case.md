# Handoff: Title case the effort levels in the app

Supersedes: none
Workspace: repository Outlore (ISKIOS checkout at /Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS), branch `effort-title-case`, cut from `main` at 00d569c

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner asked that the Effort level be shown in title case (Default, Low, Medium, High, XHigh, Max) instead of lowercase, wherever the app shows it. Done when the change is committed on `effort-title-case` and pushed, and the owner has looked at it in the app.

## State

Code is done and uncommitted at the time of writing; the commit is made from this handoff's session.

- `apps/app/src/foundation/formatting.ts`: new `effortName(effort)` title-cases a level (`default` to "Default", `xhigh` to "XHigh", others capitalise the first letter). `effortLabel` uses it; `runnerSummaryOf` shows `· High` style summaries through it.
- `apps/app/src/editors/companionBody.tsx` and `apps/app/src/editors/runners.tsx`: the Effort slider's `label` is `effortName`.
- `apps/app/src/editors/companionPicker.tsx`: the effort shown on the trigger uses `effortName`.
- `apps/app/test/foundation/effortName.test.ts`: new, 2 tests.

Verified in this session:
- `npx vitest run test/foundation/effortName.test.ts` in `apps/app`: 2 passed.
- `npx tsc --noEmit` in `apps/app`: no output (no errors).
- `npx biome check` on the four changed source files and the new test: clean.

Assumed, not run: the full app test suite; the look in a window or on the phone.

Not in this commit: the working tree also held uncommitted work from other threads, left as it was: `documentation/architecture-decision-record/0023-code-mode-runs-in-quickjs-inside-the-host.md`, `documentation/capabilities/connectors/specifications.md`, `documentation/changelog/0.1.8-Prototype.md`, `documentation/work-in-progress.md`, `documentation/capabilities/voice-input/`, `documentation/research/voice-input-2026-11-18.md`. Their owner should commit them separately.

The push is not done: pushing needs the owner's approval through the approval tool.

## Decisions

- Branch, not `main`: the change went onto `effort-title-case` because the repository's rules say to branch off the default branch first.
- "XHigh" rather than "Xhigh" for the one two-word level. This is a judgement call; the owner may prefer "Xhigh".
- Title-casing is applied in every place the app shows an effort (slider, trigger, summaries), not only on the slider, so the owner sees one spelling everywhere. The Default case reads "Default" on the slider and "Default effort" in the thread panel, as before.
- The provider-facing values (`low`, `xhigh`, ...) are unchanged; only the display changed. Nothing in `packages/` changed.

## Next

1. Get the owner's approval to push `effort-title-case` to origin, then push it (the branch, not `main`).
2. The owner looks at the effort labels in the app (Companion slider, preset and backup summaries, the thread panel) and says whether "XHigh" is right.
3. Open or merge the branch into `main` as the owner directs; that is outside this handoff.
4. Decide whether this needs an entry in `documentation/changelog/0.1.8-Prototype.md`. It was not added here because that file has someone else's uncommitted edits.

## Open questions

- Is "XHigh" the owner's preferred spelling, or "Xhigh"? Answer: the owner, by looking at the app.
- Should the change get a changelog entry in 0.1.8-Prototype? Answer: the owner; the file is currently being edited elsewhere.
- Full app test suite result: not run here; run it with `bun run test` in the workspace or leave it to CI.

## Sources

- Commit on branch `effort-title-case` (once made; see `git log main..effort-title-case`), based on `main` at 00d569c.
- `apps/app/src/foundation/formatting.ts` (`effortName`, `effortLabel`, `runnerSummaryOf`)
- `apps/app/src/editors/companionBody.tsx`, `apps/app/src/editors/runners.tsx`, `apps/app/src/editors/companionPicker.tsx`
- `apps/app/test/foundation/effortName.test.ts`
- Effort levels come from `packages/service/src/harness/harnessCatalog.ts` (`claudeEfforts`) and `packages/contracts/src/harnesses.ts`.
