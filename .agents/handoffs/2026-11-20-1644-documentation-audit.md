# Handoff: Outlore documentation audit

Supersedes: none
Workspace: Outlore, branch `worktree/re-document`, based on `b63a5c51`.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Keep the current guides accurate and resolve any differences between the implementation and agreed behavior with the owner.
The first pass covered the current guides and selected specifications.

## State

- Verified against source and the worktree diff. CHG-0601 records updates for Mistral Vibe, browser and Android pairing, Workshop navigation, own-copy worktrees, release packaging, and the README media recording revision.
- Verified during the audit. Biome, all seven workspace typechecks, `git diff --check`, and all added or updated local Markdown links passed.
  The recording patch passed `git apply --check` against an archive of `ae217e40`.
- Verified by reading the release workflow and requirements. The workflow requests GitHub-generated notes and has no step to put breaking changes from the changelog into them.
  GitHub access failed, so any manual edits to published notes remain unverified.
- The scan covered 518 project Markdown files and reported 33 unresolved link candidates after the guide changes.
  Dated records account for most candidates, and line-anchor links need manual confirmation.
  Live device checks and a claim-by-claim archive review remain open.

## Decisions

- Corrected statements about current behavior where the code was clear.
  The agreed release requirements remain in place while the release-note process is unresolved.
- Kept the recording kit tied to the original recording revision, where the original patch applies.

## Next

1. Ask the owner whether breaking changes are added to GitHub release notes manually and confirm against a published release when access is available.
2. Record the release-note gap if the owner confirms it.
3. If the audit continues, confirm the remaining link candidates and compare individual claims in the remaining specifications against current source.

## Open questions

- Do the published release notes get a manual breaking-changes section, or should the workflow gap be recorded for follow-up? The owner can confirm the current process.

## Sources

- [CHG-0601](../../documentation/changelog/0.1.13-Prototype.md#chg-0601--2026-11-20--refresh-the-current-outlore-guides)
- [Release requirements](../../documentation/requirements.md#releases) and [release workflow](../../.github/workflows/package.yml)
- [Recording guide](../../documentation/readme/recording/README.md) and [work in progress](../../documentation/work-in-progress.md)
