import { describe, expect, it } from "vitest";
import {
  companionReferenceOf,
  companionTokenOf,
  companionTokensOf,
  maxCompanionMentions,
  withoutCompanionTokens,
} from "../src/index.ts";

describe("the token of a Companion mention", () => {
  it("writes harness, account and model as one word, a dash for the harness's own sign-in", () => {
    expect(companionTokenOf({ accountId: null, harness: "claude", model: "claude-opus-5-5" })).toBe(
      "@companion:claude:-:claude-opus-5-5",
    );
    expect(companionTokenOf({ accountId: "a1-b2", harness: "codex", model: "gpt-6.1-sol" })).toBe(
      "@companion:codex:a1-b2:gpt-6%2E1-sol",
    );
  });

  it("writes a model with spaces, slashes and other characters so punctuation never joins it", () => {
    const token = companionTokenOf({ accountId: null, harness: "opencode", model: "openrouter/zai glm:5.4!" });
    expect(token).toMatch(/^@companion:opencode:-:[A-Za-z0-9_%-]+$/);
    expect(companionTokensOf(`hi ${token}, thanks`)[0]).toMatchObject({ model: "openrouter/zai glm:5.4!" });
  });

  it("reads back what it wrote", () => {
    const reference = { accountId: "acc-9", harness: "vibe", model: "mistral-large-3" };
    expect(companionReferenceOf(companionTokenOf(reference).slice(1))).toEqual(reference);
  });

  it("reads a word that names no Companion as nothing", () => {
    expect(companionReferenceOf("quest:q1")).toBeNull();
    expect(companionReferenceOf("companion:claude:-")).toBeNull();
    expect(companionReferenceOf("companion:claude:-:%E0%A4%A")).toBeNull();
  });
});

describe("the Companions a message names", () => {
  it("lists them in the order written, each once, with their place in the text", () => {
    const first = companionTokenOf({ accountId: null, harness: "claude", model: "a" });
    const second = companionTokenOf({ accountId: null, harness: "codex", model: "b" });
    const text = `${first} and ${second} and ${first}`;
    expect(companionTokensOf(text).map((token) => [token.harness, token.model, token.start])).toEqual([
      ["claude", "a", 0],
      ["codex", "b", first.length + 5],
    ]);
  });

  it("keeps no more than the most that may answer one message", () => {
    const text = Array.from({ length: maxCompanionMentions + 2 }, (_, index) =>
      companionTokenOf({ accountId: null, harness: "claude", model: `m${index}` }),
    ).join(" ");
    expect(companionTokensOf(text)).toHaveLength(maxCompanionMentions);
  });

  it("takes the tokens out of the words the model answers", () => {
    const token = companionTokenOf({ accountId: null, harness: "claude", model: "m" });
    expect(withoutCompanionTokens(`${token} what is   this? ${token}`)).toBe("what is this?");
    expect(withoutCompanionTokens("no mention")).toBe("no mention");
  });
});
