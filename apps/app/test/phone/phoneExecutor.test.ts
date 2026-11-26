import type { PhoneCall, PhoneGroup } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import { createPhoneExecutor } from "../../src/phone/phoneExecutor";
import { fakePhoneDevice } from "../fixtures/fakePhoneDevice";

const call = (tool: PhoneCall["tool"], args: unknown = {}): PhoneCall => ({
  _tag: "PhoneCall",
  args,
  callId: "call-1",
  deviceId: "phone-1",
  tool,
});

const executorWith = (groups: ReadonlyArray<PhoneGroup>, overrides = {}) => {
  const fake = fakePhoneDevice(overrides);
  return { ...fake, executor: createPhoneExecutor({ device: fake.device, groups: () => groups }) };
};

describe("phone executor with the switch off", () => {
  it.each([
    ["phone_info", {}],
    ["phone_location", {}],
    ["phone_clipboard_read", {}],
    ["phone_clipboard_write", { text: "x" }],
    ["phone_open", { url: "https://outlore.app" }],
    ["phone_notify", { text: "hi", title: "t" }],
  ] as const)("refuses %s and does nothing on the phone", async (tool, args) => {
    const { calls, executor } = executorWith([]);
    expect(await executor.execute(call(tool, args))).toEqual({
      _tag: "Refused",
      reason: "The phone's owner has not allowed this",
    });
    expect(calls).toEqual([]);
  });

  it("refuses a tool whose group is off even while another group is on", async () => {
    const { calls, executor } = executorWith(["Information"]);
    expect(await executor.execute(call("phone_location"))).toMatchObject({ _tag: "Refused" });
    expect(calls).toEqual([]);
  });
});

describe("phone executor with the switch on", () => {
  it("returns the device's value for information and location", async () => {
    const { executor } = executorWith(["Information", "Location"]);
    expect(await executor.execute(call("phone_info"))).toEqual({ _tag: "Done", value: { batteryPercent: 80 } });
    expect(await executor.execute(call("phone_location"))).toEqual({
      _tag: "Done",
      value: { accuracyMeters: 12, latitude: 1, longitude: 2 },
    });
  });

  it("returns the text written when the clipboard is read back", async () => {
    const { executor } = executorWith(["Clipboard"]);
    await executor.execute(call("phone_clipboard_write", { text: "Gate code 4412" }));
    expect(await executor.execute(call("phone_clipboard_read"))).toEqual({ _tag: "Done", value: "Gate code 4412" });
  });

  it("opens a link or an app by name", async () => {
    const { calls, executor } = executorWith(["Open"]);
    await executor.execute(call("phone_open", { url: "https://outlore.app" }));
    await executor.execute(call("phone_open", { app: "maps" }));
    expect(calls).toEqual(["open:https://outlore.app", "open:maps"]);
  });

  it("shows a notification with its title and text, naming it Outlore without a title", async () => {
    const { calls, executor } = executorWith(["Notify"]);
    await executor.execute(call("phone_notify", { text: "Build done", title: "Quest" }));
    await executor.execute(call("phone_notify", { text: "Hello" }));
    expect(calls).toEqual(["notify:Quest:Build done", "notify:Outlore:Hello"]);
  });

  it("ignores the phone argument that names this phone", async () => {
    const { executor } = executorWith(["Information"]);
    expect(await executor.execute(call("phone_info", { phone: "Pixel" }))).toMatchObject({ _tag: "Done" });
  });

  it("reads the switch at each call, so a change takes effect at once", async () => {
    const fake = fakePhoneDevice();
    let groups: ReadonlyArray<PhoneGroup> = ["Information"];
    const executor = createPhoneExecutor({ device: fake.device, groups: () => groups });
    expect(await executor.execute(call("phone_info"))).toMatchObject({ _tag: "Done" });
    groups = [];
    expect(await executor.execute(call("phone_info"))).toMatchObject({ _tag: "Refused" });
  });
});

describe("phone executor with arguments or the device failing", () => {
  it("refuses a call whose arguments miss what the tool needs", async () => {
    const { calls, executor } = executorWith(["Clipboard", "Open", "Notify"]);
    expect(await executor.execute(call("phone_clipboard_write", {}))).toEqual({
      _tag: "Refused",
      reason: "The call needs the text to put on the clipboard.",
    });
    expect(await executor.execute(call("phone_open", {}))).toEqual({
      _tag: "Refused",
      reason: "The call needs a link in `url` or an app name in `app`.",
    });
    expect(await executor.execute(call("phone_notify", { title: "t" }))).toEqual({
      _tag: "Refused",
      reason: "The call needs the notification's text.",
    });
    expect(calls).toEqual([]);
  });

  it("passes on a refusal the device gives", async () => {
    const { executor } = executorWith(["Location"], {
      location: async () => ({ _tag: "Refused", reason: "Location is not allowed for Outlore on the phone." }),
    });
    expect(await executor.execute(call("phone_location"))).toEqual({
      _tag: "Refused",
      reason: "Location is not allowed for Outlore on the phone.",
    });
  });

  it("turns an error the device throws into one plain sentence and never throws", async () => {
    const { executor } = executorWith(["Information"], {
      info: async () => {
        throw new Error("Battery service died");
      },
    });
    expect(await executor.execute(call("phone_info"))).toEqual({
      _tag: "Refused",
      reason: "The phone could not do this: Battery service died",
    });
  });
});
