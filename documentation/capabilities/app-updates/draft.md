# App updates: draft

Open items only. Agreed behavior is in [specifications.md](specifications.md).

## Android: open questions

- **Installing without Android's confirmation.** From Android 12 an app can ask the system to skip the confirmation for an update of itself when it is the installer of record, but the system decides ("best effort"), so it cannot be promised. Whether it applies to this app and on which phones is unverified. Propose a small spike on the owner's phone, scoped and approved as its own piece of work, before any claim is made. The agreed behavior keeps Android's confirmation.

## Technical notes (not agreed behavior)

- Expo's `expo-updates` replaces JavaScript only, not the APK, so it does not do this; the APK has to be handed to Android's package installer by a small native module (an Expo module or a maintained library, with its licence recorded: [requirements](../../requirements.md#licensing)).
- The APK's `versionCode` already comes from the workflow's run number, which only rises; the release key must stay the same for Android to accept an update.
- The release asset name is `Outlore-<version>-android.apk`, checked against `SHA512SUMS.txt`; the desktop's release choice and hash logic (`apps/desktop/src/updates/`) may be shared rather than copied.
- The manifest needs the install-packages permission; the app asks for the allowance at the first install, not at launch.
