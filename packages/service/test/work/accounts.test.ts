import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import type { Installation } from "../../src/harness/harnessTools.ts";
import { fakeHarnessToolsLayer, HarnessTools } from "../../src/index.ts";
import { call, fixture, register } from "../fixtures/service.ts";

/** A harness whose configured executable never runs, before and after an install that succeeds. */
const neverRunsLayer = Layer.effect(
  HarnessTools,
  Effect.gen(function* () {
    const fake = yield* HarnessTools;
    const broken: Installation = {
      problem: 'Claude Code was not found at "claude". Choose Install, or install it yourself and press Refresh.',
      version: null,
    };
    return HarnessTools.of({
      ...fake,
      inspect: () => Effect.succeed(broken),
      install: () => Effect.void,
    });
  }),
).pipe(Layer.provide(fakeHarnessToolsLayer()));

describe("installing a harness from the Workshop", () => {
  it.live(
    "reports the PATH or configured-path problem when an install finishes and the harness still cannot run",
    () => {
      const { layer } = register(fixture(neverRunsLayer));
      return Effect.gen(function* () {
        const failure = yield* Effect.flip(call({ _tag: "InstallHarness", harness: "claude" }));
        expect(failure.message).toContain("Installation finished, but");
        expect(failure.message).toContain('was not found at "claude"');
        expect(failure.message).toContain("Check your PATH or configured harness path, then press Refresh.");
      }).pipe(Effect.provide(layer));
    },
  );

  it.live("refuses to install a harness that is already installed", () => {
    const { layer } = register(fixture());
    return Effect.gen(function* () {
      const failure = yield* Effect.flip(call({ _tag: "InstallHarness", harness: "claude" }));
      expect(failure.message).toContain("Claude Code is already installed. Use Update instead.");
    }).pipe(Effect.provide(layer));
  });
});
