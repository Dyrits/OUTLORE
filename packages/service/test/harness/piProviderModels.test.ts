import { join } from "node:path";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { piModelPartsOf, piModelsOf } from "../../src/harness/pi.ts";
import { probePiModels } from "../../src/harness/piRpc.ts";

describe("listing Pi provider models", () => {
  it("keeps Pi's providers and filters dedicated providers without changing their model ids", () => {
    const models = [
      { id: "deepseek-chat", name: "DeepSeek Chat", provider: "deepseek" },
      { id: "anthropic/claude", name: "Claude", provider: "openrouter" },
      { id: "mercury", name: "Mercury", provider: "inception" },
      { name: "Missing id", provider: "broken" },
    ];
    expect(piModelsOf(models, "pi")).toHaveLength(3);
    expect(piModelsOf(models, "openrouter")).toEqual([{ efforts: [], id: "anthropic/claude", label: "Claude" }]);
    expect(piModelsOf(models, "inception").map((model) => model.id)).toEqual(["mercury"]);
    expect(piModelsOf(models, "deepseek").map((model) => model.id)).toEqual(["deepseek-chat"]);
  });
  it("qualifies generic picker ids by provider", () => {
    expect(
      piModelsOf(
        [
          { id: "same", provider: "a" },
          { id: "same", provider: "b" },
        ],
        "pi",
      ).map((model) => model.id),
    ).toEqual(["a/same", "b/same"]);
  });
  it("splits a qualified picker id back into provider and model id", () => {
    expect(piModelPartsOf("openrouter/anthropic/claude")).toEqual({
      model: "anthropic/claude",
      provider: "openrouter",
    });
    expect(piModelPartsOf("same")).toBeNull();
    const [qualified] = piModelsOf([{ id: "same", provider: "a/b" }], "pi");
    expect(piModelPartsOf(qualified?.id ?? "")).toEqual({ model: "same", provider: "a/b" });
  });
  it("reads models from an isolated RPC process", async () => {
    const models = await Effect.runPromise(
      probePiModels({
        command: process.execPath,
        prefixArgs: [join(import.meta.dirname, "../fixtures/piProviderFake.mjs")],
        provider: "pi",
      }),
    );
    expect(models.map((model) => model.id)).toEqual(["deepseek/same", "openrouter/same"]);
  });
  it("ends an unresponsive probe at its deadline", async () => {
    await expect(
      Effect.runPromise(
        probePiModels({
          command: process.execPath,
          prefixArgs: [join(import.meta.dirname, "../fixtures/piProviderFake.mjs"), "hang"],
          provider: "pi",
          timeoutMillis: 100,
        }),
      ),
    ).rejects.toThrow();
  });
  it("fails when the probe command cannot start", async () => {
    await expect(
      Effect.runPromise(probePiModels({ command: "/nonexistent/outlore-pi-probe", provider: "pi" })),
    ).rejects.toThrow();
  });
});
