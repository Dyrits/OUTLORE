import { describe, expect, it } from "vitest";
import { notPairingCodeMessage, scanStep, startScan } from "../../src/shell/qrScan";

const code =
  "outlore1-gVVlc7y_NpbGWZdnBPDm7RSUJouDZayE7VUgMEu_ehsM10_x9rJHYbYqmmF6eQKi5WNtrhn12PetyyVVFiAWQ2h0dHBzOi8vb3V0bG9yZS5keXJpdHMud29ya2Vycy5kZXYfdJSV";
const webLink = `https://outlore.dyrits.workers.dev/#${code}`;

describe("reading a scanned QR code", () => {
  it("takes the web link that the host's QR code carries", () => {
    expect(scanStep(startScan, webLink).action).toEqual({ kind: "pair", text: webLink });
  });

  it("takes an app link and a raw code too, ignoring whitespace around it", () => {
    expect(scanStep(startScan, ` outlore://pair#${code}\n`).action).toEqual({
      kind: "pair",
      text: `outlore://pair#${code}`,
    });
    expect(scanStep(startScan, code).action).toEqual({ kind: "pair", text: code });
  });

  it("says a QR code that is not a pairing is not one, whatever it holds", () => {
    for (const text of [
      "https://example.com/",
      `https://example.com/?code=${code}`,
      "WIFI:T:WPA;S:home;P:secret;;",
      "outlore1-garbage",
      `ftp://host/#${code}`,
    ]) {
      expect(scanStep(startScan, text).action, text).toEqual({ kind: "reject", message: notPairingCodeMessage });
    }
    expect(notPairingCodeMessage).toBe("This is not an Outlore pairing code.");
  });

  it("does not repeat itself while the camera keeps seeing the same wrong QR code", () => {
    const first = scanStep(startScan, "https://example.com/");
    expect(first.action.kind).toBe("reject");
    expect(scanStep(first.state, "https://example.com/").action).toEqual({ kind: "wait" });
  });

  it("reads another QR code after a wrong one, and reports the next wrong one", () => {
    const wrong = scanStep(startScan, "https://example.com/");
    expect(scanStep(wrong.state, "https://example.org/").action.kind).toBe("reject");
    expect(scanStep(wrong.state, webLink).action.kind).toBe("pair");
  });

  it("takes the pairing once: frames that arrive before the camera closes are ignored", () => {
    const paired = scanStep(startScan, webLink);
    expect(scanStep(paired.state, webLink).action).toEqual({ kind: "wait" });
    expect(scanStep(paired.state, "https://example.com/").action).toEqual({ kind: "wait" });
  });
});
