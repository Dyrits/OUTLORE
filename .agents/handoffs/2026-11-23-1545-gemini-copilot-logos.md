# Handoff: Gemini (Antigravity) name and provider logos

Supersedes: none
Workspace: OUTLORE, `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The Antigravity harness reads "Gemini (Antigravity)" everywhere the owner sees it, and Antigravity and GitHub Copilot show their own logos instead of placeholder glyphs.

## State

- Verified by diff: the label is changed in `apps/app/src/foundation/formatting.ts` and in `packages/service/src/harness/harnessCatalog.ts`, `acpProviderProfiles.ts` and `antigravityProvider.ts`.
- Verified by diff: `apps/app/src/ui/providerMarks.tsx` holds the Antigravity mark (LobeHub icons, MIT, blue `#3186ff`) and the Copilot mark (Simple Icons, CC0, theme text colour).
- Verified by test run: the full workspace typecheck passed with these changes, and `harnesses.test.ts` passes after its expected message became "Gemini (Antigravity) takes only the computer's own sign-in."
- Verified by test run: `loreHistory.test.ts` and `codex.test.ts` fail by timeout inside the sandbox and pass outside it (18 s and 22 tests); they do not touch this change.
- Assumed: the logos look right in the running app; nobody has looked at the Workshop Providers list since the change.
- Not done: the changelog has no entry for this change.

## Decisions

- Antigravity is a single-colour mark in Google blue; the multi-colour brand version does not fit the single filled path each mark uses.
- Cline and Devin keep their placeholder glyphs; the owner asked only about Gemini and Copilot.
- The pre-commit hook runs outside the sandbox for this repository: inside it, timing tests exceed their limits and block the commit.

## Next

1. Open the Workshop Providers list in the desktop app and check the Gemini (Antigravity) and GitHub Copilot rows and the conversation reply marks.
2. Add a changelog entry in `documentation/changelog/0.2.3-Pre-Alpha.md` if the owner wants this change recorded.
3. Replace the Cline and Devin placeholder glyphs with their own logos if asked.

## Open questions

None.

## Sources

- `apps/app/src/ui/providerMarks.tsx`
- `apps/app/src/foundation/formatting.ts`
- `packages/service/src/harness/harnessCatalog.ts`
- https://github.com/lobehub/lobe-icons (Antigravity mark)
- https://github.com/simple-icons/simple-icons (GitHub Copilot mark)
