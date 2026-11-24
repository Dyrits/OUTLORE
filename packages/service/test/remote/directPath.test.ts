import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { directWorld } from "./fixtures/directWorld.ts";

// A device and a host that find each other through a real local relay and then talk over a direct channel made by
// werift on this machine: what crosses the relay after the upgrade, what happens when the channel goes, and what the
// channel carries (device-pairing, Direct path). A real NAT cannot be crossed from here (see the specifications).

const readName = { _tag: "ReadHostName" };

describe("a paired device and its host over a direct channel", () => {
  it.live("moves the link onto a direct channel and sends nothing more through the relay", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* directWorld;
        const link = yield* world.pairedLink();
        expect(yield* link.ask(readName)).toMatchObject({ _tag: "Success", value: "Host Mac" });
        yield* world.untilDirect(true);
        expect(link.paths).toContain("direct");
        const before = world.relay.framesForwarded();
        for (let index = 0; index < 20; index++) {
          expect(yield* link.ask(readName)).toMatchObject({ _tag: "Success", value: "Host Mac" });
        }
        expect(world.relay.framesForwarded()).toBe(before);
        link.close();
      }),
    ),
  );

  it.live("runs the Noise handshake inside the channel and writes nothing readable on it", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* directWorld;
        const link = yield* world.pairedLink();
        yield* world.untilDirect(true);
        yield* link.ask(readName);
        const [recorded] = world.deviceSide.state.recorded;
        // Noise NK: the device's first message is its ephemeral key and a tag (32 + 16 bytes), the host's answer the same.
        expect(recorded?.sent[0]?.byteLength).toBe(48);
        expect(recorded?.received[0]?.byteLength).toBe(48);
        const everything = [...(recorded?.sent ?? []), ...(recorded?.received ?? [])]
          .map((bytes) => Buffer.from(bytes).toString("latin1"))
          .join("");
        expect(everything).not.toContain("ReadHostName");
        expect(everything).not.toContain("Host Mac");
        link.close();
      }),
    ),
  );

  it.live("falls back to the relay without losing the link when the channel closes, and upgrades again", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* directWorld;
        const link = yield* world.pairedLink();
        yield* world.untilDirect(true);
        const before = world.relay.framesForwarded();
        for (const peer of world.deviceSide.state.peers) peer.close();
        yield* world.untilDirect(false);
        expect(link.closed).toBeNull();
        expect(yield* link.ask(readName)).toMatchObject({ _tag: "Success", value: "Host Mac" });
        expect(world.relay.framesForwarded()).toBeGreaterThan(before);
        yield* world.untilDirect(true);
        expect(link.paths).toEqual(["direct", "relay", "direct"]);
        expect(yield* link.ask(readName)).toMatchObject({ _tag: "Success", value: "Host Mac" });
        link.close();
      }),
    ),
  );

  it.live("stays on the relay when the direct channel never opens", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* directWorld;
        world.deviceSide.state.isBlocked = true;
        const link = yield* world.pairedLink();
        expect(yield* link.ask(readName)).toMatchObject({ _tag: "Success", value: "Host Mac" });
        // Long enough for a try to run into its time limit and the next to start.
        yield* Effect.sleep("4500 millis");
        expect((yield* world.device)?.isDirect).toBe(false);
        expect(link.closed).toBeNull();
        const before = world.relay.framesForwarded();
        expect(yield* link.ask(readName)).toMatchObject({ _tag: "Success", value: "Host Mac" });
        expect(world.relay.framesForwarded()).toBeGreaterThan(before);
        link.close();
      }),
    ),
  );

  it.live("keeps a link to a host of another release on the relay, unframed, as the update link needs", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* directWorld;
        const link = yield* world.pairedLink({ linkRelease: "0.1.0-Older" });
        expect(yield* link.ask(readName)).toMatchObject({ _tag: "Success", value: "Host Mac" });
        yield* Effect.sleep("1500 millis");
        expect((yield* world.device)?.isDirect).toBe(false);
        expect(world.hostSide.state.peers).toHaveLength(0);
        expect(world.deviceSide.state.peers).toHaveLength(0);
        expect(link.paths).toEqual([]);
        link.close();
      }),
    ),
  );
});
