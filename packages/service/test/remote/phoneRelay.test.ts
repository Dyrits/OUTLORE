import { describe, expect, it } from "@effect/vitest";
import type { ServerFrame } from "@outlore/contracts";
import { Effect, Fiber } from "effect";
import { Sessions } from "../../src/core/index.ts";
import { PhoneLink } from "../../src/work/index.ts";
import { makeWorld, until } from "./fixtures/pairingWorld.ts";

// A phone call across a real relay between two whole services: the controller's service stands in for the owner's
// phone, paired with the host and connected through its loopback bridge, as a paired app is (phone-control).

describe("a phone call through the relay", () => {
  it.live("reaches only the paired device, which answers it with its own identity", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* makeWorld();
        yield* world.allowPairing;
        const paired = yield* world.pair(yield* world.newCode());
        const link = yield* world.bridge(paired.id);
        // A screen of the host's own window, which must not be handed the call.
        const hostSessions = yield* Sessions.pipe(Effect.provideContext(world.hostContext));
        const hostWindow: ServerFrame[] = [];
        hostSessions.add((frame) => void hostWindow.push(frame));

        expect(yield* world.ask(link, "1", { _tag: "SetPhoneTools", groups: ["Information"] })).toMatchObject({
          _tag: "Success",
          value: null,
        });
        const phoneLink = yield* PhoneLink.pipe(Effect.provideContext(world.hostContext));
        expect(yield* phoneLink.isAvailable).toBe(true);

        const calling = yield* Effect.forkChild(phoneLink.call("Information", "phone_info", { probe: true }));
        const call = yield* until(() => link.frames.find((frame) => frame._tag === "PhoneCall"));
        const [device] = yield* world.hostSql((sql) => sql<{ id: string }>`SELECT id FROM paired_devices`);
        expect(call).toMatchObject({ args: { probe: true }, deviceId: device?.id, tool: "phone_info" });
        expect(hostWindow.filter((frame) => frame._tag === "PhoneCall")).toEqual([]);

        const answered = yield* world.ask(link, "2", {
          _tag: "AnswerPhoneCall",
          callId: call._tag === "PhoneCall" ? call.callId : "",
          outcome: { _tag: "Done", value: { battery: 0.5 } },
        });
        expect(answered).toMatchObject({ _tag: "Success", value: null });
        expect(yield* Fiber.join(calling)).toEqual({ battery: 0.5 });

        // The device leaving ends its availability.
        link.socket.close();
        yield* until(() => Effect.runPromise(phoneLink.isAvailable).then((is) => (is ? undefined : true)));
      }),
    ),
  );

  it.live("is refused to the host's own window, which sends no device identity", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const world = yield* makeWorld();
        const refused = yield* Effect.flip(world.host({ _tag: "SetPhoneTools", groups: ["Information"] }));
        expect(refused.kind).toBe("AccessRefused");
      }),
    ),
  );
});
