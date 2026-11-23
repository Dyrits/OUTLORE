# Handoff: Providers installed only

Supersedes: none
Workspace: OUTLORE, `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The Workshop's Providers section shows only installed harnesses, and offers the missing ones behind an "Install another provider" button.

## State

- Done, assumed visually correct: `ProvidersSection` in `apps/app/src/settings/providers.tsx` renders `HarnessCard` for each harness whose `problem` is null, and a toggle button that unfolds a `MissingRow` (logo, name, Install, failure text) for each other harness.
- Verified: `tsc --noEmit` in `apps/app` exited 0 after the change.
- Not run: the app's tests and a look at the running Workshop.
- Committed in the same batch, by other work, and not reviewed here: the Gemini (Antigravity) label, the Antigravity and Copilot logos, full-width choice options in `questions.tsx`, and the clone-based `.agents/worktree-setup.sh`.

## Decisions

- Every harness with an Install action is offered, with no narrower list (owner, 2026-11-23: "All of them").
- A harness counts as installed when its `problem` is null.

## Next

1. Open the Workshop's Providers section in the desktop app and check the card list, the unfolded list, and an install from it.
2. Run the app and service tests, since the Gemini label changed and some tests may still expect "Gemini".

## Open questions

Whether the "Gemini (Antigravity)" label is final: the owner's screenshot showed "Gemini".

## Sources

- `apps/app/src/settings/providers.tsx`
- `documentation/capabilities/provider-accounts/specifications.md`
- `documentation/changelog/0.2.3-Pre-Alpha.md` (CHG-0667)
