# Handoff: Provider installation and Gemini sign-in

Supersedes: none
Workspace: Outlore, main

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Make Workshop Install run official installers for the new providers and make Gemini Sign in open the provider’s login.

## State

- Verified in the source: automatic install requests run the provider’s installer, and the Workshop shows failures on the affected card.
- Verified on the original Gemini branch at `9a51c065`: 12 focused tests and workspace typecheck passed, and the full suite reported 2,844 passed and 64 skipped.
- Verified by Git: the manual-guide experiment and choice-layout edits are preserved in the stash named `Before landing provider automation: preserve guide experiment and local edits`.
- Real vendor installation and completion of Google sign-in remain unverified.

## Decisions

- Cline, GitHub Copilot, and Pi use npm.
- Gemini, Cursor, Devin, Hermes, and Muse use their official HTTPS scripts on macOS and Linux.
- Gemini sign-in uses ACP login with the same state directory arguments as Gemini turns.

## Next

1. In an updated Outlore build, press Install for a missing provider and confirm the card shows the installed version.
2. Press Sign in on the Gemini card in macOS, complete Google sign-in, and verify model discovery.
3. Verify native Windows installation for providers whose current scripts target macOS and Linux.

## Open questions

Which native Windows installer routes allow the running host to find the executable immediately?

## Sources

- [Provider accounts specification](../../documentation/capabilities/provider-accounts/specifications.md)
- [Release changelog](../../documentation/changelog/0.2.3-Pre-Alpha.md)
- `packages/service/src/harness/harnessInstallation.ts`
- `packages/service/src/harness/harnessTools.ts`
- `apps/app/src/settings/providers.tsx`
- Gemini sign-in commit `9a51c065`
