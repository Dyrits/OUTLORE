import type { PhoneCall } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import { createPhoneCalls, type PhoneRequest } from "../../src/phone/phoneCalls";
import { createPhoneExecutor } from "../../src/phone/phoneExecutor";
import { createPhoneSwitches } from "../../src/phone/phoneSwitches";
import { startPhoneUse } from "../../src/phone/phoneUse";
import { fakePhoneDevice } from "../fixtures/fakePhoneDevice";

/** A stand-in for the service client: it lets a test reopen the link and deliver a call frame. */
const fakeClient = () => {
  const openListeners = new Set<() => void>();
  const callListeners = new Set<(call: PhoneCall) => void>();
  return {
    callListeners,
    client: {
      subscribeOpen: (listener: () => void) => {
        openListeners.add(listener);
        return () => void openListeners.delete(listener);
      },
      subscribePhoneCalls: (listener: (call: PhoneCall) => void) => {
        callListeners.add(listener);
        return () => void callListeners.delete(listener);
      },
    },
    deliver: (call: PhoneCall) => {
      for (const listener of callListeners) listener(call);
    },
    openListeners,
    reopen: () => {
      for (const listener of openListeners) listener();
    },
  };
};

const setup = () => {
  const values = new Map<string, string>();
  const switches = createPhoneSwitches({
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  });
  const { device } = fakePhoneDevice();
  const sent: Array<PhoneRequest> = [];
  const calls = createPhoneCalls({
    deviceId: "phone-1",
    executor: createPhoneExecutor({ device, groups: switches.groups }),
    send: async (request) => void sent.push(request),
    switches,
  });
  const link = fakeClient();
  const stop = startPhoneUse({ calls, client: link.client, switches });
  return { link, sent, stop, switches };
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("phone use on a connection", () => {
  it("announces the groups at once, on every reconnect and after each change", async () => {
    const { link, sent, switches } = setup();
    await settle();
    link.reopen();
    switches.set("Open", true);
    await settle();
    expect(sent).toEqual([
      { _tag: "SetPhoneTools", groups: [] },
      { _tag: "SetPhoneTools", groups: [] },
      { _tag: "SetPhoneTools", groups: ["Open"] },
    ]);
  });

  it("answers a call the host sends", async () => {
    const { link, sent, switches } = setup();
    switches.set("Information", true);
    link.deliver({ _tag: "PhoneCall", args: {}, callId: "c1", deviceId: "phone-1", tool: "phone_info" });
    await settle();
    expect(sent.at(-1)).toMatchObject({ _tag: "AnswerPhoneCall", callId: "c1", outcome: { _tag: "Done" } });
  });

  it("stops listening when the connection ends", async () => {
    const { link, sent, stop, switches } = setup();
    await settle();
    stop();
    link.reopen();
    switches.set("Open", true);
    expect(link.callListeners.size).toBe(0);
    expect(link.openListeners.size).toBe(0);
    await settle();
    expect(sent).toHaveLength(1);
  });
});
