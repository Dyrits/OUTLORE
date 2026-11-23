import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  listMuseModels,
  museModelOptionsOf,
  museModelSelectionOf,
  readMuseSignIn,
} from "../../src/harness/museAccount.ts";

// Checks of Muse's catalog and sign-in helpers against its stand-in, museProviderFake.mjs: model ids are
// qualified with their provider so `session/setModel` routes by `providerId` beside `modelId`, and the
// sign-in reads Unknown until a live check verifies a surface (a terminal `muse login`, or experimental
// account/read) — a cached catalog never proves authentication.

const fixture = join(import.meta.dirname, "../fixtures/museProviderFake.mjs");

const catalogRow = (fields: Record<string, unknown>) =>
  ({
    contextLimit: 1000,
    cost: null,
    description: null,
    displayLabel: "Muse One",
    isActive: false,
    isDefault: false,
    modelId: "muse-one",
    outputLimit: null,
    profileId: null,
    providerId: "fake-lab",
    releaseDate: "2026-11-01",
    variants: ["low", "medium", "high"],
    ...fields,
  }) as unknown;

describe("Muse's model catalog", () => {
  it("qualifies each row with its provider and its effort set", () => {
    expect(
      museModelOptionsOf({
        models: [catalogRow({ isActive: true, isDefault: true }), catalogRow({ modelId: "muse-two", variants: [] })],
        profileId: null,
        providerId: "fake-lab",
        source: "fakeCatalog",
      }),
    ).toEqual([
      { efforts: ["low", "medium", "high"], id: "fake-lab/muse-one", label: "Muse One" },
      { efforts: [], id: "fake-lab/muse-two", label: "Muse One" },
    ]);
    // Nothing is listed from a malformed answer.
    expect(museModelOptionsOf({ models: "nope" })).toEqual([]);
    expect(museModelOptionsOf(null)).toEqual([]);
  });

  it("splits a qualified id back into the provider and the model it names", () => {
    expect(museModelSelectionOf("default")).toBeNull();
    expect(museModelSelectionOf("muse-one")).toBeNull();
    expect(museModelSelectionOf("fake-lab/muse-one")).toEqual({ modelId: "muse-one", providerId: "fake-lab" });
    // An encoded slash in the provider part is not a separator.
    expect(museModelSelectionOf("deepseek%2Fx/muse-one")).toEqual({
      modelId: "muse-one",
      providerId: "deepseek/x",
    });
  });

  it.live("lists the models a short-lived host answers with", () =>
    Effect.gen(function* () {
      const listed = yield* listMuseModels(process.execPath, [fixture, "basic"]);
      expect(listed.map((model) => [model.id, model.label])).toEqual([
        ["fake-lab/muse-one", "Muse One"],
        ["fake-lab/muse-two", "Muse Two"],
      ]);
      expect(listed[0]?.efforts).toEqual(["low", "medium", "high"]);
    }).pipe(Effect.timeout("30 seconds")),
  );

  it("reads the sign-in as Unknown, honestly, until a surface is verified live", () => {
    return Effect.gen(function* () {
      const status = yield* readMuseSignIn();
      expect(status).toEqual({ detail: null, signIn: "Unknown" });
    });
  });
});
