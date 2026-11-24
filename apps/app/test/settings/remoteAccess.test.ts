import type { PairedDevice } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import {
  agoOf,
  cloudflareTokensUrl,
  codeLifeOf,
  deviceLineOf,
  ownRelayNoticeOf,
  pairingHelp,
  pairingSecrecyNotice,
  relayLineOf,
  relayStatusTextOf,
  webAppLineOf,
} from "../../src/settings/remoteAccess";

const device = (change: Partial<PairedDevice>) =>
  ({
    id: "d",
    isConnected: false,
    isDirect: false,
    kind: "desktop",
    lastActiveAt: null,
    name: "Laptop",
    pairedAt: 0,
    ...change,
  }) as PairedDevice;

describe("Charter's remote access wording", () => {
  it("says the host is unreachable by anyone while it is off, whatever the relay says", () => {
    expect(relayStatusTextOf("Connected", false)).toContain("Off");
    expect(relayStatusTextOf("Connected", true)).toContain("any network");
    expect(relayStatusTextOf("Unreachable", true)).toContain("cannot be reached");
    expect(relayStatusTextOf("Connecting", true)).toContain("Connecting");
  });

  it("says how long ago in the largest whole unit", () => {
    const now = 10 * 24 * 3_600_000;
    expect(agoOf(now - 20_000, now)).toBe("just now");
    expect(agoOf(now - 5 * 60_000, now)).toBe("5 min ago");
    expect(agoOf(now - 3 * 3_600_000, now)).toBe("3 h ago");
    expect(agoOf(now - 3 * 24 * 3_600_000, now)).toBe("3 days ago");
  });

  it("describes a device by kind, and by connection or last activity", () => {
    const now = 1_000_000;
    expect(deviceLineOf(device({ isConnected: true }), now)).toBe("Desktop · connected now");
    expect(deviceLineOf(device({ isConnected: true, isDirect: true }), now)).toBe("Desktop · connected now, direct");
    // A device that is not connected is never direct, whatever was last known.
    expect(deviceLineOf(device({ isDirect: true }), now)).toBe("Desktop · never connected");
    expect(deviceLineOf(device({ kind: "phone" }), now)).toBe("Phone · never connected");
    expect(deviceLineOf(device({ lastActiveAt: now - 120_000 }), now)).toBe("Desktop · last active 2 min ago");
  });

  it("counts a pairing code's remaining minutes and says when it has expired", () => {
    expect(codeLifeOf(10 * 60_000, 0)).toBe("Works once and expires in 10 min.");
    expect(codeLifeOf(60_000, 1_000)).toBe("Works once and expires in 1 min.");
    expect(codeLifeOf(60_000, 60_000)).toContain("expired");
  });
});

describe("Charter's relay wording", () => {
  it("names the shared relay by default, and the owner's own address once chosen", () => {
    expect(relayLineOf({ isOwnRelay: false, relayOrigin: "https://outlore-relay.dyrits.workers.dev" })).toMatch(
      /^Shared relay/,
    );
    expect(relayLineOf({ isOwnRelay: true, relayOrigin: "https://outlore-relay.me.workers.dev" })).toBe(
      "Your own relay, on your Cloudflare account: outlore-relay.me.workers.dev",
    );
  });

  it("says where the web app opens, and that an own relay does not serve it", () => {
    const webAppUrl = "https://outlore.dyrits.workers.dev";
    expect(webAppLineOf({ isOwnRelay: false, webAppUrl })).toBe(
      "Web app: https://outlore.dyrits.workers.dev. Open it in any browser and paste a pairing code or link.",
    );
    expect(webAppLineOf({ isOwnRelay: true, webAppUrl })).toBe(
      "Web app: https://outlore.dyrits.workers.dev. Open it in any browser and paste a pairing code or link. It is served by the shared relay, not by your own.",
    );
  });

  it("tells how to use the QR code, the links and the code, and that a link is as secret as the code", () => {
    expect(pairingHelp).toContain("Scan the code with a phone camera");
    expect(pairingHelp).toContain("Add a host");
    expect(pairingSecrecyNotice).toMatch(/anyone with (this|the) link or code can pair/i);
    expect(pairingSecrecyNotice).toContain("until it expires");
  });

  it("falls back to the whole address when it cannot be read as one", () => {
    expect(relayLineOf({ isOwnRelay: true, relayOrigin: "not a url" })).toContain("not a url");
  });

  it("tells what the deployment does and keeps, and how many paired devices will have to pair again", () => {
    const none = ownRelayNoticeOf(0);
    expect(none).toContain("once");
    expect(none).toContain("does not keep it");
    expect(none).not.toContain("pair again");
    expect(ownRelayNoticeOf(1)).toContain("1 paired device will have to pair again");
    expect(ownRelayNoticeOf(3)).toContain("3 paired devices will have to pair again");
  });

  it("sends the owner to Cloudflare's own token page", () => {
    expect(cloudflareTokensUrl).toBe("https://dash.cloudflare.com/profile/api-tokens");
  });
});
