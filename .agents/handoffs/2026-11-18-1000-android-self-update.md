# Handoff: Android self-update

Supersedes: none
Workspace: Outlore, `.worktrees/android-update`, branch `worktree/android-update`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Let the installed GitHub APK find, download, and install a newer Outlore release with the owner's confirmation. Verify on a phone that pairing survives installation.

## State

- Verified by tests and source review. The updater is wired into Android startup, Settings, the top bar, and both host-refusal views. Desktop and Android share release selection and checksum parsing.
- Verified by Git. The worktree started at `ffb370e765f8080e7f71f10f794092e88131cd1a`. Implementation resumed at specification commit `81e7472`. The original repository is `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS` and the return branch is `main`.
- Verified by local commands. The full suite, Biome, typecheck, web export, Expo Android prebuild, and installer Kotlin compilation passed. See the verification record for build and device evidence.

## Decisions

- The owner approved Android's install confirmation, a one-time allowance when Android requires it, and automatic downloads on unmetered networks. Mobile data requires **Download anyway**. See CHG-0460.
- Android normally offers **Open** after installation. The updater tells the owner to reopen the app after updating.
- The worktree is independent of the sidebar integration. The Android agreement uses CHG-0460 and its delivery uses CHG-0461 to avoid the sidebar's changelog numbers.

## Next

1. Confirm the state of the release signing secrets without reading or recording their values.
2. After local review and authorized integration, follow the verification record with two successive release-signed APKs and a paired phone.

## Open questions

- Only a phone can confirm the installer, permission fallback, and pairing after installation. The installed APK and update must use the same signing key.

## Sources

- [Android updater specification](../../documentation/capabilities/app-updates/specifications.md#the-android-app)
- [Verification](../../documentation/verification/2026-11-18-android-self-update.md)
- [0.1.8-Prototype changelog](../../documentation/changelog/0.1.8-Prototype.md)
