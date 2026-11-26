import { type PhoneDevice, phoneRefused } from "./phoneDeviceTypes";

// The web build and the desktop window are not the phone: every call is refused, so a browser never offers tools.
// The phone app gets the Expo adapter from `phoneDevice.native.ts`, which Metro picks on the phone.
const notThePhone = async () => phoneRefused("This is not the phone app");

/** The device of this build: it refuses every call outside the phone app. */
export const phoneDevice = (): PhoneDevice => ({
  info: notThePhone,
  location: notThePhone,
  notify: notThePhone,
  open: notThePhone,
  readClipboard: notThePhone,
  writeClipboard: notThePhone,
});
