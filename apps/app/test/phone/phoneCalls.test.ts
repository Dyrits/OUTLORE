import type { PhoneCall, PhoneGroup } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import { createPhoneCalls, type PhoneRequest } from "../../src/phone/phoneCalls";
import { createPhoneExecutor } from "../../src/phone/phoneExecutor";
import { createPhoneSwitches } from "../../src/phone/phoneSwitches";
import { fakePhoneDevice } from "../fixtures/fakePhoneDevice";

const memory = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
  };
};

const phone = (groups: ReadonlyArray<PhoneGroup> = []) => {
  const switches = createPhoneSwitches(memory());
  for (const group of groups) switches.set(group, true);
  const { calls, device } = fakePhoneDevice();
  const sent: Array<PhoneRequest> = [];
  const phoneCalls = createPhoneCalls({
    deviceId: "phone-1",
    executor: createPhoneExecutor({ device, groups: switches.groups }),
    send: async (request) => void sent.push(request),
    switches,
  });
  return { calls, phoneCalls, sent, switches };
};

const call = (overrides: Partial<PhoneCall> = {}): PhoneCall => ({
  _tag: "PhoneCall",
  args: {},
  callId: "call-1",
  deviceId: "phone-1",
  tool: "phone_info",
  ...overrides,
});

describe("phone calls", () => {
  it("answers a call for this phone with the executor's outcome", async () => {
    const { phoneCalls, sent } = phone(["Information"]);
    await phoneCalls.handle(call());
    expect(sent).toEqual([
      { _tag: "AnswerPhoneCall", callId: "call-1", outcome: { _tag: "Done", value: { batteryPercent: 80 } } },
    ]);
  });

  it("answers a refusal when the switch is off", async () => {
    const { calls, phoneCalls, sent } = phone();
    await phoneCalls.handle(call());
    expect(sent).toEqual([
      {
        _tag: "AnswerPhoneCall",
        callId: "call-1",
        outcome: { _tag: "Refused", reason: "The phone's owner has not allowed this" },
      },
    ]);
    expect(calls).toEqual([]);
  });

  it("ignores a call for another phone: no run and no answer", async () => {
    const { calls, phoneCalls, sent } = phone(["Information"]);
    await phoneCalls.handle(call({ deviceId: "phone-2" }));
    expect(calls).toEqual([]);
    expect(sent).toEqual([]);
  });

  it("ignores a call when this phone does not know its device identity yet", async () => {
    const switches = createPhoneSwitches(memory());
    const { device } = fakePhoneDevice();
    const sent: Array<PhoneRequest> = [];
    const phoneCalls = createPhoneCalls({
      deviceId: null,
      executor: createPhoneExecutor({ device, groups: switches.groups }),
      send: async (request) => void sent.push(request),
      switches,
    });
    await phoneCalls.handle(call());
    expect(sent).toEqual([]);
  });

  it("announces the groups that are on", async () => {
    const { phoneCalls, sent } = phone(["Open", "Clipboard"]);
    await phoneCalls.announce();
    expect(sent).toEqual([{ _tag: "SetPhoneTools", groups: ["Clipboard", "Open"] }]);
  });

  it("does not fail when the host refuses or loses an answer", async () => {
    const switches = createPhoneSwitches(memory());
    const { device } = fakePhoneDevice();
    const phoneCalls = createPhoneCalls({
      deviceId: "phone-1",
      executor: createPhoneExecutor({ device, groups: () => ["Information"] }),
      send: async () => {
        throw new Error("Not connected to the host.");
      },
      switches,
    });
    await expect(phoneCalls.handle(call())).resolves.toBeUndefined();
    await expect(phoneCalls.announce()).resolves.toBeUndefined();
  });
});
