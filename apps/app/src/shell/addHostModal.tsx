import type { KnownHost } from "@outlore/contracts";
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { messageOf } from "../foundation/client";
import { type PairingOffer, scannedOfferOf } from "../foundation/pairingOffer";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { Button } from "../ui/button";
import { canScanQrCode, QrScanner } from "./qrScanner";

/**
 * The dialog that pairs this installation with a host: the pairing code the host shows, pasted, and the name this
 * computer will have in the host's list of devices (device-pairing, Behavior).
 */
export function AddHostModal({
  computerName,
  deviceNoun = "computer",
  isRequired = false,
  offer = null,
  onCancel,
  onPair,
}: {
  /** The name offered for this computer. */
  computerName: string;
  /** What this device is called in the dialog: a browser or a phone is not a computer. */
  deviceNoun?: "browser" | "computer" | "phone";
  /** A browser with no host has nothing else to show, so the dialog cannot be dismissed. */
  isRequired?: boolean;
  /** A pairing link that opened the app: its code is filled in, and a browser with no host pairs with it at once. */
  offer?: PairingOffer | null;
  onCancel?: () => void;
  /** Pairs with the host and resolves with it; rejects with the reason the owner reads. `code` is a code or a link. */
  onPair: (code: string, deviceName: string) => Promise<KnownHost>;
}) {
  const [code, setCode] = useState(offer?.code ?? "");
  const [name, setName] = useState(computerName);
  const [error, setError] = useState<string | null>(null);
  // The phone's scanner read a QR code: its code replaces the field and its notice names the relay, then it waits for Pair.
  const [isScanning, setIsScanning] = useState(false);
  const [scanned, setScanned] = useState<PairingOffer | null>(null);
  const shown = scanned ?? offer;
  const takeScan = (text: string) => {
    const next = scannedOfferOf(text);
    setIsScanning(false);
    if (next === null) return;
    setScanned(next);
    setCode(next.code);
    setError(null);
  };
  const [isBusy, setIsBusy] = useState(false);
  const isReady = code.trim() !== "" && name.trim() !== "" && !isBusy;
  const pair = () => {
    setIsBusy(true);
    setError(null);
    onPair(code.trim(), name.trim()).then(
      () => setIsBusy(false),
      (reason) => {
        setIsBusy(false);
        setError(messageOf(reason));
      },
    );
  };
  // A link that opened the web app of a browser with no host pairs by itself, once; a failure stays on screen with the
  // code in place, so the owner reads why and can try again or paste another.
  const hasPairedAtOnce = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: it runs once, when the dialog opens with such a link.
  useEffect(() => {
    if (offer?.shouldPairAtOnce !== true || hasPairedAtOnce.current) return;
    hasPairedAtOnce.current = true;
    pair();
  }, []);
  // The scanner fills this same modal: a second one opened while this one is on screen can fail to appear on a phone.
  return (
    <Modal animationType="fade" onRequestClose={isScanning ? () => setIsScanning(false) : onCancel} transparent visible>
      {isScanning ? (
        <QrScanner onCancel={() => setIsScanning(false)} onScanned={takeScan} />
      ) : (
        <View style={local.backdrop}>
          {!isRequired && <Pressable accessibilityLabel="Close" onPress={onCancel} style={StyleSheet.absoluteFill} />}
          <View style={local.panel}>
            <Text style={local.title}>Add a host</Text>
            <Text style={local.help}>
              On the other computer, open Settings, choose Remote access, turn on Allow paired devices, and choose Pair
              a device.{" "}
              {canScanQrCode
                ? "Scan its QR code with the camera, or paste the code or the link it shows here."
                : "Paste the code or the link it shows here, or scan its QR code with a phone."}{" "}
              It works once and expires after ten minutes.
            </Text>
            {canScanQrCode && <Button isPrimary={false} label="Scan a QR code" onPress={() => setIsScanning(true)} />}
            {shown !== null && shown.notice !== "" && <Text style={local.notice}>{shown.notice}</Text>}
            <Text style={local.label}>Pairing code or link</Text>
            <TextInput
              accessibilityLabel="Pairing code or link"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus={!canScanQrCode}
              multiline
              onChangeText={setCode}
              placeholder="outlore1-… or a link"
              placeholderTextColor={colors.placeholder}
              style={[local.input, local.codeInput]}
              value={code}
            />
            <Text style={local.label}>Name this {deviceNoun}</Text>
            <TextInput
              accessibilityLabel={`Name of this ${deviceNoun}`}
              maxLength={60}
              onChangeText={setName}
              style={local.input}
              value={name}
            />
            {error !== null && <Text style={local.error}>{error}</Text>}
            <View style={local.footer}>
              {!isRequired && <Button isPrimary={false} label="Cancel" onPress={() => onCancel?.()} />}
              <Button isDisabled={!isReady} label={isBusy ? "Pairing…" : "Pair"} onPress={pair} />
            </View>
          </View>
        </View>
      )}
    </Modal>
  );
}

const local = StyleSheet.create({
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(5,10,18,0.7)",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  codeInput: { fontFamily: fonts.mono, minHeight: 64 },
  error: { color: colors.dangerText, fontFamily: fonts.sans, fontSize: fontSizes.md },
  footer: { flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 4 },
  help: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fontSizes.md, lineHeight: 20 },
  input: {
    backgroundColor: colors.page,
    borderColor: colors.edge,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
    padding: 10,
  },
  label: { color: colors.textDim, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  notice: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.md, lineHeight: 20 },
  panel: {
    backgroundColor: colors.sidebar,
    borderColor: colors.edge,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: 10,
    maxWidth: 520,
    padding: 20,
    width: "100%",
  },
  title: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.lg, fontWeight: "600" },
});
