import { describe, expect, it } from "vitest";
import { isAffectedBy, queryTopics, Results } from "../src/index.ts";

// Every request that only reads is classified in `queryTopics`, so a new read cannot go unscoped unnoticed: adding one to
// the contract means deciding, in that table, which topics its answer follows.
describe("the reads' topics", () => {
  it("name requests that exist", () => {
    for (const tag of Object.keys(queryTopics)) expect(Object.keys(Results), tag).toContain(tag);
  });

  it("name every request that reads by its first word", () => {
    const named = Object.keys(queryTopics);
    const reads = Object.keys(Results).filter((tag) => /^(Read|List|Search|Browse|Find)/.test(tag));
    expect(reads.filter((tag) => !named.includes(tag))).toEqual([]);
  });

  it("do not name a request that writes", () => {
    for (const tag of Object.keys(queryTopics)) expect(tag, tag).toMatch(/^(Read|List|Search|Browse|Find)/);
  });
});

describe("whether a change may alter a read", () => {
  it("always does for a change without topics, and for a request that is not a query", () => {
    expect(isAffectedBy("ReadSettings", undefined)).toBe(true);
    expect(isAffectedBy("SendMessage", ["spend"])).toBe(true);
  });

  it("does only when a topic the read follows was touched", () => {
    expect(isAffectedBy("ReadThreadPanel", ["work"])).toBe(true);
    expect(isAffectedBy("ReadThreadPanel", ["spend"])).toBe(false);
    expect(isAffectedBy("ReadBudget", ["work", "spend"])).toBe(true);
    expect(isAffectedBy("ReadUsage", ["work"])).toBe(true);
  });

  it("never does for a read of what only an unscoped change alters", () => {
    for (const tag of ["ReadSettings", "ReadVault", "ListConnectors", "ListHosts", "ListHarnesses"] as const)
      expect(isAffectedBy(tag, ["work", "spend"]), tag).toBe(false);
  });
});
