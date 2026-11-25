import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { modelsDevSourceLayer, PriceSource, priceOf, rowsOfModelsDev } from "../../src/core/index.ts";

const row = (provider: string, model: string, input = 1) => ({
  cacheRead: null,
  cacheWrite: null,
  input,
  model,
  output: 2,
  provider,
});

describe("matching a model to its price", () => {
  const rows = [
    row("anthropic", "claude-sonnet-5-5", 2),
    row("opencode", "claude-sonnet-5-5", 9),
    row("anthropic", "claude-opus-5-5", 4),
    row("google", "gemini-4-carbon", 2),
    row("google", "gemini-3.8-flash", 0.75),
    row("openai", "gpt-5.1-codex", 1.07),
    row("openai", "gpt-5.1-codex-max", 1.25),
    row("openai", "gpt-5.5", 5),
    row("anthropic", "claude-haiku-4-5", 1),
  ];

  it("finds a model by its exact name, the first-party provider first", () => {
    expect(priceOf(rows, "claude-sonnet-5-5")).toMatchObject({ input: 2, provider: "anthropic" });
  });

  it("takes a provider prefix as the provider", () => {
    expect(priceOf(rows, "opencode/claude-sonnet-5-5")).toMatchObject({ input: 9 });
    expect(priceOf(rows, "anthropic/claude-sonnet-5-5")).toMatchObject({ input: 2 });
  });

  it("matches a model released under a dated name to its undated price", () => {
    expect(priceOf(rows, "claude-haiku-4-5-20251001")).toMatchObject({ model: "claude-haiku-4-5" });
    expect(priceOf(rows, "claude-haiku-4-5-2025-10-01")).toMatchObject({ model: "claude-haiku-4-5" });
  });

  it("matches an effort-suffixed model name to its base model price", () => {
    expect(priceOf(rows, "gemini-4-carbon-high")).toMatchObject({ model: "gemini-4-carbon", provider: "google" });
    expect(priceOf(rows, "gemini-3.8-flash-medium")).toMatchObject({ model: "gemini-3.8-flash", provider: "google" });
    expect(priceOf(rows, "claude-sonnet-5-5-high")).toMatchObject({
      model: "claude-sonnet-5-5",
      provider: "anthropic",
    });
    expect(priceOf(rows, "claude-opus-5-5-medium")).toMatchObject({ model: "claude-opus-5-5", provider: "anthropic" });
    expect(priceOf(rows, "gpt-5.5-xhigh")).toMatchObject({ model: "gpt-5.5", provider: "openai" });
    expect(priceOf(rows, "gemini-4-carbon-low")).toMatchObject({ model: "gemini-4-carbon", provider: "google" });
  });

  it("prefers an exact model name over stripping an effort suffix", () => {
    expect(priceOf(rows, "gpt-5.1-codex-max")).toMatchObject({
      input: 1.25,
      model: "gpt-5.1-codex-max",
      provider: "openai",
    });
  });

  it("matches a provider-prefixed effort-suffixed model name to that provider's base model", () => {
    expect(priceOf(rows, "google/gemini-4-carbon-high")).toMatchObject({
      model: "gemini-4-carbon",
      provider: "google",
    });
    expect(priceOf(rows, "opencode/claude-sonnet-5-5-high")).toMatchObject({
      input: 9,
      model: "claude-sonnet-5-5",
      provider: "opencode",
    });
    expect(priceOf(rows, "mistral/gemini-4-carbon-high")).toBeNull();
  });

  it("matches a model carrying both a release date and an effort suffix", () => {
    expect(priceOf(rows, "claude-haiku-4-5-20251001-high")).toMatchObject({
      model: "claude-haiku-4-5",
      provider: "anthropic",
    });
    expect(priceOf(rows, "claude-haiku-4-5-2025-10-01-medium")).toMatchObject({
      model: "claude-haiku-4-5",
      provider: "anthropic",
    });
  });

  it("finds nothing for a model it does not know, never a nearest guess", () => {
    expect(priceOf(rows, "claude-sonnet-9")).toBeNull();
    expect(priceOf(rows, "mistral/claude-sonnet-5-5")).toBeNull();
    expect(priceOf(rows, "gemini-4-neon-medium")).toBeNull();
    expect(priceOf(rows, "gpt-oss-120b-medium")).toBeNull();
  });
});

describe("reading the public price table", () => {
  const table = {
    anthropic: { models: { "claude-opus-5-5": { cost: { cache_read: 0.2, cache_write: 5, input: 4, output: 20 } } } },
    elsewhere: { models: { "other-model": { cost: { input: 1, output: 2 } } } },
    openai: {
      models: { free: { name: "no cost listed" }, "gpt-5.5": { cost: { cache_read: 0.5, input: 5, output: 30 } } },
    },
  };

  it("keeps the prices of the providers it follows, with a missing cache price as null", () => {
    expect(rowsOfModelsDev(table)).toEqual([
      { cacheRead: 0.2, cacheWrite: 5, input: 4, model: "claude-opus-5-5", output: 20, provider: "anthropic" },
      { cacheRead: 0.5, cacheWrite: null, input: 5, model: "gpt-5.5", output: 30, provider: "openai" },
    ]);
  });

  it.effect("sends a plain GET that carries nothing about the owner", () =>
    Effect.gen(function* () {
      const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
      const fake: typeof fetch = async (url, init) => {
        requests.push({ init, url: String(url) });
        return Response.json(table);
      };
      const rows = yield* Effect.gen(function* () {
        return yield* (yield* PriceSource).read;
      }).pipe(Effect.provide(modelsDevSourceLayer(fake)));
      expect(rows).toHaveLength(2);
      expect(requests).toHaveLength(1);
      expect(requests[0]?.url).toBe("https://models.dev/api.json");
      expect(requests[0]?.init?.method).toBe("GET");
      expect(requests[0]?.init?.body).toBeUndefined();
      expect(requests[0]?.init?.headers).toEqual({ accept: "application/json" });
    }),
  );

  it.effect("fails with a reason when the table answers with an error", () =>
    Effect.gen(function* () {
      const failing: typeof fetch = async () => new Response("nope", { status: 503 });
      const failure = yield* Effect.gen(function* () {
        return yield* (yield* PriceSource).read;
      }).pipe(Effect.provide(modelsDevSourceLayer(failing)), Effect.flip);
      expect(failure.reason).toContain("503");
    }),
  );
});
