# Handoff: Android APK merged into main, installed on a phone

Supersedes: `2026-11-17-1418-pairing-link-mobile.md`
Workspace: OUTLORE, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The Android APK (CHG-0298), which missed 0.1.6-Prototype because `worktree/android-apk` was never merged, ships in the next release, and the phone app pairs with a host. Done means a tag publishes `Outlore-<version>-android.apk` signed with the owner's release key, and the owner pairs a phone and uses quests.

## State

- Verified (git log): `worktree/android-apk` is merged into `main` (`00605c9`, then `4b419d8` with main's CHG-0440 to CHG-0442) and `main` was fast-forwarded to it. Entries CHG-0298 and CHG-0443 are in `documentation/changelog/0.1.7-Prototype.md`; CHG-0443 lists how the conflicts were resolved (`ControllerKind` gains `"phone"`, `PageSettings.kind`, `pairingStorage()` with `isNativeApp`).
- Verified (runs): Biome, the seven typechecks, the full suite inside the sandbox (2,012 passed, 54 skipped) and unsandboxed by the pre-commit hook (2,048 passed, 18 skipped).
- Verified (adb): a debug-signed release APK built on this Mac is installed on the owner's Android phone and starts with no crash and no script error. Screens, pairing, camera and `outlore://` were not checked (the phone was locked).
- Verified (`gh secret list`): the repository has no `ANDROID_*` secrets, so a tag fails the `android` job and with it the release (`.github/workflows/package.yml`).
- Local build recipe (verified once): Temurin 17 and the Gradle home in `.worktrees/.cache` (git-ignored); Build Tools 37.0.0 and platform `android-37.0` installed in `~/Library/Android/sdk`. In `apps/app`: `bunx expo prebuild --platform android --no-install`, then in `android/`: `./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a -Pkotlin.compiler.execution.strategy=in-process --no-daemon --no-watch-fs` with `JAVA_HOME`, `ANDROID_HOME`, `GRADLE_USER_HOME` set. Inside Claude Code's sandbox Java also needs the proxy as `-Dhttps.proxyHost/Port/User/Password` (with `jdk.http.auth.tunneling.disabledSchemes=` empty) and `-Djava.io.tmpdir` in a writable folder, in `JAVA_TOOL_OPTIONS`; `repo.reactnative.dev` must be reachable. Output: `apps/app/android/app/build/outputs/apk/release/app-release.apk`; install with `adb install -r`.
- Assumed: the workflow's `android` job builds on GitHub (never run there).
- `worktree/context-window` is the only other unmerged branch; the review thread owns it (`2026-11-17-1135-review-ci-green.md`).

## Decisions

- The APK ships in 0.1.7-Prototype, not 0.1.6 (already tagged); recorded in CHG-0443.
- A browser stays listed as a browser (main's CHG-0309), not a desktop as the branch's old test said; recorded in CHG-0443.
- Before a tag: push `main`, run the package workflow by hand, tag only when every platform passes (the owner's rule, 2026-11-17).

## Next

1. The owner checks the installed app on the phone: pair with a host of the same release (0.1.6-Prototype app against a 0.1.6-Prototype host), the QR scanner, an `outlore://` link.
2. Run the package workflow by hand on `main` (workflow_dispatch) so the `android` job builds once on GitHub; fix what it reports.
3. The owner makes the release keystore and adds `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` (README, Build and release), keeping a backup of the key file.
4. Then the 0.1.7-Prototype release. The phone holds a debug-signed build: uninstall it before installing a release-signed APK.

## Open questions

- Who makes the keystore, the owner or an agent with the owner's approval to set the secrets? Owner.
- Is the iOS camera text acceptable, and should the phone's confirmation say more than the relay? Owner (from the superseded handoff).

## Sources

`documentation/changelog/0.1.7-Prototype.md` (CHG-0298, CHG-0443), `documentation/verification/2026-11-15-android-apk.md`, `documentation/verification/2026-11-17-pairing-link-mobile.md`, `.github/workflows/package.yml`, `apps/app/app.json`, `apps/app/app.config.ts`, `packages/controller/src/linkFailure.ts`, `packages/controller/src/browserLink.ts`, commits `00605c9`, `4b419d8`.
