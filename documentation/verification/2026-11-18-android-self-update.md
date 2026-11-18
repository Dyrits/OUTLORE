# Android self-update verification

The task checkout is `.worktrees/android-update` on `worktree/android-update`. It resumed at specification commit `81e7472`, whose parent and worktree base is `ffb370e765f8080e7f71f10f794092e88131cd1a`. The return branch is `main`.

- `CI=1 bun run test` passed with 2,097 tests and 52 skipped. The updater tests exercise release selection, the channel rule, the switch, the request headers, metered downloads, checksum rejection, permission gating, and signature mismatch reporting through a fake native installer. Host link tests exercise the version-mismatch event.
- `bun run check`, `bun run typecheck`, and Expo's web export passed.
- `bunx expo prebuild --platform android --no-install` and `./gradlew :outlore-installer:compileDebugKotlin --no-daemon` passed with Java 17. Gradle found the local Expo module through autolinking.

The device check needs two successive APKs signed with the same release key. Start with the older APK paired to a host. Verify the update notice and host mismatch action, decline the installation allowance and open the release page, then grant the allowance and install the update through Android. Reopen Outlore and verify that the pairing still works with a matching host release.
