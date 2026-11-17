import { pairingInputOf } from "@outlore/controller";

/**
 * What the phone app remembers of the links that opened it. A link that starts the app is reported twice by the system
 * (as the starting link and as a link event), a moment apart, so the same link within this many milliseconds is one.
 */
const deliveryMilliseconds = 5000;

export type Arrivals = {
  readonly lastLink: string | null;
  readonly lastAt: number;
};

export const noArrivals: Arrivals = { lastAt: 0, lastLink: null };

/**
 * Decides what to do with a link that reached the phone app, whether it started the app or arrived while it ran
 * (device-pairing). `link` is the text to hand to pairing, or null for a link to leave alone: a link that is not a
 * pairing, one that is missing, or the same one delivered a second time. It is shown for confirmation, never paired.
 */
export function arrive(
  state: Arrivals,
  url: string | null,
  now: number,
): { readonly state: Arrivals; readonly link: string | null } {
  if (url === null || pairingInputOf(url) === null) return { link: null, state };
  const link = url.trim();
  if (link === state.lastLink && now - state.lastAt < deliveryMilliseconds) return { link: null, state };
  return { link, state: { lastAt: now, lastLink: link } };
}
