import {
  type PhoneCall,
  type PhoneGroup,
  type PhoneOutcome,
  type PhoneToolName,
  phoneGroupOf,
} from "@outlore/contracts";
import { clipboardTextOf, notificationOf, openingOf, type PhoneArguments } from "./phoneArguments";
import { type PhoneDevice, phoneRefused } from "./phoneDeviceTypes";

/** The sentence a thread reads when the owner has not switched that kind of use on. */
export const notAllowedReason = "The phone's owner has not allowed this";

/** What the executor needs: the phone's device and, read afresh at each call, the groups the owner switched on. */
export type PhoneExecutorParts = {
  readonly device: PhoneDevice;
  readonly groups: () => ReadonlyArray<PhoneGroup>;
};

/** Runs a call's arguments through a tool that needs them, or refuses with what the call lacks. */
const withArguments = <Value>(
  decoded: PhoneArguments<Value>,
  run: (value: Value) => Promise<PhoneOutcome>,
): Promise<PhoneOutcome> =>
  decoded._tag === "Valid" ? run(decoded.value) : Promise.resolve(phoneRefused(decoded.reason));

/**
 * The phone's side of a `PhoneCall`: checks the tool's group switch, runs the tool through the device and says what
 * came of it. It never throws: a refusal or failure on the phone is one plain sentence for the thread to relay.
 */
export const createPhoneExecutor = ({ device, groups }: PhoneExecutorParts) => {
  const runs = {
    phone_clipboard_read: () => device.readClipboard(),
    phone_clipboard_write: (args) => withArguments(clipboardTextOf(args), (text) => device.writeClipboard(text)),
    phone_info: () => device.info(),
    phone_location: () => device.location(),
    phone_notify: (args) => withArguments(notificationOf(args), (message) => device.notify(message)),
    phone_open: (args) => withArguments(openingOf(args), (target) => device.open(target)),
  } satisfies Record<PhoneToolName, (args: unknown) => Promise<PhoneOutcome>>;
  return {
    /** The call's outcome. The switch is the owner's only consent: with it off the device is not touched. */
    execute: async (call: PhoneCall): Promise<PhoneOutcome> => {
      if (!groups().includes(phoneGroupOf[call.tool])) return phoneRefused(notAllowedReason);
      try {
        return await runs[call.tool](call.args);
      } catch (error) {
        return phoneRefused(`The phone could not do this: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
};

/** The phone's executor. */
export type PhoneExecutor = ReturnType<typeof createPhoneExecutor>;
