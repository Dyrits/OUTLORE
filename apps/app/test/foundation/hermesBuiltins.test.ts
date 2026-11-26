import { describe, expect, it } from "vitest";

// The phone app runs on Hermes, whose Array has toReversed and toSpliced but no toSorted (read from the engine's own
// builtin table in libhermesvm.so of the 0.1.7-Prototype APK). TypeScript's library knows toSorted, so the typecheck
// passes and the app only throws "undefined is not a function" when the code runs, which crashed it once a pairing
// connected. Only code the phone bundles is checked: this app and the packages it imports.
const sources = import.meta.glob(
  [
    "../../src/**/*.{ts,tsx}",
    "../../../../packages/channel/src/**/*.{ts,tsx}",
    "../../../../packages/contracts/src/**/*.{ts,tsx}",
    "../../../../packages/controller/src/**/*.{ts,tsx}",
  ],
  { eager: true, import: "default", query: "?raw" },
);

describe("the code the phone app runs", () => {
  it("reads the sources it guards", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50);
  });

  it("does not call Array.prototype.toSorted, which Hermes lacks", () => {
    const callers = Object.entries(sources)
      .filter(([, text]) => /\.toSorted\(/.test(text.replace(/\/\/.*$/gm, "")))
      .map(([path]) => path);
    expect(callers).toEqual([]);
  });
});
