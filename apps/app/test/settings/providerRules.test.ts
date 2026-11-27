import { describe, expect, it } from "vitest";
import {
  canAddAccount,
  canSubmitNewKeyAccount,
  canSubmitReplacementKey,
  isModelListRequired,
  keyAccountLabelOf,
  keyProvidersOf,
  modelsPlaceholderOf,
  namedModelsOf,
  versionOf,
} from "../../src/settings/providerRules";

describe("reading a harness version label", () => {
  it("extracts a version while retaining its prefix and release suffixes", () => {
    expect(versionOf({ version: "Claude Code 2.1.325" })).toBe("2.1.325");
    expect(versionOf({ version: "OpenCode v2.2.0-beta.1+local" })).toBe("v2.2.0-beta.1+local");
  });

  it("retains an unrecognized report or a missing version", () => {
    expect(versionOf({ version: "development" })).toBe("development");
    expect(versionOf({ version: null })).toBeNull();
  });
});

describe("offering added accounts on a harness card", () => {
  it("hides Add account on a harness whose host says it takes only the computer's sign-in", () => {
    expect(canAddAccount({ supportsAddedAccounts: false })).toBe(false);
  });

  it("offers Add account when the host says so, and when an older host says nothing", () => {
    expect(canAddAccount({ supportsAddedAccounts: true })).toBe(true);
    expect(canAddAccount({})).toBe(true);
  });
});

describe("API key account form rules", () => {
  it("lists key providers for Claude Code and none for other harnesses", () => {
    expect(keyProvidersOf("claude")).toEqual(["anthropic", "deepseek", "kimi", "minimax", "openrouter", "qwen", "zai"]);
    expect(keyProvidersOf("codex")).toEqual([]);
  });

  it("splits comma- and newline-separated model names and drops blanks", () => {
    expect(namedModelsOf("glm-5.4, glm-5.3-flash\n , deepseek-v4-pro ")).toEqual([
      "glm-5.4",
      "glm-5.3-flash",
      "deepseek-v4-pro",
    ]);
    expect(namedModelsOf(" , \n ")).toEqual([]);
  });

  it("requires named models only for providers with no defaults", () => {
    expect(isModelListRequired("openrouter")).toBe(true);
    expect(isModelListRequired("zai")).toBe(false);
  });

  it("falls back to the provider label when the account name is blank", () => {
    expect(keyAccountLabelOf("zai", "   ")).toBe("Z.ai");
    expect(keyAccountLabelOf("zai", "Team Z.ai")).toBe("Team Z.ai");
  });

  it("shows default model ids in the placeholder when the provider has defaults", () => {
    expect(modelsPlaceholderOf("openrouter")).toBe("Model names, separated by commas");
    expect(modelsPlaceholderOf("zai")).toBe("Model names, separated by commas (blank: glm-5.4, glm-5.3-flash)");
  });

  it("gates submission on busy state, a key, and required models", () => {
    expect(canSubmitNewKeyAccount({ isBusy: false, key: "sk-1", models: "", provider: "zai" })).toBe(true);
    expect(canSubmitNewKeyAccount({ isBusy: true, key: "sk-1", models: "", provider: "zai" })).toBe(false);
    expect(canSubmitNewKeyAccount({ isBusy: false, key: "", models: "", provider: "zai" })).toBe(false);
    expect(canSubmitNewKeyAccount({ isBusy: false, key: "sk-1", models: "", provider: "openrouter" })).toBe(false);
    expect(canSubmitNewKeyAccount({ isBusy: false, key: "sk-1", models: "model-a", provider: "openrouter" })).toBe(
      true,
    );
    expect(canSubmitReplacementKey({ isBusy: false, key: "sk-2" })).toBe(true);
    expect(canSubmitReplacementKey({ isBusy: false, key: "" })).toBe(false);
    expect(canSubmitReplacementKey({ isBusy: true, key: "sk-2" })).toBe(false);
  });
});
