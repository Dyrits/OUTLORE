// An Expo config plugin: the generated Android project's release build (which R8 shrinks) carries the one rule that
// `react-native-webrtc`'s WebRTC library (`org.jitsi:webrtc`) lacks. Its AV1 decoder names a class that the library does
// not ship, and R8 stops the build on it ("Missing class org.webrtc.Dav1dDecoder$Natives"). The app uses data channels
// only, so the decoder is never loaded and the warning is safe to silence. The library's own rules keep the rest.
const { withDangerousMod } = require("expo/config-plugins");
const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const rule = "-dontwarn org.webrtc.Dav1dDecoder$Natives";
const marker = "# react-native-webrtc (withWebRtcRules)";

/** The ProGuard rules with the WebRTC rule added once. */
const rulesWithWebRtc = (contents) =>
  contents.includes(rule) ? contents : `${contents.trimEnd()}\n\n${marker}\n${rule}\n`;

/** Adds the WebRTC rule to the generated Android project's `proguard-rules.pro`. */
module.exports = (config) =>
  withDangerousMod(config, [
    "android",
    (modConfig) => {
      const file = join(modConfig.modRequest.platformProjectRoot, "app", "proguard-rules.pro");
      writeFileSync(file, rulesWithWebRtc(readFileSync(file, "utf8")));
      return modConfig;
    },
  ]);

module.exports.rulesWithWebRtc = rulesWithWebRtc;
