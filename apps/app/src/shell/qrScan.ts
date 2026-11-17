import { readPairingInput } from "@outlore/controller";

export const notPairingCodeMessage = "This is not an Outlore pairing code.";

/** What the scanner has already dealt with: the QR code it paired with (it then reads nothing more), or the one it refused. */
export type ScanState = {
  readonly isDone: boolean;
  readonly refused: string | null;
};

export const startScan: ScanState = { isDone: false, refused: null };

export type ScanAction =
  /** A pairing: `text` goes to the confirmation of Add a host, which pairs only when the owner presses Pair. */
  | { readonly kind: "pair"; readonly text: string }
  | { readonly kind: "reject"; readonly message: string }
  | { readonly kind: "wait" };

/**
 * Decides what to do with the text of one QR code the camera read. The camera reports the same code many times a
 * second, so a code already taken or already refused is waited out. A code is a pairing when `readPairingInput` reads
 * it, which is the host's QR code (a web link) as well as an app link or a raw code.
 */
export function scanStep(
  state: ScanState,
  scanned: string,
): { readonly state: ScanState; readonly action: ScanAction } {
  const text = scanned.trim();
  if (state.isDone || text === state.refused) return { action: { kind: "wait" }, state };
  if (readPairingInput(text).ok) return { action: { kind: "pair", text }, state: { isDone: true, refused: null } };
  return { action: { kind: "reject", message: notPairingCodeMessage }, state: { isDone: false, refused: text } };
}
