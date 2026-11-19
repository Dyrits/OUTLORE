import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { closingFrame, hostFrame, readClosingFrame } from "../src/roomCore.ts";
import { createFakeRoom, type FakePeer, hostFrameOf, idOf } from "./fixtures/fakeRoom.ts";

const bytes = (...values: number[]) => Uint8Array.from(values);

describe("saying why a connection is closed", () => {
  /** The closing frames a peer was sent before it was closed, and nothing sent after. */
  const closingsOf = (peer: FakePeer) => {
    const texts = peer.sent.filter((data): data is string => typeof data === "string");
    const closings = texts.map(readClosingFrame);
    expect(closings.every((closing) => closing !== null)).toBe(true);
    // Sent before the close, so the peer reads it first.
    expect(peer.sentWhenClosed).toBe(peer.sent.length);
    return closings;
  };

  it("builds a frame that reads back, and reads nothing else as one", () => {
    expect(readClosingFrame(closingFrame(1013, "host offline"))).toEqual({ code: 1013, reason: "host offline" });
    for (const text of [
      "pong",
      "ping",
      "",
      "{}",
      "[]",
      "null",
      '{"closing":1}',
      '{"closing":{"code":"1013","reason":"x"}}',
      '{"closing":{"code":1013}}',
      '{"closing":{"code":5,"reason":"x"}}',
      '{"closing":{"code":1013,"reason":7}}',
      "{not json",
    ])
      expect(readClosingFrame(text), text).toBeNull();
  });

  it("tells a client there is no host before it closes it", async () => {
    const { connect } = createFakeRoom();
    const client = await connect("client");
    expect(closingsOf(client)).toEqual([{ code: 1013, reason: "host offline" }]);
  });

  it("tells the ninth client the room is full", async () => {
    const { connect } = createFakeRoom();
    await connect("host", "first");
    const clients: FakePeer[] = [];
    for (let count = 0; count < 9; count += 1) clients.push(await connect("client"));
    expect(closingsOf(clients[8] as FakePeer)).toEqual([{ code: 4004, reason: "room full" }]);
    expect(clients[0]?.sent).toEqual([]);
  });

  it("tells every client the host left, whether it left or was replaced", async () => {
    const { connect, core } = createFakeRoom();
    const host = await connect("host", "first");
    const first = await connect("client");
    Effect.runSync(core.close(host));
    expect(closingsOf(first)).toEqual([{ code: 1001, reason: "host left" }]);
    const next = await connect("host", "first");
    const second = await connect("client");
    await connect("host", "first");
    expect(closingsOf(second)).toEqual([{ code: 1001, reason: "host left" }]);
    expect(closingsOf(next)).toEqual([{ code: 1012, reason: "replaced" }]);
  });

  it("tells a host with another claim that the claim does not match", async () => {
    const { connect } = createFakeRoom();
    await connect("host", "first");
    expect(closingsOf(await connect("host", "second"))).toEqual([{ code: 1008, reason: "claim mismatch" }]);
    expect(closingsOf(await connect("host"))).toEqual([{ code: 1008, reason: "claim mismatch" }]);
  });

  it("tells a connection it broke a rule", async () => {
    const { connect, core } = createFakeRoom();
    const host = await connect("host", "first");
    const text = await connect("client");
    Effect.runSync(core.receive(text, "hello"));
    expect(closingsOf(text)).toEqual([{ code: 1003, reason: "text frames are not supported" }]);
    const big = await connect("client");
    Effect.runSync(core.receive(big, new Uint8Array(1024 * 1024 + 1)));
    expect(closingsOf(big)).toEqual([{ code: 1009, reason: "frame too large" }]);
    Effect.runSync(core.receive(host, new Uint8Array(3)));
    expect(closingsOf(host)).toEqual([{ code: 1002, reason: "malformed frame" }]);
  });

  it("tells a client the host disconnected it", async () => {
    const { connect, core } = createFakeRoom();
    const host = await connect("host", "first");
    const client = await connect("client");
    const id = idOf(host.frames()[0] ?? bytes());
    Effect.runSync(core.receive(host, hostFrameOf(hostFrame.disconnect, id)));
    expect(closingsOf(client)).toEqual([{ code: 1000, reason: "disconnected" }]);
  });

  it("sends a connection nothing extra while it stays open", async () => {
    const { connect, core } = createFakeRoom();
    const host = await connect("host", "first");
    const client = await connect("client");
    Effect.runSync(core.receive(client, "ping"));
    expect(client.sent).toEqual(["pong"]);
    expect(host.sent.filter((data) => typeof data === "string")).toEqual([]);
  });
});
