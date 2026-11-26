# Handoff: The Android app makes direct channels

Supersedes: none
Workspace: outlore, branch `worktree/android-direct` (rebased on `origin/main` at `006f4a88`, then pushed to `origin/main`), worktree `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS/.worktrees/android-direct`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

A paired Android phone should move its link onto a direct WebRTC data channel like the web app and the desktop do, so it stops sending every frame through the shared relay (which hit Cloudflare's 100,000 Durable Object requests a day cap on 2026-11-24). Done looks like: the real phone shown as "connected now, direct" in Workshop on a real network, and the relay's request count staying low while the phone is used.

## State

- **Built and committed** as CHG-0754 (`0.2.9-Pre-Alpha`): `react-native-webrtc` 155.0.1 in `apps/app`; `directSettingsOfLoader` in `packages/controller/src/browserLink.ts`; `directSettingsOfPhone` in `apps/app/src/foundation/native/phoneDirect.native.ts` (the stub `phoneDirect.ts` serves the web build and tests); `page.ts` hands it to the phone's page settings; `apps/app/plugins/withWebRtcRules.js` adds the R8 rule `-dontwarn org.webrtc.Dav1dDecoder$Natives`; the Hermes builtins guard covers `packages/channel`. ADR 0026, the device-pairing specification, `architecture.md`, `draft.md` and the changelog were updated.
- **Verified by me on this branch before the rebase:** the 7-workspace typecheck, Biome on the changed files, and the full suite (3416 passed, 0 failed, 30 skipped); the new tests are `packages/controller/test/directSettings.test.ts` (6) and `apps/app/test/plugins/withWebRtcRules.test.ts` (3). `expo prebuild` then `./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a` under JDK 17 built a 47.0 MB APK; the first build failed in `minifyReleaseWithR8` until the rule was added. The Android JS export bundles `phoneDirect.native.ts`; the web export has no `react-native-webrtc` code (only its name in the embedded `package.json`).
- **Verified live on an Android 36 arm64 emulator** against a disposable host (a temporary test, since deleted) on the shared relay with Cloudflare STUN: the pairing link opened the app, the host listed the device as `phone`, connected and direct, with a UDP socket on the host; creating a quest and sending a message worked; the relay counted 1 request in that minute (24 while pairing); a force-stop and relaunch resumed the pairing and the direct channel within seconds.
- **After the rebase on `006f4a88`** (another commit took CHG-0753, so this entry is CHG-0754 and sits after it in `0.2.9-Pre-Alpha.md`): the target is an ancestor, `git diff --check` passes, the typecheck passes (7 of 7) and the full suite passed (405 files, 3418 tests, 30 skipped, 0 failed).
- **Not verified:** a real NAT or mobile network, the real phone, a host on another release, relay fallback on the phone itself, long sessions, battery and memory, iOS (no iOS build exists). The Android phone paired on the owner's Mac ("TCL") still runs an older APK on the relay.
- **Not explained:** the original complaint that a phone connected through the relay could read content but not operate the app. On 2026-11-26 Cloudflare showed the relay healthy (about 240 Durable Object requests an hour idle, spikes only while a page is open, no errors since 2026-11-25 06:00 UTC) and the web page and host on release 0.2.8. P2P lowers load and latency; it was not shown to fix that symptom.

## Decisions

- Use `react-native-webrtc` (no Expo module offers WebRTC); load it lazily at the first try; a build without the native module stays on the relay (ADR 0026, amended).
- No config plugin from `@config-plugins/react-native-webrtc`: the library's manifest adds no camera or microphone permission, and the app keeps `expo-camera`'s own settings (`recordAudioAndroid: false`).
- Accept the `bun.lock` change: the library pins `debug` 4.3.4, so the root `debug` and `ms` are older and other packages got nested copies.

## Next

1. Build a release-signed APK (the tag workflow `.github/workflows/package.yml`, or a manual run), install it over the phone's app, and check that Workshop's Remote access card lists the phone as "connected now, direct" from the home network and from mobile data.
2. Read Cloudflare Metrics (Workers & Pages, `outlore`) with the phone in use: requests should stay flat after pairing.
3. Find what makes the relay-connected phone unable to operate the app: ask which screen stalls, check the phone's app release against the host's, and look at the relay's close reasons in the host log.
4. If direct fails on mobile data (symmetric NAT), decide whether a TURN server is needed (ADR 0026 left it out).

## Open questions

- Does hole punching succeed from the owner's phone on 5G? Only a real device test answers it.
- Is the 12.5 MB growth of the APK acceptable? The owner decides.
- Should a failed native load or a failed direct attempt be visible to the user? Today a failed try is silent and retried after 30 seconds, doubling up to 15 minutes.

## Sources

- `documentation/changelog/0.2.9-Pre-Alpha.md` (CHG-0754), `documentation/architecture-decision-record/0026-direct-webrtc-channels-with-werift-and-relay-fallback.md`, `documentation/capabilities/device-pairing/specifications.md`
- `apps/app/src/foundation/native/phoneDirect.native.ts`, `apps/app/src/foundation/browser/page.ts`, `packages/controller/src/browserLink.ts`, `apps/app/plugins/withWebRtcRules.js`
- `.agents/handoffs/2026-11-25-0842-relay-outage-and-idle-traffic.md`, `documentation/research/gcp-relay-options-2026-11-25.md` (uncommitted in the main checkout)
- `react-native-webrtc` 155.0.1 on npm; Maven Central `org.jitsi:webrtc` 155.0.1
