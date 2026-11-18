# Handoff: Android pairing crash and hidden top bar

Supersedes: none
Workspace: OUTLORE, branch `main`, checked out in `.worktrees/status-bar`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The Android app opens Guild Hall after connecting to a paired host and keeps its top menu below the system status bar. The owner deferred the release. Resume when the owner is ready to choose, verify, and package a new release candidate.

## State

- Verified by Git. `bb7b433` (CHG-0445) fixes the Guild Hall crash and adds a regression test and a guard against `toSorted` in the phone bundle. `96219a8` (CHG-0448) adds the Android status-bar inset and icon styling. Both are on local `main`. The original status-bar snapshot is `171400c` on `worktree/status-bar`.
- Verified by this session's runs at `96219a8`. Workspace typecheck and Biome passed. `CI=1 bun run test apps/app` passed in all 73 app test files, with 513 tests passed and 8 skipped.
- Verified on the phone this session with `adb shell dumpsys package app.outlore.mobile` and `adb logcat -b crash -d -t 20`. The installed version is `0.1.8-Prototype`, and the crash buffer was empty. The prior phone check showed Guild Hall on the existing paired host and the top menu below the status bar. See CHG-0445 and CHG-0448 for the prior visual evidence and its limits.
- Verified by Git. `00d569c` adds the 0.1.7 Android warning and is in the history of `origin/main`. The side-quest reported that it also verified the edited GitHub release notes. Those notes link to 0.1.8, which had no tag locally or on `origin` at handoff time (`git tag --list` and `git ls-remote`).
- The earlier local packages were built before `main` reached the state recorded here. Package the revision chosen for the later release.

## Decisions

- The owner asked to commit and push this work and defer the release. The branch push runs the main checks. The release workflow uses a tag to publish.
- Use `main` for the next integration and choose the release scope with the owner. The earlier standalone hotfix snapshot predates other work on `main`.
- Package the chosen release revision locally before pushing its tag, per the owner's release rule.

## Next

1. Confirm the intended release revision and version. Review the changes since `0.1.7-Prototype` and draft notes from that range.
2. Build the candidate APK and verify the paired hub, top menu, status-bar icons in light and dark appearances, and the composer at the bottom edge. Try a fresh QR pairing and an `outlore://` pairing link with a matching host. Keep the current pairing available when setting up the check.
3. Package locally, check CI for the candidate revision, then seek approval for the release tag. After publication, verify the Android APK and the 0.1.7 warning's link.

## Open questions

- Which revision and version should ship? The owner decides when release work resumes.
- Are the status-bar icons legible in both appearances, and is the composer clear of the system navigation area? The phone checks are pending.
- Windows and Linux installers and the release-signed Android APK still need checks for the new candidate.

## Sources

- `documentation/changelog/0.1.8-Prototype.md` (CHG-0445 and CHG-0448), `documentation/changelog/0.1.7-Prototype.md`, and commits `bb7b433`, `00d569c`, `171400c`, and `96219a8`.
- `.agents/handoffs/2026-11-17-2239-android-apk-merged.md` (local Android build recipe), `documentation/verification/2026-11-15-android-apk.md`, and `.github/workflows/package.yml` (release and signing).
- [0.1.7-Prototype release](https://github.com/Dyrits/OUTLORE/releases/tag/0.1.7-Prototype).
