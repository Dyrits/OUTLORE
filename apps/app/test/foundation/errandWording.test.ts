import { describe, expect, it } from "vitest";

// The interface, Chronicler's guide, the thread tool descriptions and the instructions threads read call a side-quest an
// errand (CHG-0449). Identifiers such as `sideQuest` stay, and so does the stored reference `#side-quest:<id>` with its
// kind "side-quest", which saved messages hold. Everything else in the sources must use the new word, comments included,
// so the old one does not come back unnoticed.
const sources = import.meta.glob(
  [
    "../../src/**/*.{ts,tsx}",
    "../../../../packages/contracts/src/**/*.{ts,tsx}",
    "../../../../packages/service/src/**/*.{ts,tsx}",
  ],
  { eager: true, import: "default", query: "?raw" },
);

/** The places the old word is allowed: the stored token, the quoted kind, and its pattern and code spans. */
const allowed = [
  /[@#]side-quest:/g,
  /"side-quest"/g,
  /'side-quest'/g,
  /`side-quest`/g,
  /\(quest\|side-quest\|realm\)/g,
  /\(\?:quest\|side-quest\|(?:errand\|)?realm\)/g,
];

describe("the words for a thread beneath another", () => {
  it("reads the sources it guards", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(200);
  });

  it("says errand, never side-quest, outside the stored mention token and its kind", () => {
    const offenders = Object.entries(sources)
      .filter(([, text]) => /side[- ]quest/i.test(allowed.reduce((left, pattern) => left.replace(pattern, ""), text)))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it("still holds the stored token the sweep must not touch", () => {
    const text = Object.entries(sources).find(([path]) => path.endsWith("contracts/src/marks.ts"))?.[1] ?? "";
    expect(text).toContain("#side-quest:");
    expect(text).toContain('"side-quest"');
  });
});
