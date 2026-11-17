# Android APK on every release tag

## Verdict

Wired and bundled, not built or run. CHG-0298 adds an `android` job to the release workflow and makes the Expo app usable as a remote-only native app. Nothing here ran Gradle or a phone: this computer has no JDK, and the sandbox has no emulator.

## Checked now (from `.worktrees/android-apk`, base `d0896ad`)

- `bun run check` and `bun run typecheck` (seven workspaces) pass; `CI=1 bun run test --maxWorkers=4` inside the sandbox: 1,607 passed, 54 skipped.
- `expo export --platform android` produces a Hermes bundle (6.3 MB) and `--platform web` still exports.
- `expo prebuild --platform android` generates the project; its `app/build.gradle` has `applicationId 'app.outlore.mobile'`, `versionName` from `package.json`, `versionCode` from `ANDROID_VERSION_CODE`, and a `release` signing config read from `ANDROID_KEYSTORE_*` with the debug key as the fallback.
- The workflow file parses as YAML.
- The branch tested the secure-storage adapter. The merged integration test in `packages/service/test/remote/browserDevice.test.ts` checks that a host lists a phone and a browser with their respective kinds over a real relay.

## Not checked

- Gradle, the APK, installing it, launching it, pairing from it, or any screen on a phone or emulator: the app has never run natively. Likely gaps: layouts on a phone (CHG-0292 helps), the unreviewed `.web` splits (attachments, chip editor, comments, drag), fonts, and `react-native-svg` drawings.
- `expo-crypto`'s `getRandomValues` under Hermes with `@noble` (read, not run), and `expo-secure-store`'s synchronous calls on a device.
- The workflow on GitHub (new action versions `actions/setup-java@v5`, the SDK's `apksigner` path, Gradle's download), and the keystore secrets, which do not exist yet.
- The first run: use **Run workflow** on the branch (it builds a debug-signed APK) before tagging.

## Follow-up on 2026-11-17 (CHG-0443)

The [Android handoff](../../.agents/handoffs/2026-11-17-2239-android-apk-merged.md) records the local build after the merge. `expo prebuild --platform android --no-install` generated the Android project. Gradle's `assembleRelease` built a 34 MB arm64-v8a APK with Temurin 17 and Android Build Tools 37.0.0, using the debug key. `adb install -r` installed it on the owner's phone. The launch logged `ReactNativeJS: Running "main"` and showed no crash or script error. The phone was locked, so pairing, camera use, links, and screens still need testing. The GitHub workflow and release signing also remain to be checked.
