import type { ServerFrame } from "@outlore/contracts";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { answerText } from "../../src/remote/index.ts";

/** The phone's own requests at the frame boundary: only a paired device may send them (phone-control). */

const frameFor = (request: object) => JSON.stringify({ id: "1", request });
const requests = [
  { _tag: "SetPhoneTools", groups: ["Clipboard"] },
  { _tag: "AnswerPhoneCall", callId: "c", outcome: { _tag: "Refused", reason: "No" } },
];

const run = async (request: object, isPairedDevice: boolean) => {
  const sent: ServerFrame[] = [];
  let isAsked = false;
  const handle = () => {
    isAsked = true;
    return Effect.succeed(null);
  };
  await Effect.runPromise(
    answerText(handle as never, frameFor(request), (frame) => sent.push(frame), { deviceId: "d", isPairedDevice }),
  );
  return { isAsked, sent };
};

describe("who may send a phone's requests", () => {
  it("refuses them from the host's own window without asking the service", async () => {
    for (const request of requests) {
      const { isAsked, sent } = await run(request, false);
      expect(isAsked).toBe(false);
      expect(sent).toMatchObject([{ _tag: "Failure", error: { kind: "AccessRefused" }, id: "1" }]);
    }
  });

  it("answers them from a paired device", async () => {
    for (const request of requests) {
      const { isAsked, sent } = await run(request, true);
      expect(isAsked).toBe(true);
      expect(sent).toMatchObject([{ _tag: "Success", id: "1", value: null }]);
    }
  });
});
