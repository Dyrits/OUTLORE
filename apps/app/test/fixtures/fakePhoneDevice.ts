import type { PhoneOutcome } from "@outlore/contracts";
import type { PhoneDevice } from "../../src/phone/phoneDeviceTypes";

/** A stand-in phone that records what it was asked and answers with canned values. */
export const fakePhoneDevice = (overrides: Partial<PhoneDevice> = {}) => {
  const calls: Array<string> = [];
  const done = (name: string, value: unknown) => async (): Promise<PhoneOutcome> => {
    calls.push(name);
    return { _tag: "Done", value };
  };
  let clipboard = "";
  const device: PhoneDevice = {
    info: done("info", { batteryPercent: 80 }),
    location: done("location", { accuracyMeters: 12, latitude: 1, longitude: 2 }),
    notify: async (message) => {
      calls.push(`notify:${message.title}:${message.text}`);
      return { _tag: "Done", value: "shown" };
    },
    open: async (target) => {
      calls.push(`open:${target._tag === "Link" ? target.url : target.name}`);
      return { _tag: "Done", value: "opened" };
    },
    readClipboard: async () => {
      calls.push("readClipboard");
      return { _tag: "Done", value: clipboard };
    },
    writeClipboard: async (text) => {
      calls.push("writeClipboard");
      clipboard = text;
      return { _tag: "Done", value: "written" };
    },
    ...overrides,
  };
  return { calls, device };
};
