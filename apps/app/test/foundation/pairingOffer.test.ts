import { describe, expect, it } from "vitest";
import { pairingOfferOf, scannedOfferOf } from "../../src/foundation/pairingOffer";

// A real code, made by the host, naming the shared relay; the offer reads it only to name the relay.
const code =
  "outlore1-gVVlc7y_NpbGWZdnBPDm7RSUJouDZayE7VUgMEu_ehsM10_x9rJHYbYqmmF6eQKi5WNtrhn12PetyyVVFiAWQ2h0dHBzOi8vb3V0bG9yZS5keXJpdHMud29ya2Vycy5kZXYfdJSV";

describe("offering a pairing that arrived as a link", () => {
  it("pairs a browser that has no host at once, with no question, from the web link", () => {
    const offer = pairingOfferOf(`#${code}`, { hasHosts: false, isBrowser: true });
    expect(offer).toMatchObject({ code, shouldPairAtOnce: true });
  });

  it("asks a browser that already has a host before it pairs another, and names the relay", () => {
    const offer = pairingOfferOf(`#${code}`, { hasHosts: true, isBrowser: true });
    expect(offer).toMatchObject({ code, shouldPairAtOnce: false });
    expect(offer?.notice).toContain("another host");
    expect(offer?.notice).toContain("outlore.dyrits.workers.dev");
    expect(offer?.notice).toContain("Pair");
  });

  it("never pairs the desktop app at once: it shows the relay and waits for the owner's confirmation", () => {
    const offer = pairingOfferOf(`outlore://pair#${code}`, { hasHosts: false, isBrowser: false });
    expect(offer).toMatchObject({ code, shouldPairAtOnce: false });
    expect(offer?.notice).toContain("outlore.dyrits.workers.dev");
    expect(offer?.notice).toContain("confirm");
  });

  it("never pairs the phone app at once, even with no host and although it has no desktop bridge: it asks first", () => {
    for (const link of [`outlore://pair#${code}`, `https://outlore.dyrits.workers.dev/#${code}`]) {
      const offer = pairingOfferOf(link, { hasHosts: false, isBrowser: true, isPhone: true });
      expect(offer).toMatchObject({ code, shouldPairAtOnce: false });
      expect(offer?.notice).toContain("this phone");
      expect(offer?.notice).toContain("outlore.dyrits.workers.dev");
      expect(offer?.notice).toContain("Pair");
      expect(offer?.notice).not.toContain("browser");
      expect(offer?.notice).not.toContain("computer");
    }
  });

  it("asks the phone app that already has a host in the same words", () => {
    const offer = pairingOfferOf(`outlore://pair#${code}`, { hasHosts: true, isBrowser: true, isPhone: true });
    expect(offer).toMatchObject({ code, shouldPairAtOnce: false });
    expect(offer?.notice).toContain("this phone");
  });

  it("keeps a code that cannot be read, so pairing says why instead of staying silent", () => {
    const offer = pairingOfferOf("outlore://pair#outlore1-garbage", { hasHosts: false, isBrowser: false });
    expect(offer).toMatchObject({ code: "outlore1-garbage", shouldPairAtOnce: false });
    expect(offer?.notice).not.toContain("undefined");
  });

  it("offers nothing for a link or a hash that is not a pairing", () => {
    expect(pairingOfferOf("", { hasHosts: false, isBrowser: true })).toBeNull();
    expect(pairingOfferOf("#settings", { hasHosts: false, isBrowser: true })).toBeNull();
    expect(pairingOfferOf("outlore://settings", { hasHosts: false, isBrowser: false })).toBeNull();
  });
});

describe("offering a pairing that the phone's scanner read", () => {
  it("fills in the code of the web link the host's QR code holds, names the relay, and waits for Pair", () => {
    const offer = scannedOfferOf(`https://outlore.dyrits.workers.dev/#${code}`);
    expect(offer).toMatchObject({ code, shouldPairAtOnce: false });
    expect(offer?.notice).toContain("this phone");
    expect(offer?.notice).toContain("outlore.dyrits.workers.dev");
    expect(offer?.notice).not.toContain("link was opened");
  });

  it("reads an app link and a raw code as well", () => {
    expect(scannedOfferOf(` outlore://pair#${code}\n`)).toMatchObject({ code, shouldPairAtOnce: false });
    expect(scannedOfferOf(code)).toMatchObject({ code, shouldPairAtOnce: false });
  });

  it("offers nothing for a QR code that is not a pairing", () => {
    expect(scannedOfferOf("https://example.com/")).toBeNull();
    expect(scannedOfferOf("outlore://pair#outlore1-garbage")).toBeNull();
    expect(scannedOfferOf("")).toBeNull();
  });
});
