import type { ServerFrame } from "@outlore/contracts";
import { hostOnlyRequestTags } from "@outlore/contracts";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { answerText } from "../../src/remote/index.ts";

/** A well-formed request of each kind this test sends. */
const requests = {
  AddBrowsableRoot: { path: "/tmp" },
  AddHost: { code: "outlore1-x", deviceName: "Laptop" },
  CreatePairingCode: {},
  DisconnectDevice: { deviceId: "d" },
  ListHosts: {},
  ReadHostName: {},
  ReadRemoteAccess: {},
  RemoveBrowsableRoot: { path: "/tmp" },
  RemoveHost: { hostId: "h" },
  RenameHost: { name: "Studio" },
  RequestApplePermission: { connectorId: "apple" },
  SetRemoteAccess: { isEnabled: false },
  UseOwnRelay: { token: "a-token" },
  UseSharedRelay: {},
} as const;

const frameFor = (tag: string) =>
  JSON.stringify({ id: "1", request: { _tag: tag, ...new Map<string, object>(Object.entries(requests)).get(tag) } });

/** Runs a text frame from a source and returns what was sent back and whether the service was asked. */
const run = async (tag: string, isPairedDevice: boolean) => {
  const sent: ServerFrame[] = [];
  let isAsked = false;
  const handle = () => {
    isAsked = true;
    return Effect.succeed("answer");
  };
  await Effect.runPromise(answerText(handle as never, frameFor(tag), (frame) => sent.push(frame), { isPairedDevice }));
  return { isAsked, sent };
};

describe("what a paired device may ask of a host", () => {
  it("is refused every host-only request without the service being asked", async () => {
    for (const tag of hostOnlyRequestTags) {
      const { isAsked, sent } = await run(tag, true);
      expect(isAsked, tag).toBe(false);
      expect(sent, tag).toMatchObject([{ _tag: "Failure", error: { kind: "AccessRefused" }, id: "1" }]);
    }
  });

  it("is answered the shared requests, and the owner's window every request", async () => {
    expect((await run("RenameHost", true)).isAsked).toBe(true);
    expect((await run("ReadHostName", true)).isAsked).toBe(true);
    for (const tag of hostOnlyRequestTags) expect((await run(tag, false)).isAsked, tag).toBe(true);
  });

  it("answers a frame it cannot read with InvalidInput when it can find the identifier", async () => {
    const sent: ServerFrame[] = [];
    await Effect.runPromise(
      answerText(
        (() => Effect.succeed(null)) as never,
        JSON.stringify({ id: "7", request: { _tag: "Nope" } }),
        (frame) => sent.push(frame),
        {
          isPairedDevice: true,
        },
      ),
    );
    expect(sent).toMatchObject([{ _tag: "Failure", error: { kind: "InvalidInput" }, id: "7" }]);
  });
});
