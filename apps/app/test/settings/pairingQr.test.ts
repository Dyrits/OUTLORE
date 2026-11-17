import { encode } from "uqr";
import { describe, expect, it } from "vitest";
import { pairingQrOf, quietZone } from "../../src/settings/pairingQr";

/** A code as long as a real one (102 bytes of base64url after the prefix), with the web app's address before it. */
const code = `outlore1-${"Zm9vYmFy".repeat(17)}`;
const realLink = () => `https://outlore.dyrits.workers.dev/#${code}`;

/** Reads the drawn path back into rows of dark modules, so a test sees what a scanner would see. */
const modulesOf = (qr: { path: string; size: number }) => {
  const rows = Array.from({ length: qr.size }, () => Array.from({ length: qr.size }, () => false));
  for (const run of qr.path.matchAll(/M(\d+) (\d+)h(\d+)v1h-\3z/g)) {
    const [, column, row, width] = run.map(Number);
    for (let offset = 0; offset < (width ?? 0); offset++) {
      const cells = rows[row ?? 0];
      if (cells !== undefined) cells[(column ?? 0) + offset] = true;
    }
  }
  return rows;
};

describe("drawing a pairing link as a QR code", () => {
  it("draws the modules of a code of error correction level M, with a quiet zone around it", () => {
    const link = realLink();
    const qr = pairingQrOf(link);
    const expected = encode(link, { border: 0, ecc: "M" });
    expect(qr.size).toBe(expected.size + 2 * quietZone);
    const drawn = modulesOf(qr);
    for (let row = 0; row < qr.size; row++) {
      for (let column = 0; column < qr.size; column++) {
        const inside =
          row >= quietZone && row < qr.size - quietZone && column >= quietZone && column < qr.size - quietZone;
        const dark = inside ? (expected.data[row - quietZone]?.[column - quietZone] ?? false) : false;
        expect(drawn[row]?.[column], `${row},${column}`).toBe(dark);
      }
    }
  });

  it("keeps a quiet zone of at least four light modules, as scanners expect", () => {
    expect(quietZone).toBeGreaterThanOrEqual(4);
    const drawn = modulesOf(pairingQrOf(realLink()));
    const size = drawn.length;
    for (let ring = 0; ring < quietZone; ring++) {
      expect(drawn[ring]?.some(Boolean)).toBe(false);
      expect(drawn[size - 1 - ring]?.some(Boolean)).toBe(false);
      expect(drawn.some((row) => row[ring] === true || row[size - 1 - ring] === true)).toBe(false);
    }
  });

  it("puts a finder pattern in three corners", () => {
    const drawn = modulesOf(pairingQrOf(realLink()));
    const size = drawn.length;
    const far = size - quietZone - 7;
    for (const [top, left] of [
      [quietZone, quietZone],
      [quietZone, far],
      [far, quietZone],
    ] as const) {
      // A 7 by 7 finder: dark ring, light ring, 3 by 3 dark centre.
      for (let row = 0; row < 7; row++) {
        for (let column = 0; column < 7; column++) {
          const isEdge = row === 0 || row === 6 || column === 0 || column === 6;
          const isCentre = row >= 2 && row <= 4 && column >= 2 && column <= 4;
          expect(drawn[top + row]?.[left + column]).toBe(isEdge || isCentre);
        }
      }
    }
  });

  it("fits a real web link in a code a phone camera reads at a small size", () => {
    // Version 10 is 57 modules; past that a link on a laptop screen gets hard to scan.
    const qr = pairingQrOf(realLink());
    expect(qr.size - 2 * quietZone).toBeLessThanOrEqual(57);
  });

  it("is smaller for the app link than for the web link", () => {
    expect(pairingQrOf(`outlore://pair#${code}`).size).toBeLessThanOrEqual(pairingQrOf(realLink()).size);
  });
});
