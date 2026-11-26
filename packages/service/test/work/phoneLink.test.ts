import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import type { PhoneCall, PhoneGroup, ServerFrame } from "@outlore/contracts";
import { Effect, Fiber, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { changesLayer, Sessions, sessionsLayer, storeLayer } from "../../src/core/index.ts";
import { PhoneLink, phoneLinkLayer } from "../../src/work/phoneLink.ts";
import { temporary } from "../fixtures/service.ts";

// The host's phone link (phone-control): which paired phone is connected with which groups on, and a call carried to it
// and its answer back, against a recording stand-in for the phone's session. Real time, with a short limit.

const layerWith = (limitMillis: number) =>
  phoneLinkLayer(limitMillis).pipe(
    Layer.provideMerge(sessionsLayer),
    Layer.provideMerge(changesLayer),
    Layer.provideMerge(storeLayer(join(temporary("outlore-phone-link-"), "store.sqlite"))),
  );

/** Pairs a stand-in phone, connects it and has it report its groups; its received calls are recorded. */
const connect = (deviceId: string, name: string, groups: ReadonlyArray<PhoneGroup>) =>
  Effect.gen(function* () {
    const sessions = yield* Sessions;
    const sql = yield* SqlClient.SqlClient;
    const link = yield* PhoneLink;
    yield* sql`INSERT OR IGNORE INTO paired_devices (id, kind, last_active_at, name, paired_at, token_hash)
      VALUES (${deviceId}, 'phone', 0, ${name}, 0, X'00')`;
    const frames: ServerFrame[] = [];
    const remove = sessions.add((frame) => void frames.push(frame), deviceId);
    yield* link.setGroups(deviceId, groups);
    return {
      calls: () => frames.filter((frame): frame is PhoneCall => frame._tag === "PhoneCall"),
      deviceId,
      remove,
    };
  });

/** Waits until a stand-in phone has been sent its n-th call. */
const received = (phone: { calls: () => ReadonlyArray<PhoneCall> }, count = 1) =>
  Effect.gen(function* () {
    for (let attempt = 0; attempt < 200 && phone.calls().length < count; attempt++) yield* Effect.sleep("5 millis");
    const call = phone.calls()[count - 1];
    if (call === undefined) return yield* Effect.die("The phone was never called.");
    return call;
  });

const refusalOf = <Value>(effect: Effect.Effect<Value, { reason: string }>) =>
  effect.pipe(
    Effect.flip,
    Effect.map((refusal) => refusal.reason),
  );

describe("calling a connected phone", () => {
  it.live("sends the call to that phone alone and returns the value it answers", () =>
    Effect.gen(function* () {
      const link = yield* PhoneLink;
      const phone = yield* connect("pixel", "Pixel", ["Clipboard"]);
      const other = yield* connect("tablet", "Tablet", []);
      const calling = yield* Effect.forkChild(link.call("Clipboard", "phone_clipboard_read", { x: 1 }));
      const call = yield* received(phone);
      expect(call).toMatchObject({ args: { x: 1 }, deviceId: "pixel", tool: "phone_clipboard_read" });
      expect(other.calls()).toEqual([]);
      yield* link.answer("pixel", call.callId, { _tag: "Done", value: "copied text" });
      expect(yield* Fiber.join(calling)).toBe("copied text");
    }).pipe(Effect.provide(layerWith(5_000))),
  );

  it.live("turns a refusal from the phone into its plain sentence", () =>
    Effect.gen(function* () {
      const link = yield* PhoneLink;
      const phone = yield* connect("pixel", "Pixel", ["Location"]);
      const calling = yield* Effect.forkChild(refusalOf(link.call("Location", "phone_location", {})));
      const call = yield* received(phone);
      yield* link.answer("pixel", call.callId, { _tag: "Refused", reason: "The phone's owner has not allowed this" });
      expect(yield* Fiber.join(calling)).toBe("The phone's owner has not allowed this");
    }).pipe(Effect.provide(layerWith(5_000))),
  );

  it.live("ignores an answer from a phone the call was not sent to", () =>
    Effect.gen(function* () {
      const link = yield* PhoneLink;
      const phone = yield* connect("pixel", "Pixel", ["Information"]);
      yield* connect("tablet", "Tablet", ["Information"]);
      const calling = yield* Effect.forkChild(link.call("Information", "phone_info", {}, "Pixel"));
      const call = yield* received(phone);
      yield* link.answer("tablet", call.callId, { _tag: "Done", value: "forged" });
      yield* link.answer("pixel", call.callId, { _tag: "Done", value: "genuine" });
      expect(yield* Fiber.join(calling)).toBe("genuine");
    }).pipe(Effect.provide(layerWith(5_000))),
  );
});

describe("a call that cannot reach a phone", () => {
  it.live("fails at once with no phone connected", () =>
    Effect.gen(function* () {
      const link = yield* PhoneLink;
      expect(yield* refusalOf(link.call("Information", "phone_info", {}))).toBe(
        "No phone connected. Open Outlore on the phone.",
      );
      expect(yield* link.isAvailable).toBe(false);
    }).pipe(Effect.provide(layerWith(5_000))),
  );

  it.live("fails at once, sending nothing, while the group is off on the only connected phone", () =>
    Effect.gen(function* () {
      const link = yield* PhoneLink;
      const phone = yield* connect("pixel", "Pixel", ["Clipboard"]);
      expect(yield* refusalOf(link.call("Location", "phone_location", {}))).toContain("Location");
      expect(phone.calls()).toEqual([]);
    }).pipe(Effect.provide(layerWith(5_000))),
  );

  it.live("fails at once naming the phones when several are connected and none is named", () =>
    Effect.gen(function* () {
      const link = yield* PhoneLink;
      const pixel = yield* connect("pixel", "Pixel", ["Information"]);
      const galaxy = yield* connect("galaxy", "Galaxy", ["Information"]);
      const reason = yield* refusalOf(link.call("Information", "phone_info", {}));
      expect(reason).toContain("Pixel");
      expect(reason).toContain("Galaxy");
      expect(reason).toContain("`phone`");
      expect([pixel.calls(), galaxy.calls()]).toEqual([[], []]);
    }).pipe(Effect.provide(layerWith(5_000))),
  );

  it.live("goes to the named phone when several are connected, whatever the name's case", () =>
    Effect.gen(function* () {
      const link = yield* PhoneLink;
      yield* connect("pixel", "Pixel", ["Information"]);
      const galaxy = yield* connect("galaxy", "Galaxy", ["Information"]);
      const calling = yield* Effect.forkChild(link.call("Information", "phone_info", {}, "galaxy"));
      const call = yield* received(galaxy);
      yield* link.answer("galaxy", call.callId, { _tag: "Done", value: 1 });
      expect(yield* Fiber.join(calling)).toBe(1);
    }).pipe(Effect.provide(layerWith(5_000))),
  );

  it.live("fails with its own sentence for a named phone that is unknown, not connected or has the group off", () =>
    Effect.gen(function* () {
      const link = yield* PhoneLink;
      yield* connect("pixel", "Pixel", ["Information"]);
      const away = yield* connect("galaxy", "Galaxy", ["Information"]);
      away.remove();
      expect(yield* refusalOf(link.call("Information", "phone_info", {}, "Nokia"))).toBe(
        'No paired phone is named "Nokia".',
      );
      expect(yield* refusalOf(link.call("Information", "phone_info", {}, "Galaxy"))).toBe(
        "Galaxy is not connected. Open Outlore on it.",
      );
      expect(yield* refusalOf(link.call("Location", "phone_location", {}, "Pixel"))).toContain("Pixel has not allowed");
    }).pipe(Effect.provide(layerWith(5_000))),
  );

  it.live("stops waiting after the limit, and a late answer changes nothing", () =>
    Effect.gen(function* () {
      const link = yield* PhoneLink;
      const phone = yield* connect("pixel", "Pixel", ["Information"]);
      const calling = yield* Effect.forkChild(refusalOf(link.call("Information", "phone_info", {})));
      const call = yield* received(phone);
      expect(yield* Fiber.join(calling)).toBe("The phone did not answer in 0.1 seconds.");
      yield* link.answer("pixel", call.callId, { _tag: "Done", value: "late" });
    }).pipe(Effect.provide(layerWith(100))),
  );

  it.live("fails a pending call when the phone's session is removed", () =>
    Effect.gen(function* () {
      const link = yield* PhoneLink;
      const phone = yield* connect("pixel", "Pixel", ["Information"]);
      const calling = yield* Effect.forkChild(refusalOf(link.call("Information", "phone_info", {})));
      yield* received(phone);
      phone.remove();
      expect(yield* Fiber.join(calling)).toBe("The phone disconnected before it answered.");
      expect(yield* link.isAvailable).toBe(false);
    }).pipe(Effect.provide(layerWith(5_000))),
  );
});

describe("which tools a phone makes available", () => {
  it.live("offers the tools of the groups that are on, on any connected phone, and none once it leaves", () =>
    Effect.gen(function* () {
      const link = yield* PhoneLink;
      expect(yield* link.isAvailable).toBe(false);
      const phone = yield* connect("pixel", "Pixel", []);
      expect(yield* link.isAvailable).toBe(false);
      yield* link.setGroups("pixel", ["Clipboard", "Notify"]);
      expect(yield* link.isAvailable).toBe(true);
      expect([...(yield* link.offeredTools)].sort()).toEqual([
        "phone_clipboard_read",
        "phone_clipboard_write",
        "phone_notify",
      ]);
      phone.remove();
      expect(yield* link.isAvailable).toBe(false);
    }).pipe(Effect.provide(layerWith(5_000))),
  );

  it.live("records no groups from a device that is not connected", () =>
    Effect.gen(function* () {
      const link = yield* PhoneLink;
      yield* link.setGroups("ghost", ["Clipboard"]);
      expect(yield* link.isAvailable).toBe(false);
    }).pipe(Effect.provide(layerWith(5_000))),
  );
});
