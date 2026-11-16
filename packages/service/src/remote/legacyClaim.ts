import { legacyClaimUntil } from "@outlore/relay";
import { defaultRelayOrigin } from "./config.ts";

/** How many attempts in a row a relay must turn away, in the claim's new form, before the old form is tried. */
export const failuresBeforeFallback = 2;

/** The origin of a relay address as one key, or null when it is not an address. */
export const originKey = (address: string): string | null => (URL.canParse(address) ? new URL(address).origin : null);

/**
 * Whether a host may put its claim in the address of a relay (SP-H-09, the transition that ends at
 * `legacyClaimUntil`). The address is what access logs and proxies record, so it is a last resort for a relay of an
 * earlier release (one the owner deployed and has not redeployed) and never for a failure that can be anything else:
 * a blip, a 429 or an unreachable relay. It is allowed only when the relay has turned the new form away
 * `failuresBeforeFallback` times in a row, has never taken it, is not the shared relay (deployed before any host
 * release), and the transition has not ended.
 */
export const mayFallBackToLegacyClaim = (state: {
  /** The relays that have taken the claim in the new form since this host started. */
  readonly acceptedOrigins: ReadonlySet<string>;
  /** How many attempts in a row this relay has turned away in the new form. */
  readonly failures: number;
  readonly now: number;
  readonly origin: string;
}): boolean => {
  const origin = originKey(state.origin);
  return (
    state.now < legacyClaimUntil &&
    origin !== null &&
    origin !== originKey(defaultRelayOrigin) &&
    !state.acceptedOrigins.has(origin) &&
    state.failures >= failuresBeforeFallback
  );
};
