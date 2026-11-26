import { describe, expect, it } from "vitest";
import { phoneDevice } from "../../src/phone/phoneDevice";

describe("phone device outside the phone app", () => {
  it("refuses every call because this is not the phone app", async () => {
    const device = phoneDevice();
    const refused = { _tag: "Refused", reason: "This is not the phone app" };
    expect(await device.info()).toEqual(refused);
    expect(await device.location()).toEqual(refused);
    expect(await device.readClipboard()).toEqual(refused);
    expect(await device.writeClipboard("x")).toEqual(refused);
    expect(await device.open({ _tag: "Link", url: "https://outlore.app" })).toEqual(refused);
    expect(await device.notify({ text: "x", title: "y" })).toEqual(refused);
  });
});
