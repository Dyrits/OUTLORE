import { useEffect, useRef } from "react";
import { Linking, Platform } from "react-native";
import { arrive, noArrivals } from "./pairingLinkArrivals";

/**
 * Hands the pairing links that open the phone app to `offerPairing`: the one that started it (`getInitialURL`) and the
 * ones received while it runs (the `url` event). A link is only offered for confirmation in Add a host, never paired
 * (device-pairing). The web build and the desktop window have their own entries (the address bar, the protocol handler),
 * so this does nothing there.
 */
export function usePairingLinks(offerPairing: (link: string) => void) {
  // The latest callback, so the listener is set up once: setting it up again would ask for the starting link again.
  const offer = useRef(offerPairing);
  offer.current = offerPairing;
  useEffect(() => {
    if (Platform.OS === "web") return;
    let arrivals = noArrivals;
    const receive = (url: string | null | undefined) => {
      const next = arrive(arrivals, url ?? null, Date.now());
      arrivals = next.state;
      if (next.link !== null) offer.current(next.link);
    };
    // Listening comes first, so a link that arrives while the starting link is read is not missed.
    const subscription = Linking.addEventListener("url", ({ url }) => receive(url));
    Linking.getInitialURL().then(receive, () => {});
    return () => subscription.remove();
  }, []);
}
