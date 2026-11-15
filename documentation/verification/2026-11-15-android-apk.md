# Android APK on every release tag

## Verdict

Wired and bundled, not built or run. CHG-0298 adds an `android` job to the release workflow and makes the Expo app usable as a remote-only native app. Nothing here ran Gradle or a phone: this computer has no JDK, and the sandbox has no emulator.

## Checked now (from `.worktrees/android-apk`, base `d0896ad`)

- `bun run check` and `bun run typecheck` (seven workspaces) pass; `CI=1 bun run test --maxWorkers=4` inside the sandbox: 1,607 passed, 54 skipped.
- `expo export --platform android` produces a Hermes bundle (6.3 MB) and `--platform web` still exports.
- `expo prebuild --platform android` generates the project; its `app/build.gradle` has `applicationId 'app.outlore.mobile'`, `versionName` from `package.json`, `versionCode` from `ANDROID_VERSION_CODE`, and a `release` signing config read from `ANDROID_KEYSTORE_*` with the debug key as the fallback.
- The workflow file parses as YAML.
- Tests: `apps/app/test/foundation/pairingStorage.test.ts` (storage over a mocked secure store), `packages/controller/test/browserDevice.test.ts` (phone and desktop kinds listed by a real host over a real relay).

## Not checked

- Gradle, the APK, installing it, launching it, pairing from it, or any screen on a phone or emulator: the app has never run natively. Likely gaps: layouts on a phone (CHG-0292 helps), the unreviewed `.web` splits (attachments, chip editor, comments, drag), fonts, and `react-native-svg` drawings.
- `expo-crypto`'s `getRandomValues` under Hermes with `@noble` (read, not run), and `expo-secure-store`'s synchronous calls on a device.
- The workflow on GitHub (new action versions `actions/setup-java@v5`, the SDK's `apksigner` path, Gradle's download), and the keystore secrets, which do not exist yet.
- The first run: use **Run workflow** on the branch (it builds a debug-signed APK) before tagging.
