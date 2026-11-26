import type { PhoneCall, PhoneGroup, PhoneOutcome, ServerFrame } from "@outlore/contracts";
import { Effect, Fiber } from "effect";
import { SqlClient } from "effect/sql";
import { Sessions } from "../../src/core/index.ts";
import { Service } from "../../src/serviceTag.ts";

/** Answers a call as a phone would: with a value, or a refusal. */
export type FakePhoneBehavior = (call: PhoneCall) => PhoneOutcome;

/**
 * A fake paired phone: pairs a device, connects it as the host's session registry sees one, reports its groups as the
 * app does (a `SetPhoneTools` request from that device) and answers each call it is sent, as the app's executor would.
 * Closed with `leave`.
 */
export const connectFakePhone = (deviceId: string, name: string, groups: ReadonlyArray<PhoneGroup>) =>
  Effect.gen(function* () {
    const sessions = yield* Sessions;
    const sql = yield* SqlClient.SqlClient;
    const service = yield* Service;
    const source = { deviceId, isPairedDevice: true } as const;
    yield* sql`INSERT OR IGNORE INTO paired_devices (id, kind, last_active_at, name, paired_at, token_hash)
      VALUES (${deviceId}, 'phone', 0, ${name}, 0, X'00')`;
    const frames: ServerFrame[] = [];
    const remove = sessions.add((frame) => void frames.push(frame), deviceId);
    yield* service.handle({ _tag: "SetPhoneTools", groups }, source);
    const calls = () => frames.filter((frame): frame is PhoneCall => frame._tag === "PhoneCall");
    /** Answers every call from now on, until the phone leaves. */
    const serve = (behave: FakePhoneBehavior) =>
      Effect.gen(function* () {
        let answered = 0;
        const loop = Effect.gen(function* () {
          while (true) {
            const call = calls()[answered];
            if (call === undefined) {
              yield* Effect.sleep("5 millis");
              continue;
            }
            answered++;
            yield* service.handle({ _tag: "AnswerPhoneCall", callId: call.callId, outcome: behave(call) }, source);
          }
        });
        return yield* Effect.forkDetach(loop);
      });
    return {
      calls,
      leave: () => {
        remove();
      },
      serve,
      setGroups: (next: ReadonlyArray<PhoneGroup>) => service.handle({ _tag: "SetPhoneTools", groups: next }, source),
    };
  });

/** Stops a fake phone's answering loop. */
export const stopServing = (fiber: Fiber.Fiber<never>) => Fiber.interrupt(fiber);
