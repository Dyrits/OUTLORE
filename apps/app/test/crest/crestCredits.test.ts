import { describe, expect, it } from "vitest";
import credits from "../../src/crest/crest-credits.md?raw";
import { crestCharges } from "../../src/crest/crestCharges";

/** Each credit line reads `- Name (icon-slug) by Author: <url>`; the name is the one the charge shows. */
const creditedNames = [
  ...credits.matchAll(/^- (.+?) \(([a-z-]+)\) by (.+?): <(https:\/\/game-icons\.net\/[^>]+)>$/gm),
].map((line) => line[1]);

describe("crediting the heraldic artwork", () => {
  it("credits every bundled figure once, by the name it carries", () => {
    const chargeNames = Object.values(crestCharges).map((charge) => charge.name);
    expect(creditedNames.toSorted()).toEqual(chargeNames.toSorted());
  });

  it("names the license the figures are used under", () => {
    expect(credits).toContain("https://creativecommons.org/licenses/by/3.0/");
  });
});
