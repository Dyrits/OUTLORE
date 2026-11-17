import type { ExpoConfig } from "expo/config";
import { version } from "./package.json";

// app.json holds the configuration; this adds what changes with each release. The release (the tag, stamped into
// package.json by the release workflow) is the app's version, so the host sees the same release as the web app's and
// the desktop's. Android installs an update only over a higher versionCode, which the workflow sets from its run number.
/** Applies the release version and Android build number to the app configuration. */
export default ({ config }: { config: ExpoConfig }): ExpoConfig => ({
  ...config,
  android: {
    ...config.android,
    versionCode: Number(process.env.ANDROID_VERSION_CODE ?? 1),
  },
  name: config.name ?? "Outlore",
  slug: config.slug ?? "outlore",
  version,
});
