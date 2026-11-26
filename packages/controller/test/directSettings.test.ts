import { afterEach, describe, expect, it } from "vitest";
import { directSettingsOfLoader, directSettingsOfPage } from "../src/browserLink.ts";

// Where a direct channel's WebRTC comes from: the page's own `RTCPeerConnection`, or a library the platform loads (the
// phone app's native module). A stand-in class records how it was made, so nothing here opens a real connection.

const stunServers = ["stun:stun.example.invalid:3478"];

type RecordedConnection = { readonly configuration: unknown; readonly label: string; readonly options: unknown };

/** A stand-in connection class that notes each construction and each data channel asked of it. */
const standInClassOf = (made: RecordedConnection[]) =>
  class StandInConnection {
    readonly configuration: unknown;
    readonly connectionState = "new";
    readonly iceGatheringState = "new";
    readonly localDescription = null;

    constructor(configuration: unknown) {
      this.configuration = configuration;
    }

    addEventListener() {}
    close() {}
    async createAnswer() {
      return { sdp: "answer", type: "answer" };
    }
    createDataChannel(label: string, options: unknown) {
      made.push({ configuration: this.configuration, label, options });
      return {
        addEventListener() {},
        binaryType: "blob",
        bufferedAmount: 0,
        bufferedAmountLowThreshold: 0,
        close() {},
        onclose: null,
        onerror: null,
        onmessage: null,
        onopen: null,
        readyState: "connecting",
        send() {},
      };
    }
    async createOffer() {
      return { sdp: "offer", type: "offer" };
    }
    async setLocalDescription() {}
    async setRemoteDescription() {}
  };

describe("direct channels through a loaded WebRTC class", () => {
  it("makes a connection of the loaded class with the STUN servers and the agreed data channel", async () => {
    const made: RecordedConnection[] = [];
    const settings = directSettingsOfLoader(async () => standInClassOf(made), stunServers);
    expect(settings.stunServers).toEqual(stunServers);
    await settings.peers.open({ gatherMillis: 1, stunServers });
    expect(made).toEqual([
      {
        configuration: { iceServers: [{ urls: stunServers }] },
        label: "outlore",
        options: { id: 0, negotiated: true, ordered: true },
      },
    ]);
  });

  it("does not load the class until a peer is asked for", async () => {
    let loads = 0;
    const settings = directSettingsOfLoader(async () => {
      loads += 1;
      return standInClassOf([]);
    }, stunServers);
    expect(loads).toBe(0);
    await settings.peers.open({ gatherMillis: 1, stunServers });
    expect(loads).toBe(1);
  });

  it("refuses a library that gives no connection class, so the link stays on the relay", async () => {
    const settings = directSettingsOfLoader(async () => void 0, stunServers);
    await expect(settings.peers.open({ gatherMillis: 1, stunServers })).rejects.toThrow(/WebRTC/);
  });

  it("refuses a load that fails", async () => {
    const settings = directSettingsOfLoader(async () => {
      throw new Error("the native module is missing");
    }, stunServers);
    await expect(settings.peers.open({ gatherMillis: 1, stunServers })).rejects.toThrow("the native module is missing");
  });
});

describe("direct channels through the page's own WebRTC", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "RTCPeerConnection");
  });

  it("makes none in a runtime without an RTCPeerConnection", () => {
    expect(directSettingsOfPage(stunServers)).toBeUndefined();
  });

  it("makes settings from the global RTCPeerConnection", async () => {
    const made: RecordedConnection[] = [];
    Reflect.set(globalThis, "RTCPeerConnection", standInClassOf(made));
    const settings = directSettingsOfPage(stunServers);
    expect(settings?.stunServers).toEqual(stunServers);
    await settings?.peers.open({ gatherMillis: 1, stunServers });
    expect(made).toHaveLength(1);
  });
});
