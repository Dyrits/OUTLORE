export type QrScannerProps = {
  /** The owner left the scanner, to paste the code instead. */
  onCancel: () => void;
  /** The text of a QR code that reads as a pairing (a link or a code); the camera is done with it. */
  onScanned: (text: string) => void;
};
