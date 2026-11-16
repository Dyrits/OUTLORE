import { encodeBase64Url } from "@outlore/channel/base64url";
import { describe, expect, it } from "vitest";
import { claimProtocolOf, legacyClaimUntil, parseConnect, relayProtocol } from "../src/route.ts";

const room = "abcdefghijklmnop";
const claim = Uint8Array.from({ length: 24 }, (_, index) => index + 1);
const offered = (value: Uint8Array) => `${relayProtocol}, ${claimProtocolOf(value)}`;

describe("a host's claim", () => {
  it("accepts only a canonical base64url claim in the query, while the legacy path is open", () => {
    const path = `/r/${room}?role=host&claim=`;
    expect(parseConnect(`${path}AAAAAAAAAAAAAAAAAAAAAA`, null, true)?.claim).toEqual(new Uint8Array(16));
    expect(parseConnect(`${path}AAAAAAAAAAAAAAAAAAAAAB`, null, true)).toBeNull();
  });

  it("is read from the offered subprotocols, and the address carries no claim", () => {
    const connect = parseConnect(`/r/${room}?role=host`, offered(claim), false);
    expect(connect).toEqual({ claim, isLegacyClaim: false, role: "host", room });
    expect(claimProtocolOf(claim)).toBe(`outlore.claim.${encodeBase64Url(claim)}`);
  });

  it("is refused when the subprotocol claim is not canonical, too short, or absent", () => {
    const url = `/r/${room}?role=host`;
    expect(parseConnect(url, `${relayProtocol}, outlore.claim.AAAAAAAAAAAAAAAAAAAAAB`, false)).toBeNull();
    expect(parseConnect(url, offered(new Uint8Array(15)), false)).toBeNull();
    expect(parseConnect(url, relayProtocol, false)).toBeNull();
    expect(parseConnect(url, null, false)).toBeNull();
  });

  it("is taken from the subprotocol when both are given, and the host is not marked legacy", () => {
    const connect = parseConnect(`/r/${room}?role=host&claim=AAAAAAAAAAAAAAAAAAAAAA`, offered(claim), true);
    expect(connect?.claim).toEqual(claim);
    expect(connect?.isLegacyClaim).toBe(false);
  });

  it("in the query is marked legacy, and refused once the legacy path is closed", () => {
    const url = `/r/${room}?role=host&claim=AAAAAAAAAAAAAAAAAAAAAA`;
    expect(parseConnect(url, null, true)?.isLegacyClaim).toBe(true);
    expect(parseConnect(url, null, false)).toBeNull();
    expect(parseConnect(url, relayProtocol, false)).toBeNull();
  });

  it("is not read for a client, whatever it offers", () => {
    expect(parseConnect(`/r/${room}?role=client`, offered(claim), false)).toEqual({
      claim: null,
      isLegacyClaim: false,
      role: "client",
      room,
    });
  });
});

describe("the transition for the claim in the address", () => {
  it("ends on a stated date, which is the one marker to find when the legacy path goes", () => {
    expect(new Date(legacyClaimUntil).toISOString()).toBe("2027-02-01T00:00:00.000Z");
  });
});
