import { decodeBase64Url, encodeBase64Url } from "@outlore/channel/base64url";

/** Which side of a room a connection plays. */
export type Role = "client" | "host";

/** What a valid connection URL asks for. */
export type Connect = {
  /** The decoded host claim secret; always null for a client, whose claim is not read. */
  readonly claim: Uint8Array | null;
  /** Whether the host sent its claim in the address, as hosts and relays of earlier releases do. */
  readonly isLegacyClaim: boolean;
  readonly role: Role;
  readonly room: string;
};

/** The WebSocket subprotocol the relay speaks; a client offers it and the relay selects it. */
export const relayProtocol = "outlore.v1";

const claimProtocolPrefix = "outlore.claim.";

/**
 * The subprotocol that carries a host's claim. It travels in the `Sec-WebSocket-Protocol` request header, which access
 * logs and proxies do not record as they do an address, and the relay never sends it back.
 */
export const claimProtocolOf = (claim: Uint8Array): string => `${claimProtocolPrefix}${encodeBase64Url(claim)}`;

/**
 * THE TRANSITION MARKER (SP-H-09). Until this instant a host may still send its claim in the address
 * (`?claim=`), so that hosts of earlier releases keep working against this relay, and a host of this release can
 * still reach a relay of an earlier release. From it on the relay refuses the address form. When it has passed in
 * every release in use, delete the legacy path: `allowLegacyClaim` here, `legacyFallback` in `client.ts`, and the
 * tests that name this constant.
 */
export const legacyClaimUntil = Date.parse("2027-02-01T00:00:00Z");

const roomPattern = /^[A-Za-z0-9_-]{16,64}$/;
const minimumClaimBytes = 16;

/** Whether the offered subprotocols include the relay's own. */
export const offersRelayProtocol = (protocols: string | null): boolean =>
  (protocols ?? "").split(",").some((protocol) => protocol.trim() === relayProtocol);

const claimOf = (bytes: Uint8Array | null): Uint8Array | null =>
  bytes !== null && bytes.length >= minimumClaimBytes ? bytes : null;

/**
 * Reads `/r/<room>?role=host` with the claim in the offered subprotocols (`protocols`, the request's
 * `Sec-WebSocket-Protocol` header) or `/r/<room>?role=client`; any other URL gives null so that the caller answers 404
 * and nothing about the relay is readable. While `allowLegacyClaim` is true, `/r/<room>?role=host&claim=<secret>` is
 * read too and marked as the legacy form (see `legacyClaimUntil`).
 */
export const parseConnect = (url: string, protocols: string | null, allowLegacyClaim: boolean): Connect | null => {
  const parsed = URL.canParse(url, "http://relay.invalid") ? new URL(url, "http://relay.invalid") : null;
  if (parsed === null) return null;
  const [, prefix, room, ...rest] = parsed.pathname.split("/");
  if (prefix !== "r" || room === void 0 || rest.length > 0 || !roomPattern.test(room)) return null;
  const role = parsed.searchParams.get("role");
  if (role === "client") return { claim: null, isLegacyClaim: false, role, room };
  if (role !== "host") return null;
  const offered = (protocols ?? "")
    .split(",")
    .map((protocol) => protocol.trim())
    .find((protocol) => protocol.startsWith(claimProtocolPrefix));
  if (offered !== void 0) {
    const claim = claimOf(decodeBase64Url(offered.slice(claimProtocolPrefix.length)));
    return claim === null ? null : { claim, isLegacyClaim: false, role, room };
  }
  if (!allowLegacyClaim) return null;
  const claim = claimOf(decodeBase64Url(parsed.searchParams.get("claim") ?? ""));
  return claim === null ? null : { claim, isLegacyClaim: true, role, room };
};
