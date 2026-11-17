import { describe, expect, it } from "vitest";
import { advanceHostLink, hostStatusOf, initialHostLink } from "../../src/foundation/hostStatus";

const input = { failure: null, hasHosts: true, hostId: "host", isBrowser: true, link: null, name: "Studio" };
const link = { failure: null, hasConnected: true, hasGivenUp: false, needsPairing: false };

describe("presenting the selected host link", () => {
  it("requires pairing when a browser knows no host", () => {
    expect(hostStatusOf({ ...input, hasHosts: false })).toMatchObject({
      canPair: true,
      canUseComputer: false,
      kind: "pairing",
    });
  });
  it("names the remote host during the first connection", () => {
    expect(hostStatusOf(input)).toMatchObject({ kind: "connecting", message: "Connecting to Studio…" });
  });
  it("offers retry on the failed first attempt and keeps a previously opened host visible", () => {
    const failed = { ...link, failure: "Offline", hasConnected: false };
    expect(hostStatusOf({ ...input, link: failed })).toMatchObject({
      canRetry: true,
      isRetrying: true,
      kind: "connecting",
    });
    expect(hostStatusOf({ ...input, link: { ...failed, hasConnected: true } }).kind).toBe("content");
  });
  it("offers pairing after refusal instead of retrying revoked keys", () => {
    expect(
      hostStatusOf({ ...input, link: { ...link, failure: "Revoked", hasGivenUp: true, needsPairing: true } }),
    ).toMatchObject({ canPair: true, canRetry: false, isRetrying: false });
  });
  it("offers a desktop window its own computer when a remote host fails", () => {
    expect(hostStatusOf({ ...input, isBrowser: false, link: { ...link, failure: "Offline" } }).canUseComputer).toBe(
      true,
    );
    expect(hostStatusOf({ ...input, hostId: null, isBrowser: false }).canUseComputer).toBe(false);
  });
});

describe("advancing a host link", () => {
  it("counts failed attempts and resets their backoff after a received frame", () => {
    const failed = advanceHostLink(initialHostLink, { isFinal: false, isRefused: false, type: "close" });
    expect(failed.failures).toBe(1);
    const open = advanceHostLink(failed, { type: "open" });
    expect(open.hasConnected).toBe(true);
    expect(advanceHostLink(open, { type: "message" }).failures).toBe(0);
  });
  it("keeps cancelled or refused links ended despite late transport events", () => {
    for (const ended of [
      advanceHostLink(initialHostLink, { type: "end" }),
      advanceHostLink(initialHostLink, { isFinal: true, isRefused: true, type: "close" }),
    ]) {
      expect(advanceHostLink(ended, { type: "open" })).toBe(ended);
      expect(advanceHostLink(ended, { message: "late", type: "failure" })).toBe(ended);
    }
  });
});
