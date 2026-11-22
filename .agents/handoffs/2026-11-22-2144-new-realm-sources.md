# Handoff: New realm sources

Supersedes: none
Workspace: Outlore, `mission/outlore-next-batch-0b321042`, starting revision `7026ce8769b84ede53046aab2e51e6ce52da17b6`.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Offer the four requested sources and Empty realm when the owner visits a new realm from the sidebar.

## State

- Verified in the source diff. The sidebar opens the five choices. The existing quest form still opens the folder naming step directly.
- Verified through service requests. Local folder and Empty realm work through the existing creation path. Tests cover successful Git initialization and both clone formats, Git failure cleanup, duplicate-name acknowledgement, and paired device restrictions. The clone tests use local repositories.
- Desktop and paired-device interaction still await review.

## Decisions

- Repository creation uses the selected destination on the host and creates a child folder named for the realm. The Local folder choice can attach a folder that already exists.
- The app uses a dedicated request for repository creation so an earlier host cannot interpret it as an empty realm request.
- Git runs outside the storage transaction. Failed Git operations leave no new realm. Existing destination folders are preserved.

## Next

1. In the desktop app, open **Visit a new realm**. Try Empty realm, Local folder, New project, and both clone choices. Check the destination picker, form feedback, duplicate-name confirmation, and return to the chooser.
2. Repeat with a paired device to check narrow layouts and the browsable roots restriction.
3. Bring the branch into the target checkout when the owner requests it.

## Open questions

- The owner's review of the chooser in a running window is pending.

## Sources

- [Workspace attachment](../../documentation/capabilities/workspace-attachment/specifications.md#cloning-a-repository)
- [Verification](../../documentation/verification/2026-11-22-new-realm-sources.md)
- [Chooser](../../apps/app/src/realms/newRealmModal.tsx) and [repository setup](../../packages/service/src/work/realmRepositories.ts)
