# App updates

Status: **agreed and built (CHG-0266), released in 0.1.2-Prototype. The look, an update from a published release, and the Windows and Linux updaters await the owner** (2026-11-13).

The [Android app](#the-android-app) uses the same release channel and its own installer.

## Problem and outcome

The installed Outlore never learns that a newer release exists; the owner downloads each installer by hand. The installed app detects a new release, downloads it, and replaces itself when the owner says so.

## Agreed behavior

- **Only the installed app updates.** A development run (`bun run dev`) never checks; the Workshop's card says so.
- **Checks**: once at start and every 6 hours while the app stays open, and on **Check now**. A check asks the repository's GitHub releases for the newest release of the app's channel and compares versions.
- **Channel**: a build whose version has a prerelease part (`0.1.1-Prototype`) follows prereleases and stable releases; a stable build follows stable releases only. Versions compare as semantic versions.
- **Download in the background**, then the app shows that an update is ready. **Nothing installs unasked**: no install on quit, no automatic restart. A restart stops running turns and a release may break saved data ([requirements](../../requirements.md#releases)), so the owner presses **Restart and update**, after a confirmation that says turns still running stop. **Later** leaves the notice in the Workshop's Updates card.
- **What the owner sees**: an **Updates** section of the Workshop (the installed version, the version found, when it last checked, **Check now**, the switch below, and the release notes of a ready update) and a quiet notice in the app when an update is ready, with the notes' breaking changes shown as written.
- **Switch**: checking is on by default and the owner can turn it off in the Updates section. Off, the app makes no request to GitHub; the setting belongs to this computer and is kept beside the app's data, not in the shared settings.
- **Privacy**: the check is one HTTPS request to GitHub's public release list, carrying the app's name and version in its user agent and nothing about quests, workspaces, accounts, or the owner ([requirements](../../requirements.md#privacy-and-data)).
- **Trust**: an update is trusted when it comes over HTTPS from the repository's own release and its SHA-512 matches `SHA512SUMS.txt`, published in the same release by the release workflow. There is no code-signing key (no Developer ID); an account takeover on GitHub would defeat this, as for any unsigned release. Signing that file with the project's own key is a later hardening ([backlog](../../backlog.md)).
- **macOS** (our own updater, because Squirrel.Mac, which `electron-updater` uses on macOS, refuses an app without a Developer ID): downloads the release's DMG for this Mac's architecture, checks it, copies the new app beside the installed one, and after the app quits swaps the two by renaming, strips the download mark, and opens the new app. The swap keeps the old app aside and puts it back when the rename fails. It needs write access to the folder holding the app; without it, the card says so and offers the release page.
- **Windows and Linux**: `electron-updater` downloads and installs the NSIS installer or replaces the AppImage; a Linux install that is not an AppImage reports that updating needs the AppImage and offers the release page. These paths cannot be run on the build computer and are reported as unverified until smoke-tested on those systems.
- **Failure** is shown in the Updates section with its reason and never stops the app; the next check tries again. A failed install leaves the installed version running.

## Edge cases

- A release with no installer for this platform and architecture, or without `SHA512SUMS.txt`, is skipped as no update, with the reason in the Updates section.
- A downloaded file whose hash differs is deleted and reported.
- A newer version already downloaded and unfinished at the last quit is downloaded again rather than trusted.
- The running version is never offered to itself; an older release is never offered.

## Acceptance

Checks an agent can perform:

- Version comparison, channel choice, and release choice behave as above for prerelease and stable builds ([tests](../../../apps/desktop/test/updates/)).
- With the switch off, no request is made; on, the request carries only the user agent and the standard headers.
- A fake release server offering a newer DMG: the packaged app on macOS finds it, downloads it, rejects a wrong hash, and, after Restart and update, relaunches as the new version with the old app removed; a swap that fails rolls back.
- The Updates section and the notice render the states: unsupported, checking, up to date, downloading, ready, failed, and turned off.

Human acceptance: the owner reviews the look of the Updates section and the notice, and updates a real installed copy from one release to the next once two releases exist. Windows and Linux updating is accepted only after a run on those systems.

## The Android app

Problem: the phone app has no way to learn of a newer release, and a host refuses an app of another release, so each time the desktop host updates, the phone stops working until the owner installs the new APK by hand.

Outcome: the installed phone app finds a newer release, downloads its APK, and installs it when the owner says so, as the desktop does.

- **Only an app installed from a release's APK updates itself.** A store install, iOS and the web app are out of scope (no store build or iOS build exists; a browser loads the host's release anyway). A build installed from a store, if one ever exists, reports that the store updates it.
- **What "automatic" means**: the same as on the desktop. The app checks and downloads in the background; **nothing installs unasked**. The owner presses **Install update**, and Android then shows its own install confirmation. Android never lets a sideloaded app install itself silently, so that confirmation is not a choice of this app.
- **Checks**: once at start, every 6 hours while the app is open, and on **Check now**, reading the repository's public GitHub release list as the desktop does. The **channel** rule is the desktop's (a build with a prerelease part follows prereleases and stable releases; a stable build follows stable releases only), and so are the privacy rule and the switch: one HTTPS request carrying the app's name and version and nothing about quests, hosts, pairings or the owner; with the switch off the app makes no request. The switch belongs to this phone and is kept beside the app's data.
- **Downloading**: automatic only on Wi-Fi or another unmetered network. On mobile data the notice offers **Download anyway** (the APK is about 34 MB at 0.1.7; the real size is shown).
- **What the owner sees**: the same **Updates** section as on the desktop in the app's settings (installed version, version found, when it last checked, **Check now**, the switch, and the release notes of a ready update with the breaking changes as written) and a quiet notice when an update is ready. When a host refuses the app for running another release (`otherRelease`), the refusal also offers **Update this app** when a newer release exists.
- **The install**: **Install update** tells the owner the app closes during installation and can be reopened afterwards. Android shows its own confirmation. Android 8 and later require a one-time "Install unknown apps" allowance for Outlore. The app explains the allowance when the owner presses **Install update** and offers the release page if they decline. On Android 7, the system installer handles the device-wide allowance.
- **Trust and signing**: an update is accepted when its SHA-512 matches `SHA512SUMS.txt` of the same release and Android confirms it is signed with the same key as the installed app. A wrong hash deletes the file and is reported; a key mismatch is shown with its reason and leaves the installed app running. Because of that, a phone with a debug-signed or any APK not signed with the release key cannot update into a release-signed one: it needs one manual uninstall, which loses its pairings, and updates itself from then on. This depends on the release key being set in the repository's secrets ([release workflow](../../../.github/workflows/package.yml)).
- **Pairings survive**: an update keeps the host's key, room and device token held in the phone's secure store, so the phone stays paired.
- **Failure** is shown in the Updates section with its reason and never stops the app; the next check tries again. A failed or cancelled install leaves the installed version running.
- **Earlier releases**: an app of release 0.1.7 or earlier has no updater and needs one manual install of the next release.

Acceptance, checks an agent can perform: the version, channel and release choices, the switch (no request when off), the Wi-Fi-only rule, the hash check and the states of the Updates section (unsupported, checking, up to date, downloading, ready, failed, turned off) behave as above in tests, sharing the desktop's where the logic is the same. Human acceptance, on the owner's phone: install a release-signed APK, publish a later release, see the notice, install it through Android's confirmation, and find the phone still paired; refuse the allowance and see the release page offered. Not accepted until run on a real device with two release-signed releases.

Dependencies: [device pairing](../device-pairing/specifications.md#the-mobile-app-as-a-paired-device) (the release refusal and the secure store); the release workflow's APK and `SHA512SUMS.txt`; the release key in the repository's secrets.

Not in the Android app: a store listing, iOS, installing without Android's confirmation (a possible later refinement, see the [draft](draft.md)), a choice of channel, a data backup, and a rollback.

## Updating a host from a paired device

Problem: a host refuses a paired device of another release, so a phone, browser or second computer that was updated first loses its host until the owner goes to the host and updates it there. Status: **agreed with the owner on 2026-11-18, built in CHG-0518. The first update to this feature must be made on the host by hand, and a real phone and a packaged macOS update are not yet tried.**

Agreed behavior:

- **One tap, never automatic.** When a paired device runs a later release than its host, the banner that today says the releases differ also offers **Update host**. The tap asks first: the host downloads the new release and installs it once no turn is running, so running turns finish first; the host then restarts and the device reconnects by itself. **Later** closes the question and nothing starts.
- **The host never stops a turn for this.** It looks for a newer release (a check the owner asked for runs even with automatic checking off), downloads it, and installs only when no turn is running; it re-checks every 2 seconds while turns run. Once told, the install is the host's own decision: the device may disconnect or close and the install still happens. Asking again changes nothing; a failed install or check is shown and **Try again** asks again.
- **What the device shows**: looking for the release, **Downloading n%**, **Waiting for N running turns to finish**, **Installing**, **Reconnecting…**, or the reason it stopped. The host's update state is read every 3 seconds over a short-lived update link.
- **The pairing survives the restart.** The device's key and token are kept (the host's database, the phone's secure store, the browser's storage); the update link and the device's own link keep trying after the host quits (a second, doubling to half a minute) until the host returns, with no new pairing. When the host answers on the device's release the device's own link starts again at once.
- **Only a host older than the device is offered.** A host newer than the device keeps today's text (the device updates itself); a host that cannot update itself (a development run, no updater on that platform) says why; a host from before this feature does not know the two requests and answers with a failure, shown as "This host is too old to update from here; update it on the host once, then this works."
- **Devices of another release send only those two requests** (`ReadHostUpdate`, `UpdateHost`) over a link the host's resume accepts despite the other release (the hello and resumed messages are unchanged). The host cannot tell the device's release on a resume, so the limit is the device's own discipline.
- The service reaches the desktop updater through its parent process (the utility process's message port), which owns the updater; a service started on its own has none and reports unsupported. Moving the updater into the service (0018) is not part of this.

Acceptance, checks an agent can perform: the service arms an install, waits while turns run, installs once at zero, ignores a second ask, refuses when unsupported, and keeps the install when the device disconnects (`packages/service/test/update/hostUpdate.test.ts`); a device of a later release is refused on the plain link and served on the update link, the host installs, restarts on the same database and the same pairing resumes, for a browser device and for a desktop device through its own service, and a request the host does not know fails (`packages/service/test/update/deviceUpdate.test.ts`); the main process answers the service's calls from the updater controller and a forced check ignores the switch (`apps/desktop/test/serviceUpdates.test.ts`, `controller.test.ts`); the offer, the steps and the wording, and a link that does not give up in ten minutes (`apps/app/test/foundation/hostUpdate.test.ts`, `client.test.ts`). Human acceptance: with a phone one release ahead of a packaged macOS host, tap **Update host** and find the phone connected again after the host restarts.

Not covered: a browser opened on a web build of the relay is the relay's one deployed build, so it offers the update only when that build is newer than the host; forcing an update over running turns; a host running in the background (0018); an update of the relay or the web build; hosts older than this feature (updated by hand once).

## Requirements covered

- Updating reads a public release list and sends nothing about the owner ([requirements](../../requirements.md#privacy-and-data)).
- Nearly free to run: GitHub's public release list and release downloads cost the project nothing.
- Breaking changes are listed in the release notes; the notice shows them before anything installs ([requirements](../../requirements.md#releases)).

## Not in this capability

Developer ID signing and notarization; a data backup before an update; a signed manifest; rollback to an earlier release; beta and stable channel choice by the owner.
