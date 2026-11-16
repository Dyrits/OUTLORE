import { legacyClaimUntil } from "@outlore/relay";
import { describe, expect, it } from "vitest";
import { defaultRelayOrigin } from "../../src/remote/config.ts";
import { mayFallBackToLegacyClaim } from "../../src/remote/legacyClaim.ts";

// When a host may put its claim in the address of a relay (SP-H-09): only for a relay that has never taken it in a
// subprotocol, that is not the shared relay, after two attempts in a row were turned away, and before the transition
// ends. Every other failure (a blip, a 429, an unreachable relay) must not put the claim in an address.

const own = "https://relay.example.workers.dev";
const ready = { acceptedOrigins: new Set<string>(), failures: 2, now: 0, origin: own };

describe("falling back to the claim in the address", () => {
  it("is allowed for an own relay that turned two attempts in a row away, before the transition ends", () => {
    expect(mayFallBackToLegacyClaim(ready)).toBe(true);
  });

  it("is not allowed after one failed attempt, or none", () => {
    expect(mayFallBackToLegacyClaim({ ...ready, failures: 1 })).toBe(false);
    expect(mayFallBackToLegacyClaim({ ...ready, failures: 0 })).toBe(false);
  });

  it("is not allowed for a relay that has taken the claim in a subprotocol", () => {
    expect(mayFallBackToLegacyClaim({ ...ready, acceptedOrigins: new Set([own]) })).toBe(false);
  });

  it("is not allowed for the shared relay, which is deployed before any host release, however it is written", () => {
    for (const origin of [defaultRelayOrigin, `${defaultRelayOrigin}/`, defaultRelayOrigin.toUpperCase()])
      expect(mayFallBackToLegacyClaim({ ...ready, origin })).toBe(false);
  });

  it("is not allowed from the end of the transition on", () => {
    expect(mayFallBackToLegacyClaim({ ...ready, now: legacyClaimUntil - 1 })).toBe(true);
    expect(mayFallBackToLegacyClaim({ ...ready, now: legacyClaimUntil })).toBe(false);
  });

  it("is not allowed for an address that is not an origin", () => {
    expect(mayFallBackToLegacyClaim({ ...ready, origin: "not a url" })).toBe(false);
  });
});
