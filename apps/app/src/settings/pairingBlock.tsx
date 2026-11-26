import type { PairingCode } from "@outlore/contracts";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { Button } from "../ui/button";
import { pairingQrOf } from "./pairingQr";
import { codeLifeOf, pairingHelp, pairingSecrecyNotice } from "./remoteAccess";
import { useCopiedText } from "./useCopiedText";

/** The code is drawn about this wide; each module is a whole number of pixels, so its edges stay sharp. */
const qrWidth = 220;

/**
 * What the host shows for a pairing just made (device-pairing): a QR code of the web link, the web link and the app link
 * with a Copy button each, and the pairing code on its own, as the fallback, with its own Copy button.
 */
export function PairingBlock({ now, pairing }: { now: number; pairing: PairingCode }) {
  const { copied: copiedKey, copy } = useCopiedText();
  const qr = pairingQrOf(pairing.webLink);
  const pixels = qr.size * Math.max(3, Math.floor(qrWidth / qr.size));
  return (
    <View style={local.box}>
      <Text style={local.label}>Scan to pair</Text>
      <View accessibilityLabel="QR code to pair" accessibilityRole="image" style={local.qr}>
        <Svg height={pixels} viewBox={`0 0 ${qr.size} ${qr.size}`} width={pixels}>
          {/* Always dark on light, whatever the theme: a scanner needs the contrast. */}
          <Rect fill="#ffffff" height={qr.size} width={qr.size} x={0} y={0} />
          <Path d={qr.path} fill="#000000" />
        </Svg>
      </View>
      <Text style={styles.muted}>{codeLifeOf(pairing.expiresAt, now)}</Text>
      <Text style={styles.muted}>{pairingHelp}</Text>
      <LinkRow
        isCopied={copiedKey === "web"}
        label="Link that opens the web app"
        onCopy={() => void copy("web", pairing.webLink)}
        text={pairing.webLink}
      />
      <LinkRow
        isCopied={copiedKey === "app"}
        label="Link that opens the Outlore app"
        onCopy={() => void copy("app", pairing.appLink)}
        text={pairing.appLink}
      />
      <Text style={styles.muted}>{pairingSecrecyNotice}</Text>
      <View style={local.codeBox}>
        <Text style={local.label}>Pairing code</Text>
        <Text accessibilityLabel="Pairing code" selectable style={local.code}>
          {pairing.code}
        </Text>
        <Button
          isPrimary={false}
          label={copiedKey === "code" ? "Copied" : "Copy the code"}
          onPress={() => void copy("code", pairing.code)}
        />
      </View>
    </View>
  );
}

function LinkRow({
  isCopied,
  label,
  onCopy,
  text,
}: {
  isCopied: boolean;
  label: string;
  onCopy: () => void;
  text: string;
}) {
  return (
    <View style={local.linkRow}>
      <View style={local.linkText}>
        <Text style={local.label}>{label}</Text>
        <Text accessibilityLabel={label} numberOfLines={1} selectable style={local.code}>
          {text}
        </Text>
      </View>
      <Button isPrimary={false} label={isCopied ? "Copied" : "Copy"} onPress={onCopy} />
    </View>
  );
}

const local = StyleSheet.create({
  box: {
    backgroundColor: colors.page,
    borderColor: colors.edge,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  code: {
    color: colors.text,
    fontFamily: fonts.mono,
    fontSize: fontSizes.sm,
    lineHeight: 18,
  },
  codeBox: { gap: 6 },
  label: { color: colors.textDim, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  linkRow: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between" },
  linkText: { flex: 1, gap: 2 },
  qr: { alignSelf: "flex-start", borderRadius: radii.md, overflow: "hidden" },
});
