import { Effect } from "effect";
import { afterEach, expect, it, vi } from "vitest";
import { ConnectFailure, connectClient } from "../src/client.ts";

afterEach(() => vi.unstubAllGlobals());

it("reports a failed WebSocket construction as a typed connection failure", async () => {
  vi.stubGlobal(
    "WebSocket",
    class {
      constructor() {
        throw new Error("offline");
      }
    },
  );
  const failure = await Effect.runPromise(
    Effect.flip(connectClient({ relayOrigin: "https://relay.example", room: "room" })),
  );
  expect(failure).toBeInstanceOf(ConnectFailure);
  expect(failure.kind).toBe("unreachable");
});

it("delivers only the bytes in a WebSocket message's view", async () => {
  class Socket extends EventTarget {
    static readonly OPEN = 1;
    static latest: Socket;
    binaryType = "";
    readyState = Socket.OPEN;
    constructor() {
      super();
      Socket.latest = this;
      queueMicrotask(() => this.dispatchEvent(new Event("open")));
    }
    close() {
      this.dispatchEvent(new Event("close"));
    }
    send() {}
  }
  vi.stubGlobal("WebSocket", Socket);
  const connected = await Effect.runPromise(connectClient({ relayOrigin: "https://relay.example", room: "room" }));
  const received: Uint8Array[] = [];
  connected.carrier.onMessage((data) => received.push(data));
  const bytes = new Uint8Array([99, 1, 2, 88]);
  Socket.latest.dispatchEvent(new MessageEvent("message", { data: bytes.subarray(1, 3) }));
  expect(received).toEqual([new Uint8Array([1, 2])]);
  connected.carrier.close();
});
