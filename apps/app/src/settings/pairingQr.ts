import { encode } from "uqr";

/** Light modules around the code that a scanner needs to find it; the QR specification asks for at least four. */
export const quietZone = 4;

/** A QR code as one SVG path in module units: `size` modules across, quiet zone included. */
export type PairingQr = { readonly path: string; readonly size: number };

/**
 * Draws `link` as a QR code: error correction level M (a smudge or a glare on a screen does not spoil it), and the
 * dark modules as one path of horizontal runs, so a big code stays one drawing call.
 */
export function pairingQrOf(link: string): PairingQr {
  const { data, size } = encode(link, { border: 0, ecc: "M" });
  const runs: string[] = [];
  data.forEach((row, rowIndex) => {
    let start = -1;
    for (let column = 0; column <= row.length; column++) {
      const isDark = row[column] === true;
      if (isDark && start === -1) start = column;
      if (!isDark && start !== -1) {
        runs.push(`M${start + quietZone} ${rowIndex + quietZone}h${column - start}v1h-${column - start}z`);
        start = -1;
      }
    }
  });
  return { path: runs.join(""), size: size + 2 * quietZone };
}
