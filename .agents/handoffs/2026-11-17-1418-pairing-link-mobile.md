# Handoff: pairing by QR code and link, mobile app built

Supersedes: `2026-11-17-1318-pairing-link.md`
Workspace: OUTLORE, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

A device pairs by clicking a link or scanning a QR code, not only by pasting the text code, on the web app, the desktop app and the mobile app. The three are built; what remains is merging the Android build branch so a phone can pair, and checks on a real window and phone.

## State

- Verified with `git log`: `main` holds `8a957da` (links, QR, web auto-pair, desktop `outlore://`), `872d906` (the earlier handoff) and `c1f4bab` ("Pair from a phone: outlore:// scheme, link handling and an in-app QR scanner", CHG-0436 and CHG-0437), fast-forwarded from `worktree/pairing-link-mobile`. This file was written before the push of `c1f4bab`: check `git log origin/main`.
- Verified by the mobile side-quest in the sandbox with `CI=1`: `bun run check` (863 files), the seven typechecks, and the suite (247 files passed, 4 skipped; 2,007 tests passed, 54 skipped); the web export has no scanner code, the Android export holds it. I did not rerun them after the fast-forward (no code changed).
- Built on the mobile side: `"scheme": "outlore"` and the `expo-camera` plugin (camera text, no microphone) in `apps/app/app.json`; `usePairingLinks` and the pure `arrive` hand a link received at launch or while running to `offerPairing` (a repeat within 5 seconds and a non-pairing link are dropped); a phone never pairs by itself, it shows the relay and waits for Pair; Add a host shows "Scan a QR code" on native only (`qrScanner.native.tsx`, `expo-camera` 58.0.14), with the denied-permission paths and the line "This is not an Outlore pairing code."
- Assumed, not run: everything that needs a phone, an emulator, a camera, a window or a packaged build (scheme opening cold and running, the camera and its permission prompts, the layout, an iOS build, Gradle).
- The native app cannot pair from `main` alone: it reads `window.localStorage` and expects a `crypto` Hermes lacks. Secure storage, the `crypto` polyfill, `android.package` and the APK build are on `worktree/android-apk` (CHG-0298), not merged. Expected conflicts at merge: `plugins` in `app.json`, `deviceNoun` in `App.tsx` and `addHostModal.tsx`, `useHostConnection.ts`, `package.json`, `bun.lock`. After it, `isPhone` (`Platform.OS !== "web"`) can become `isNativeApp` from `page.ts`.
- The https link opens the web app in the phone's browser, not the native app (App Links and universal links are only described in `documentation/backlog.md`). The web link also needs the next web deployment of the relay.

## Decisions

- Owner, 2026-11-17: the link opens the web app, the desktop app and the mobile app; the text code stays in its own block (quest journal entries 1 and 2).
- A phone, like the desktop, asks before pairing from a link or a scan (relay named, not the host); a browser with no host pairs without asking.
- Camera permission text on iOS: "Outlore uses the camera only to read the QR code of a host you want to pair with." Not yet confirmed by the owner.
- App Links and universal links are deferred and written in the backlog.
- Other decisions of the earlier handoff (shared-relay web link, `outlore://` registered only in a packaged run unless `OUTLORE_HANDLE_LINKS=1`, the latest early link kept) still stand.

## Next

1. Confirm with the owner whether to merge `worktree/android-apk` into `main` (it changes the release workflow, which then builds an APK on tags), then merge it, resolve the conflicts above, run `bun run check`, the typechecks and the suite, and install a development build or APK on a phone to test `outlore://` and the scanner.
2. Human acceptance in a window and on a phone: the host card, Copy buttons, the auto-pair in a browser, `outlore://` clicks on each desktop system, the camera scan.
3. Deploy the web app to the shared relay so the web link works (needs the owner's go-ahead).
4. Check the changelog numbers CHG-0434 to CHG-0437 against any other branch before it merges.
5. The review handoff `2026-11-17-1135-review-ci-green.md` still lists open items, which this work does not replace.

## Open questions

- Merge `worktree/android-apk` now? Owner.
- Is the iOS camera text acceptable? Owner.
- Should the desktop and phone confirmation say more than the relay? The host's name is unknown before pairing.

## Sources

- `documentation/capabilities/device-pairing/specifications.md` (Behavior, Acceptance)
- `documentation/changelog/0.1.6-Prototype.md` (CHG-0434 to CHG-0437)
- `documentation/verification/2026-11-17-pairing-link.md`, `documentation/verification/2026-11-17-pairing-link-mobile.md`
- `documentation/backlog.md` (App Links and universal links)
- `apps/app/src/foundation/pairingLinkArrivals.ts`, `apps/app/src/shell/qrScanner.native.tsx`, `apps/app/src/shell/pairingOffer.ts`
- Commits `8a957da`, `c1f4bab`; branch `worktree/android-apk` (`ad8b2fd`)
