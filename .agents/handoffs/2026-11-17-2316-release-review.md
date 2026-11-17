# Handoff: review since 0.1.6-Prototype

Supersedes: none
Workspace: OUTLORE, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Resume the findings from the review of `0affd46..fd7f802`. Each follow-up is done when the associated specification is met and its acceptance checks pass.

## State

- Verified by two independent reviewers and local checks. The patch refactors the mobile pairing adapter, inverted conversation feed, and Code Mode service wiring. A regression test covers the QuickJS compilation error that used to leave the executor reading a disposed handle.
- Verified by the final local run. Biome, seven workspace typechecks, and Git whitespace checks passed. The test suite passed with 2,045 tests and 50 skipped. The [work in progress](../../documentation/work-in-progress.md#review-since-016-prototype--2026-11-17--uncommitted-refactors) records the test conditions and open findings.
- Verified from source. Code Mode still reads the switch on each request. An exception during asynchronous connector completion can still escape the executor before cleanup. The production gateway still offers no connectors.
- Device acceptance and the Android release-signing workflow run are pending. The [Android handoff](2026-11-17-2239-android-apk-merged.md) records the local debug APK launch and the remaining checks.

## Decisions

- The review applied supported refactors and corrected the documentation. Changes to capability behavior belong to a follow-up batch.
- Revisit assembling a single connector service when the real gateway arrives. Keep the release workflow refactor with a packaging check.

## Next

1. For Code Mode, test that listing and dispatch use the same mode throughout a turn and that the next turn sees a changed setting. Correct the call-limit description. Cover asynchronous connector completion failure and cleanup before enabling the real gateway.
2. Check conversation positioning during a streaming reply in the desktop window and on Android. Follow the device-pairing checks for system appearance and the refusal of a local relay on a phone.
3. Before a release tag, confirm the Android release key is configured and run the manual packaging workflow with the release-signing path exercised.

## Open questions

- May Chronicler and Rituals change Code Mode?
- Should manual packaging offer an explicit debug-signing option?
- Should a quest in Summons stay visible past the sidebar limit when a side-quest is still running?

## Sources

- [Work in progress](../../documentation/work-in-progress.md) and [release changelog](../../documentation/changelog/0.1.7-Prototype.md), CHG-0298 and CHG-0440 through CHG-0443.
- [Code Mode specification](../../documentation/capabilities/connectors/specifications.md#code-mode) and [verification](../../documentation/verification/2026-11-17-code-mode-core.md).
- [Conversation position](../../documentation/capabilities/thread-messaging/specifications.md#position-in-a-conversation) and [device pairing](../../documentation/capabilities/device-pairing/specifications.md).
