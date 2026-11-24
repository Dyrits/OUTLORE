import {
  harnessLabels as contractHarnessLabels,
  harnessNames as contractHarnessNames,
  harnessCompanies,
} from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import { harnessNames, tabsOf } from "../../src/editors/accountModels";
import { companionLabelOf, harnessLabels } from "../../src/foundation/formatting";

describe("deriving app harness lists from contracts", () => {
  it("uses the contract harnessLabels and harnessNames directly without separate copies", () => {
    expect(harnessLabels).toBe(contractHarnessLabels);
    expect(harnessNames).toBe(contractHarnessNames);
  });

  it("derives companion fallback company labels and picker tab order from contracts", () => {
    for (const name of contractHarnessNames) {
      expect(companionLabelOf(name, "custom-unlisted-model", "default")).toBe(
        `${harnessCompanies[name]} - custom-unlisted-model`,
      );
    }
    expect(tabsOf(null, true, { accountId: null, harness: "claude" }).map((tab) => tab.harness)).toEqual(
      contractHarnessNames,
    );
  });
});
