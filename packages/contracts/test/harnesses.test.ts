import { HarnessName, harnessCompanies, harnessDescriptors, harnessLabels, harnessNames } from "@outlore/contracts";
import { Record, Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("deriving harness identity lists from one definition", () => {
  it("gives every harness a unique contiguous display order, label, and company", () => {
    const entries = Object.entries(harnessDescriptors);
    const orders = entries.map(([, descriptor]) => descriptor.order).toSorted((current, next) => current - next);
    expect(orders).toEqual(entries.map((_, index) => index));
    for (const [, descriptor] of entries) {
      expect(descriptor.label.trim().length).toBeGreaterThan(0);
      expect(descriptor.company.trim().length).toBeGreaterThan(0);
    }
  });

  it("derives harnessNames, HarnessName literals, harnessLabels, and harnessCompanies from harnessDescriptors", () => {
    const expectedOrder = Record.keys(harnessDescriptors).toSorted(
      (current, next) => harnessDescriptors[current].order - harnessDescriptors[next].order,
    );
    expect(harnessNames).toEqual(expectedOrder);
    expect(HarnessName.literals).toEqual(harnessNames);
    for (const name of harnessNames) {
      expect(harnessLabels[name]).toBe(harnessDescriptors[name].label);
      expect(harnessCompanies[name]).toBe(harnessDescriptors[name].company);
      expect(Schema.decodeUnknownSync(HarnessName)(name)).toBe(name);
    }
    expect(() => Schema.decodeUnknownSync(HarnessName)("unknown-harness")).toThrow();
  });
});
