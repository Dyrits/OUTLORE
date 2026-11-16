import { describe, expect, it } from "vitest";
import { type RetriedTest, summaryOf, warningOf } from "./retriedReporter.ts";

const retried: RetriedTest = { file: "packages/a/test/x.test.ts", name: "a > b", retries: 1, state: "passed" };

describe("the retried-tests report", () => {
  it("says nothing when no test needed a retry", () => {
    expect(summaryOf([])).toBe("");
  });

  it("lists each test that needed a retry, with its file, how many retries and how it ended", () => {
    const summary = summaryOf([retried, { ...retried, name: "c", retries: 2, state: "failed" }]);
    expect(summary).toContain("2 tests needed a retry");
    expect(summary).toContain("packages/a/test/x.test.ts > a > b: 1 retry, passed");
    expect(summary).toContain("packages/a/test/x.test.ts > c: 2 retries, failed");
  });

  it("makes one GitHub warning line per test, with its text on a single line", () => {
    expect(warningOf(retried)).toBe(
      "::warning file=packages/a/test/x.test.ts,title=Test needed a retry::a > b: 1 retry, passed",
    );
  });
});
