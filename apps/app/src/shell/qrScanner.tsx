import type { QrScannerProps } from "./qrScannerProps";

// The web app and the desktop window have no scanner: a computer pastes the code or opens the link. The phone app's
// own version is `qrScanner.native.tsx`, which Metro picks on a phone, and which keeps `expo-camera` out of this build.
export const canScanQrCode = false;

export function QrScanner(_props: QrScannerProps): null {
  return null;
}
