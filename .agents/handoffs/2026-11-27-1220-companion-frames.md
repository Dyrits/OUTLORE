# Handoff: Companion answer frames, in-frame follow-ups, and usage-limit refusal by model group

Supersedes: none
Workspace: Outlore repository, branch `mission/companion-answer-grouped-under-its-messa-c2182b35` (base `2dfee528`, rebased from `743f7690`), landing on `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Show a tagged Companion's answer directly under the message it was tagged on, in a bordered frame with follow-ups, opt-in context sharing, and a side-chat jump list; stop a used-up limit of another model group from refusing a Companion.
Done when the four commits are on `origin/main` and the live desktop and phone checks pass.

## State

- **CHG-0786 (`e6a23bed`):** optional `isCompanionAnswer` on `Message`; answers grouped oldest-first under the tagged message in a frame; the "Replying to:" line dropped inside the frame; fallback to just after the tagged message's time when it is not drawn; search and Chronicle links resolve framed messages.
- **CHG-0787 (`1ce7cb67`):** migration `0083_companion_frames` (`frame_message_id`, `is_context_shared`); inline Follow up (Composer with `@` Companions) addressing the frame's Companions, capped at five; private by default with Add to context, In context, Update context (`ShareCompanionFrame`, never wakes the main Companion); conditional "N side chats" jump menu beside Find.
- **CHG-0788 (`237d990b`):** `isAntigravityLimitFor` makes a grouped Antigravity limit apply only to its model group; the latest reset is reported when several applicable limits are used up.
- **Review round (`d98f6db8`):** Standards STD-1..16 and Specifications SPEC-1..7 applied and re-verified by both reviewers with no regressions; `missionDetail.ts` split into `threadMessages.ts`, `companions.test.ts` into `companionFrames.test.ts` and `companionRefusals.test.ts`.
- **Verified (recorded):** a fresh errand reproduced the proof commands: 28 files, 179 tests, 7-workspace typecheck, Biome clean. The commit hook on `d98f6db8` passed: 326 test files, 2,641 passed, 22 skipped. The rebase onto `2dfee528` changed only that commit's own files; no checks were rerun after it.
- **Not verified:** the frame, Follow up box, context controls, and jump menu in a desktop window and on a phone (light and dark), and a live Antigravity turn.

## Decisions

- The owner's "maybe" on the frame was taken as yes; "Yes to all" settled the follow-up, opt-in context, and jump menu scope.
- Commit subjects were renumbered at merge (`CHG-0785` is Connectors OAuth on `main`).

## Next

1. Check the frame in a real desktop window and on a phone, in both themes.
2. Send a real `@` Gemini turn on an Antigravity account whose Claude and GPT weekly limit is used up.
3. `apps/app/src/conversation/entries.ts` sits at the 256-line soft limit: split it before growing it.

## Open questions

- None.

## Sources

- `documentation/changelog/0.2.12-Pre-Alpha.md` (CHG-0786, CHG-0787, CHG-0788)
- `documentation/capabilities/thread-messaging/specifications.md` and `blueprint.md`
- `documentation/verification/2026-11-27-companion-answer-frame.md`
- `documentation/verification/2026-11-27-companion-frame-follow-ups.md`
- `documentation/verification/2026-11-27-companion-usage-limit-by-model-group.md`
- `apps/app/src/conversation/exchangeFrame.tsx`, `companionAnswers.ts`, `sideChats.ts`
- `packages/service/src/work/companionAsking.ts`, `companionExchanges.ts`, `companionRefusals.ts`, `threadMessages.ts`
- `packages/service/src/harness/antigravityPlanLimits.ts`
