This Expo/React Native app builds for Electron, browsers, and Android.
The Electron window uses the web build, and the relay serves the web build for browsers that pair with a running desktop host.
The Android APK uses the desktop host and stores its pairings in the phone's secure store.
See the [architecture](../../documentation/architecture.md#parts) for the boundaries.
Make changes work on web first and keep them portable to native.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).
Use `bunx expo install <package>` for Expo dependencies so the CLI selects SDK-compatible versions.

```bash
bunx expo install <package> # Resolves SDK-compatible versions.
bunx expo start             # Starts the dev server.
bun run check               # lint and format check (Biome, from the repository root; not expo lint)
bun run typecheck           # Typechecks the workspace.
bunx expo-doctor            # Diagnoses dependency and configuration issues.
bunx expo install --fix     # Fixes incompatible package versions.
```

Run `bun run check` and `bun run typecheck` before declaring any task done.

## Navigation

The app switches screens with component state; there is no router. Add one (Expo Router) when the app needs addressable routes.

## Building with EAS

Outlore's [release workflow](../../.github/workflows/package.yml) builds and signs the Android APK with Expo prebuild and Gradle.

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
