# Verification: pairing links and a QR scanner in the phone app (CHG-0436, CHG-0437)

Branch `worktree/pairing-link-mobile`, made from `worktree/pairing-link` (`872d906`, itself on `main` at `4e940fa`). Run inside Claude Code's sandbox (`CI=1`), XDG_DATA_HOME and pty conditions as for the whole suite.

## Results run on this branch

- `bun run check`: 863 files, no fixes.
- `bun run typecheck`: seven workspaces pass.
- `CI=1 bun run test`: 247 files passed, 4 skipped; 2,007 tests passed, 54 skipped (`worktree/pairing-link` had 244 and 1,982).
- New and changed tests (red first, then green): `pairingLinkArrivals.test.ts` (9), `qrScan.test.ts` (6), `cameraAccess.test.ts` (5), `pairingOffer.test.ts` (10, five new).
- `expo prebuild --platform all --no-install` with a temporary `android.package` and `ios.bundleIdentifier` (they live on `worktree/android-apk`, not here; `app.json` was restored and `ios/` and `android/` deleted): the Android manifest has `android.permission.CAMERA`, no `RECORD_AUDIO`, and an intent filter (VIEW, DEFAULT, BROWSABLE, scheme `outlore`) on the `singleTask` main activity; the iOS `Info.plist` has `CFBundleURLSchemes` with `outlore` and `NSCameraUsageDescription` with Outlore's text, and no `NSMicrophoneUsageDescription`.
- `expo export --platform web`: builds; the bundle has no "Point the camera at the QR code" text and no camera module (the one `expo-camera` match is the `package.json` the app imports for its version).
- `expo export --platform android`: builds a 6.4 MB Hermes bundle that holds the scanner text and `ExpoCamera`, so Metro picks `qrScanner.native.tsx` there.

## Compatibility with `worktree/android-apk` (CHG-0298), read, not merged

That branch is based on an older `main` (0.1.5) and was only read. It builds with `expo prebuild --platform android --no-install` and Gradle in `package.yml`, adds `app.config.ts` (version, `versionCode`; it spreads `config`, so `scheme` and `plugins` pass through), the plugin `./plugins/withReleaseSigning` (it edits `android/app/build.gradle` by pattern: `signingConfigs { debug {…} }` and the release build type's `signingConfig signingConfigs.debug`), `android.package`, and `plugins: ["expo-font", "expo-secure-store", "./plugins/withReleaseSigning"]`.

- `expo-camera`'s plugin (`withCamera.js`) changes only the manifest permissions, `Info.plist` and `gradle.properties`, never `app/build.gradle`; the prebuilt `build.gradle` here has the shape the signing plugin matches. So the two plugins do not interact.
- Merging the two touches the same lines: `plugins` in `app.json` (keep all four entries, `expo-camera` with its options), `App.tsx` (that branch changes `deviceNoun` to `remoteDeviceNoun` in both dialogs; here it comes from `useHostConnection`), `useHostConnection.ts` (it adds `pairingStorage()` and `remoteDeviceNoun`), `addHostModal.tsx` (it widens `deviceNoun` with `"phone"`, as here) and `package.json`/`bun.lock`. A bare merge conflicts there and each conflict is small. After the merge `isPhone` here (`Platform.OS !== "web"`) can use `isNativeApp` from `page.ts`.
- Without that branch the phone app does not pair at all (`window.localStorage` and Hermes' missing `crypto`), so this work needs it first.
- `expo-camera` needs a native build (a development build or the APK), not Expo Go's bundled set for a custom scheme, and the scheme in Expo Go is `exp://`: a test of `outlore://` needs the built app.

## Not checked

- No phone or emulator: nothing was installed or opened. Not seen: `outlore://pair#<code>` starting the app and reaching Add a host, a link arriving while the app runs, the duplicate guard against the system's real double report, the notice and the Pair button on a phone, the dialog with no host paired (required) and with the host unreachable (the new dialog over the waiting screen).
- Not seen: the camera preview, a scan of the host's QR code with a real camera, the system's permission question, the refusal paths (denied once, never ask again, **Open Settings**), the wording of the iOS text in the system dialog, the scanner inside the modal on iOS and Android (one modal, no second one), the layout at phone sizes, the frame and the bottom bar over the preview.
- The https web link opens the browser on a phone, as designed; App Links and universal links are in the backlog with their cost and were not tried.
- Whether `Linking.getInitialURL` and the `url` event both fire for a cold start on iOS and Android, as the five-second guard assumes, was taken from the platform documentation, not seen. If only one fires the guard does nothing.
- No release, store build, EAS build or Gradle run: no JDK here.
