import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useRef, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { messageOf } from "../foundation/client";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { Button } from "../ui/button";
import { cameraAccessOf } from "./cameraAccess";
import { scanStep, startScan } from "./qrScan";
import type { QrScannerProps } from "./qrScannerProps";

export const canScanQrCode = true;

/**
 * The phone app's QR scanner (device-pairing): the camera reads the host's QR code, which holds the web link, and hands
 * its text to Add a host for the owner's confirmation. It says how to allow the camera when it is refused for good, and
 * that a code it read is not a pairing.
 */
export function QrScanner({ onCancel, onScanned }: QrScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const access = cameraAccessOf(permission);
  const [message, setMessage] = useState<string | null>(null);
  const scan = useRef(startScan);
  // The system's question appears on its own the first time; after a refusal the owner asks again with the button.
  const hasAsked = useRef(false);
  useEffect(() => {
    if (permission?.status !== "undetermined" || !permission.canAskAgain || hasAsked.current) return;
    hasAsked.current = true;
    requestPermission().catch((reason) => setMessage(messageOf(reason)));
  }, [permission, requestPermission]);
  const read = (scanned: string) => {
    const step = scanStep(scan.current, scanned);
    scan.current = step.state;
    if (step.action.kind === "pair") onScanned(step.action.text);
    else if (step.action.kind === "reject") setMessage(step.action.message);
  };
  return (
    <View style={local.screen}>
      {access.kind === "granted" ? (
        <>
          <CameraView
            accessibilityLabel="Camera"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            facing="back"
            onBarcodeScanned={({ data }) => read(data)}
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={local.aim}>
            <View style={local.frame} />
          </View>
          <View style={local.bottom}>
            <Text style={local.text}>Point the camera at the QR code the host shows.</Text>
            {message !== null && (
              <Text accessibilityRole="alert" style={local.error}>
                {message}
              </Text>
            )}
            <Button isPrimary={false} label="Paste the code instead" onPress={onCancel} />
          </View>
        </>
      ) : (
        <View style={local.notice}>
          <Text style={local.title}>Scan a QR code</Text>
          {access.kind === "loading" && <Text style={local.text}>Opening the camera…</Text>}
          {access.kind === "ask" && (
            <>
              <Text style={local.text}>Outlore needs the camera to read the QR code of the host.</Text>
              <Button
                label="Allow the camera"
                onPress={() => requestPermission().catch((reason) => setMessage(messageOf(reason)))}
              />
            </>
          )}
          {access.kind === "blocked" && (
            <>
              <Text style={local.text}>{access.message}</Text>
              <Button
                label="Open Settings"
                onPress={() => Linking.openSettings().catch((reason) => setMessage(messageOf(reason)))}
              />
            </>
          )}
          {message !== null && (
            <Text accessibilityRole="alert" style={local.error}>
              {message}
            </Text>
          )}
          <Button isPrimary={false} label="Paste the code instead" onPress={onCancel} />
        </View>
      )}
    </View>
  );
}

const local = StyleSheet.create({
  aim: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  bottom: {
    backgroundColor: colors.sidebar,
    bottom: 0,
    gap: 10,
    left: 0,
    padding: 20,
    position: "absolute",
    right: 0,
  },
  error: { color: colors.dangerText, fontFamily: fonts.sans, fontSize: fontSizes.md },
  frame: { borderColor: "#ffffff", borderRadius: radii.xl, borderWidth: 3, height: 240, width: 240 },
  notice: { gap: 12, maxWidth: 420, padding: 24, width: "100%" },
  screen: { alignItems: "center", backgroundColor: colors.page, flex: 1, justifyContent: "center" },
  text: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.md, lineHeight: 20 },
  title: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.lg, fontWeight: "600" },
});
