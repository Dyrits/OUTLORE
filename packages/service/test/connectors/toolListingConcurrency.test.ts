import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { ConnectorBackends, VaultPort } from "../../src/connectors/index.ts";
import { makeToolListing } from "../../src/connectors/toolListing.ts";
import { calendarEntry, fakeBackendOf, fakeVault } from "../fixtures/connectorBackend.ts";

describe("opening a connector backend", () => {
  it.live("opens and owns one backend when two callers arrive together", () => {
    const fake = fakeBackendOf([], []);
    let opens = 0;
    const backends = ConnectorBackends.of({
      open: () =>
        Effect.sleep("50 millis").pipe(
          Effect.map(() => {
            opens++;
            return fake.backend;
          }),
        ),
    });
    return Effect.gen(function* () {
      const vault = yield* VaultPort;
      const listing = makeToolListing({ backends, vault });
      yield* Effect.all([listing.openBackend(calendarEntry), listing.openBackend(calendarEntry)], {
        concurrency: "unbounded",
      });
      expect(opens).toBe(1);
      yield* listing.forget(calendarEntry.id);
      expect(fake.state.closes).toBe(1);
    }).pipe(Effect.provide(fakeVault().layer));
  });
});
