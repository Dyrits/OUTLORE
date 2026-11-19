import { pairingInputOf, readPairingInput } from "@outlore/controller";

/** A pairing that reached this window as a link, waiting to be shown in Add a host. */
export type PairingOffer = {
  /** The pairing code the link carried; it may still be bad, and pairing then says why. */
  readonly code: string;
  /** What the dialog says above the code, so the owner knows what pressing Pair does. */
  readonly notice: string;
  /** True only for a browser with no host: the link opened the web app to pair, so it pairs without a paste. */
  readonly shouldPairAtOnce: boolean;
};

type Surroundings = {
  /** Whether this installation or browser is already paired with a host. */
  readonly hasHosts: boolean;
  readonly isBrowser: boolean;
  /** The phone app: it has no desktop bridge, so it counts as a browser elsewhere, but it never pairs without asking. */
  readonly isPhone?: boolean;
};

/**
 * What to do with a pairing link or a location hash that reached the window (device-pairing): a browser with no host
 * pairs at once; anything else, the phone app included, is shown with the relay it names and waits for the owner to
 * press Pair, because a link can be opened by any page or program. Null when the text is not a pairing, so a page's own fragment is left alone.
 */
export function pairingOfferOf(text: string, surroundings: Surroundings): PairingOffer | null {
  const code = pairingInputOf(text);
  if (code === null) return null;
  const read = readPairingInput(code);
  const relay = read.ok ? new URL(read.value.relayOrigin).host : null;
  const through = relay === null ? "" : ` through the relay ${relay}`;
  if (surroundings.isPhone === true) {
    const notice = `Pair this phone with a host${through}? Check that you asked for it, then press Pair to confirm, or Cancel.`;
    return { code, notice, shouldPairAtOnce: false };
  }
  if (surroundings.isBrowser && !surroundings.hasHosts) return { code, notice: "", shouldPairAtOnce: true };
  const notice = surroundings.isBrowser
    ? `A pairing link was opened. Pair this browser with another host${through}? Press Pair to add it, or Cancel.`
    : `A pairing link was opened. Pair this computer with a host${through}? Check that you asked for it, then press Pair to confirm, or Cancel.`;
  return { code, notice, shouldPairAtOnce: false };
}

/**
 * The offer for the text of a QR code the phone's scanner read: a link, as the host's QR code holds, or a raw code. Like
 * a link that opened the app, it waits for the owner to press Pair. Null when the text is not a pairing.
 */
export function scannedOfferOf(text: string): PairingOffer | null {
  const input = pairingInputOf(text) ?? text.trim();
  if (!readPairingInput(input).ok) return null;
  return pairingOfferOf(`#${input}`, { hasHosts: true, isBrowser: true, isPhone: true });
}
