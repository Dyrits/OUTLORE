import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceClient } from "../../src/foundation/client";

class FakeSocket {
  static readonly OPEN = 1;
  static all: FakeSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  constructor(readonly url: string) {
    FakeSocket.all.push(this);
  }
  open() {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }
  fail() {
    this.readyState = 3;
    this.onerror?.();
    this.onclose?.({ code: 1006, reason: "" });
  }
  close() {
    this.readyState = 3;
    this.onclose?.({ code: 1000, reason: "" });
  }
  send() {}
}

const connect = async () => {
  const connecting = ServiceClient.connect();
  await vi.waitFor(() => expect(FakeSocket.all).toHaveLength(1));
  FakeSocket.all[0]?.open();
  return connecting;
};

describe("the service client's reconnection", () => {
  beforeEach(() => {
    FakeSocket.all = [];
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", FakeSocket);
    vi.stubGlobal("window", { outlore: { endpoint: async () => "ws://service" } });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("retries a failed first connection and exposes its status before recovery", async () => {
    const connecting = ServiceClient.connect();
    await vi.waitFor(() => expect(FakeSocket.all).toHaveLength(1));
    FakeSocket.all[0]?.fail();
    const client = await connecting;
    expect(client.failure).toBe("Could not reach this computer's service.");
    expect(client.hasConnected).toBe(false);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(FakeSocket.all).toHaveLength(2);
    FakeSocket.all[1]?.open();
    expect(client.hasConnected).toBe(true);
    expect(client.failure).toBeNull();
    client.close();
  });

  it("keeps retrying when a reconnection fails before it opens", async () => {
    const client = await connect();
    FakeSocket.all[0]?.fail();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeSocket.all).toHaveLength(2);
    FakeSocket.all[1]?.fail();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeSocket.all).toHaveLength(3);
    client.close();
  });

  it("stops retrying once closed, even with a connection attempt pending", async () => {
    const client = await connect();
    FakeSocket.all[0]?.fail();
    await vi.advanceTimersByTimeAsync(60_000);
    client.close();
    await vi.advanceTimersByTimeAsync(600_000);
    expect(FakeSocket.all).toHaveLength(2);
    expect(FakeSocket.all[1]?.readyState).toBe(3);
  });

  it("carries each open shell's output and exit to the screens that listen", async () => {
    const client = await connect();
    const seen: string[] = [];
    const stopListening = client.subscribeTerminals((frame) =>
      seen.push(frame._tag === "TerminalData" ? `${frame.id}:${frame.data}:${frame.sequence}` : `${frame.id}:exit`),
    );
    FakeSocket.all[0]?.onmessage?.({
      data: JSON.stringify({ _tag: "TerminalData", data: "sh>", id: "remote:quest:home", sequence: 3 }),
    });
    FakeSocket.all[0]?.onmessage?.({ data: JSON.stringify({ _tag: "TerminalExit", id: "remote:quest:home" }) });
    expect(seen).toEqual(["remote:quest:home:sh>:3", "remote:quest:home:exit"]);
    stopListening();
    FakeSocket.all[0]?.onmessage?.({
      data: JSON.stringify({ _tag: "TerminalData", data: "after", id: "remote:quest:home", sequence: 4 }),
    });
    expect(seen).toHaveLength(2);
    client.close();
  });

  it("rebuilds a reply from appended frames, starts a late listener at the text so far, and drops a gapped frame", async () => {
    const client = await connect();
    const threadId = crypto.randomUUID();
    const deliver = (frame: object) =>
      FakeSocket.all[0]?.onmessage?.({ data: JSON.stringify({ _tag: "Draft", threadId, ...frame }) });
    const seen: string[] = [];
    client.subscribeDrafts((id, text) => id === threadId && seen.push(text));
    deliver({ text: "Hel" });
    deliver({ offset: 3, text: "lo, " });
    // A late screen reads what the connection holds, not only what comes after.
    expect(client.draftOf(threadId)).toBe("Hello, ");
    // A frame that continues text the screen never held is a missed one: kept out, the snapshot repairs it.
    deliver({ offset: 12, text: "far" });
    expect(client.draftOf(threadId)).toBe("Hello, ");
    deliver({ text: "Hello, world" });
    deliver({ offset: 12, text: "!" });
    expect(seen).toEqual(["Hel", "Hello, ", "Hello, world", "Hello, world!"]);
    deliver({ text: "" });
    expect(client.draftOf(threadId)).toBe("");
    client.close();
  });

  it("forgets the replies in progress when the link drops, and tells the screens showing them", async () => {
    const client = await connect();
    const threadId = crypto.randomUUID();
    const seen: string[] = [];
    client.subscribeDrafts((_, text) => seen.push(text));
    FakeSocket.all[0]?.onmessage?.({ data: JSON.stringify({ _tag: "Draft", text: "Partly", threadId }) });
    FakeSocket.all[0]?.fail();
    expect(client.draftOf(threadId)).toBe("");
    expect(seen).toEqual(["Partly", ""]);
    client.close();
  });
});

describe("the update link to a host that restarts to install", () => {
  beforeEach(() => {
    FakeSocket.all = [];
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", FakeSocket);
    vi.stubGlobal("window", { outlore: { endpoint: async () => "ws://service/?token=t" } });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const hostEnds = (socket: FakeSocket | undefined, code: number, reason: string) => {
    if (socket === undefined) throw new Error("no socket");
    socket.readyState = 3;
    socket.onclose?.({ code, reason });
  };

  it("connects to the host through the path that keeps a host of another release", async () => {
    const connecting = ServiceClient.connect("host-1", true);
    await vi.waitFor(() => expect(FakeSocket.all).toHaveLength(1));
    expect(FakeSocket.all[0]?.url).toBe("ws://service/host/host-1/update?token=t");
    FakeSocket.all[0]?.open();
    (await connecting).close();
  });

  it("keeps trying for as long as the install takes and is connected again when the host returns", async () => {
    const connecting = ServiceClient.connect("host-1", true);
    await vi.waitFor(() => expect(FakeSocket.all).toHaveLength(1));
    FakeSocket.all[0]?.open();
    const client = await connecting;
    // The host quits to swap its app; every try then ends because the relay has no host in the room.
    hostEnds(FakeSocket.all[0], 4001, "The host disconnected.");
    expect(client.hasGivenUp).toBe(false);
    await expect(client.request({ _tag: "ReadHostUpdate" })).rejects.toThrow("Not connected to the host.");
    for (let minute = 0; minute < 10; minute++) {
      await vi.advanceTimersByTimeAsync(60_000);
      const last = FakeSocket.all[FakeSocket.all.length - 1];
      hostEnds(last, 4000, "The host is not connected right now.");
      expect(client.hasGivenUp).toBe(false);
    }
    expect(FakeSocket.all.length).toBeGreaterThan(10);
    // The new release is up: the next try opens and the same link is used again, with no new pairing.
    await vi.advanceTimersByTimeAsync(60_000);
    FakeSocket.all[FakeSocket.all.length - 1]?.open();
    expect(client.hasConnected).toBe(true);
    expect(client.hasGivenUp).toBe(false);
    expect(client.failure).toBeNull();
    client.close();
  });

  it("gives up only when the host no longer knows this device", async () => {
    const connecting = ServiceClient.connect("host-1", true);
    await vi.waitFor(() => expect(FakeSocket.all).toHaveLength(1));
    FakeSocket.all[0]?.open();
    const client = await connecting;
    hostEnds(FakeSocket.all[0], 4002, "The host no longer knows this computer.");
    expect(client.hasGivenUp).toBe(true);
    expect(client.isPairingNeeded).toBe(true);
  });
});
