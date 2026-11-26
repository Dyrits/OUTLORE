import { describe, expect, it } from "vitest";
import { rulesWithWebRtc } from "../../plugins/withWebRtcRules.js";

// The release build shrinks the app with R8, which stops on the one class the WebRTC library names and does not ship;
// the plugin adds the rule that silences it (react-native-webrtc, direct channels on the phone).
const generated = "# Add project specific ProGuard rules here.\n-keep class com.facebook.react.turbomodule.** { *; }\n";

describe("the WebRTC rule in the generated ProGuard file", () => {
  it("adds the rule for the missing decoder class", () => {
    expect(rulesWithWebRtc(generated)).toContain("-dontwarn org.webrtc.Dav1dDecoder$Natives");
  });

  it("keeps the rules that were there", () => {
    expect(rulesWithWebRtc(generated)).toContain(generated.trimEnd());
  });

  it("adds it once, however often the project is generated", () => {
    const once = rulesWithWebRtc(generated);
    expect(rulesWithWebRtc(once)).toBe(once);
  });
});
