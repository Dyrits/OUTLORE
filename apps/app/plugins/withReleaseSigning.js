// An Expo config plugin: the generated Android project signs its release build with the release keystore named by
// environment variables (set from the repository's secrets in CI), and with the debug key when they are not set, as for a
// build on a developer's machine. The keystore and its passwords never enter a file.
const { withAppBuildGradle } = require("expo/config-plugins");

const releaseSigning = `        release {
            def keystorePath = System.getenv('ANDROID_KEYSTORE_FILE')
            if (keystorePath) {
                storeFile file(keystorePath)
                storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
                keyAlias System.getenv('ANDROID_KEY_ALIAS')
                keyPassword System.getenv('ANDROID_KEY_PASSWORD')
            }
        }
`;

module.exports = (config) =>
  withAppBuildGradle(config, (mod) => {
    let gradle = mod.modResults.contents;
    if (gradle.includes("ANDROID_KEYSTORE_FILE")) return mod;
    // A second block under signingConfigs, next to the debug one.
    gradle = gradle.replace(/(signingConfigs \{\n(?: {8}debug \{[\s\S]*?\n {8}\}\n))/, `$1${releaseSigning}`);
    // The release build uses it when the keystore is given.
    gradle = gradle.replace(
      /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
      "$1signingConfig System.getenv('ANDROID_KEYSTORE_FILE') ? signingConfigs.release : signingConfigs.debug",
    );
    if (!gradle.includes("signingConfigs.release")) {
      throw new Error("withReleaseSigning: the generated build.gradle has a shape this plugin does not know.");
    }
    mod.modResults.contents = gradle;
    return mod;
  });
